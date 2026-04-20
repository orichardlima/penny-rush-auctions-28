import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

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

    // Buscar templates standard/premium sem imagem
    const { data: templates, error: tErr } = await supabase
      .from('product_templates')
      .select('id, title, tier')
      .is('image_url', null)
      .is('image_key', null)
      .in('tier', ['standard', 'premium', 'luxury'])

    if (tErr) throw tErr

    if (!templates || templates.length === 0) {
      return new Response(
        JSON.stringify({ ok: 0, failed: 0, message: 'No pending templates' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[seed-template-images] processing ${templates.length} templates`)

    const results = { ok: 0, failed: 0, errors: [] as Array<{ id: string; title: string; error: string }> }

    for (let i = 0; i < templates.length; i++) {
      const t = templates[i]
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/generate-template-image`, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ template_id: t.id }),
        })
        if (!resp.ok) {
          const errText = await resp.text()
          results.failed++
          results.errors.push({ id: t.id, title: t.title, error: `${resp.status}: ${errText.slice(0, 200)}` })
          console.error(`Failed ${t.title}:`, resp.status, errText.slice(0, 200))
        } else {
          results.ok++
          console.log(`OK [${i + 1}/${templates.length}] ${t.title}`)
        }
      } catch (err) {
        results.failed++
        results.errors.push({ id: t.id, title: t.title, error: (err as Error).message })
      }

      // Delay 2s entre chamadas (rate limit safety)
      if (i < templates.length - 1) await sleep(2000)
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('seed-template-images error:', error)
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
