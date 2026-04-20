import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Mapeamento de marcas/modelos icônicos -> descrição genérica (evita filtro de copyright)
const BRAND_REPLACEMENTS: Array<[RegExp, string]> = [
  // Apple
  [/iphone\s*\d*\s*(pro\s*max|pro|plus|mini)?/gi, 'premium smartphone with triple camera and titanium finish'],
  [/macbook\s*(air|pro)?\s*(m\d)?/gi, 'modern thin laptop with metallic finish'],
  [/ipad\s*(pro|air|mini)?/gi, 'modern tablet with thin bezels'],
  [/airpods\s*(pro|max)?/gi, 'wireless earbuds in charging case'],
  [/apple\s*watch\s*(ultra\s*\d?|series\s*\d+|se)?/gi, 'modern smartwatch with rectangular display'],
  [/\bapple\b/gi, ''],
  // Sony
  [/sony\s*alpha\s*a?\d*/gi, 'professional mirrorless camera with detachable lens'],
  [/playstation\s*\d*|ps[345]/gi, 'modern gaming console, white and black two-tone design'],
  [/sony\s*wh-?\d+/gi, 'over-ear noise-cancelling wireless headphones'],
  [/\bsony\b/gi, ''],
  // Samsung
  [/galaxy\s*s\d*\s*(ultra|plus)?/gi, 'premium android smartphone with quad camera'],
  [/galaxy\s*tab\s*\w*/gi, 'android tablet with thin bezels'],
  [/galaxy\s*watch\s*\w*/gi, 'round-faced smartwatch'],
  [/\bsamsung\b/gi, ''],
  // Outros
  [/nintendo\s*switch\s*(oled|lite)?/gi, 'handheld gaming console with detachable controllers'],
  [/\bnintendo\b/gi, ''],
  [/xbox\s*(series\s*[xs]|one)?/gi, 'modern gaming console, matte black design'],
  [/macbook|imac|mac\s*mini/gi, 'modern desktop computer'],
  [/lg\s*oled\s*\w*|tv\s*oled\s*lg\s*\d+/gi, 'premium OLED smart TV with thin bezels'],
  [/\blg\b/gi, ''],
  [/xiaomi\s*\w*|redmi\s*\w*/gi, 'modern android smartphone'],
  [/\bxiaomi\b/gi, ''],
  [/canon\s*eos\s*\w*/gi, 'professional DSLR camera with detachable lens'],
  [/\bcanon\b/gi, ''],
  [/nikon\s*\w*/gi, 'professional DSLR camera'],
  [/dell\s*\w*|lenovo\s*\w*|asus\s*\w*|acer\s*\w*|hp\s*\w*/gi, 'modern laptop with metallic finish'],
  [/jbl\s*\w*/gi, 'portable bluetooth speaker'],
  [/bose\s*\w*/gi, 'premium wireless headphones'],
]

function sanitizeTitle(title: string): string {
  let result = title
  for (const [pattern, replacement] of BRAND_REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }
  // Limpa espaços duplos e pontuação solta
  result = result.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()
  return result || title
}

const buildPrompt = (cleanTitle: string) =>
  `Product photography of ${cleanTitle}, centered, studio lighting, soft shadows, clean white background, high detail, realistic, no text, no watermark, e-commerce style, square format`

const buildGenericFallback = (category: string) =>
  `Product photography of a generic ${category || 'consumer electronics'} product, centered on clean white background, studio lighting, soft shadows, e-commerce style, square format, no text, no watermark`

async function callGemini(lovableKey: string, prompt: string) {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
  return resp
}

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
      .select('id, title, category, tier')
      .eq('id', templateId)
      .single()

    if (tErr || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleanTitle = sanitizeTitle(template.title)
    const prompt = customPrompt && customPrompt.trim().length > 0
      ? customPrompt
      : buildPrompt(cleanTitle)

    console.log(`[generate-template-image] ${templateId} original="${template.title}" sanitized="${cleanTitle}"`)

    // Tentativa 1
    let aiResp = await callGemini(lovableKey, prompt)

    if (!aiResp.ok) {
      const errText = await aiResp.text()
      console.error('AI gateway error:', aiResp.status, errText)
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: 'Falha no gateway de IA', detail: errText }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let aiData = await aiResp.json()
    let imageUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined
    const finishReason = aiData?.choices?.[0]?.finish_reason
    const refusal = aiData?.choices?.[0]?.message?.refusal
    console.log(`[generate-template-image] attempt=1 finish_reason=${finishReason} refusal=${refusal} hasImage=${!!imageUrl}`)

    // Retry com prompt genérico se não veio imagem
    if (!imageUrl || !imageUrl.startsWith('data:image/')) {
      console.log('[generate-template-image] retrying with generic fallback prompt')
      const fallbackPrompt = buildGenericFallback(template.category || 'eletrônicos')
      aiResp = await callGemini(lovableKey, fallbackPrompt)
      if (aiResp.ok) {
        aiData = await aiResp.json()
        imageUrl = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined
        const fr2 = aiData?.choices?.[0]?.finish_reason
        const ref2 = aiData?.choices?.[0]?.message?.refusal
        console.log(`[generate-template-image] attempt=2 finish_reason=${fr2} refusal=${ref2} hasImage=${!!imageUrl}`)
      }
    }

    if (!imageUrl || !imageUrl.startsWith('data:image/')) {
      console.error('No image after retry:', JSON.stringify(aiData).slice(0, 500))
      return new Response(JSON.stringify({
        error: 'O modelo recusou gerar esta imagem — provavelmente conflito de marca/copyright. Use upload manual ou defina um image_key.'
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

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
      return new Response(JSON.stringify({ error: 'Falha no upload', detail: uploadErr.message }), {
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
