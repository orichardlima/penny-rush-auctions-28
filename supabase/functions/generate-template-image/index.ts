import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PROMPT_TEMPLATE = (title: string) =>
  `Product photography of ${title}, centered, studio lighting, soft shadows, clean white background, high detail, realistic, no text, no watermark, e-commerce style, square format`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableKey = Deno.env.get('LOVABLE_API_KEY')

    if (!lovableKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Auth: validar JWT + admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userErr } = await supabaseAuth.auth.getUser()
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(supabaseUrl, serviceKey)

    // Admin check
    const { data: adminCheck } = await supabase
      .from('profiles').select('is_admin').eq('user_id', user.id).maybeSingle()
    if (!adminCheck?.is_admin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json().catch(() => ({}))
    const templateId: string | undefined = body.template_id
    const customPrompt: string | undefined = body.prompt

    if (!templateId) {
      return new Response(JSON.stringify({ error: 'template_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: template, error: tErr } = await supabase
      .from('product_templates')
      .select('id, title')
      .eq('id', templateId)
      .single()

    if (tErr || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const prompt = customPrompt && customPrompt.trim().length > 0
      ? customPrompt
      : PROMPT_TEMPLATE(template.title)

    console.log(`[generate-template-image] ${templateId} prompt="${prompt.slice(0, 80)}..."`)

    // Chamar Lovable AI Gateway
    const aiResp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    })

    if (!aiResp.ok) {
      const errText = await aiResp.text()
      console.error('AI gateway error:', aiResp.status, errText)
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limited, try again later' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: 'AI gateway failed', detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const aiData = await aiResp.json()
    const imageUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined

    if (!imageUrl || !imageUrl.startsWith('data:image/')) {
      console.error('No image in AI response:', JSON.stringify(aiData).slice(0, 500))
      return new Response(JSON.stringify({ error: 'No image returned by AI' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Decodificar base64 → Uint8Array
    const base64Data = imageUrl.split(',')[1]
    const binary = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))

    const filePath = `generated/${templateId}.png`

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(filePath, binary, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: true,
      })

    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return new Response(JSON.stringify({ error: 'Upload failed', detail: uploadErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}`

    await supabase
      .from('product_templates')
      .update({ image_url: publicUrl, image_source: 'ai' })
      .eq('id', templateId)

    return new Response(
      JSON.stringify({ ok: true, image_url: publicUrl, template_id: templateId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('generate-template-image error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
