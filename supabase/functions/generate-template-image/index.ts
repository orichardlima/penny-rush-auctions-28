import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Marcas conhecidas — quando o título contém uma destas, mantemos no prompt
// e disparamos retry com modelo Pro para aumentar fidelidade.
const KNOWN_BRANDS = [
  'apple', 'iphone', 'ipad', 'macbook', 'airpods', 'imac',
  'samsung', 'galaxy',
  'sony', 'playstation', 'ps5', 'ps4',
  'xbox', 'microsoft',
  'nintendo', 'switch',
  'lg', 'oled',
  'xiaomi', 'redmi',
  'jbl', 'bose', 'beats',
  'canon', 'nikon', 'gopro',
  'dell', 'lenovo', 'asus', 'acer', 'hp',
  'dyson', 'philips', 'electrolux', 'brastemp',
  'mi band', 'amazfit', 'garmin',
  'dewalt', 'makita', 'bosch', 'black+decker', 'black & decker',
]

function hasKnownBrand(text: string): boolean {
  const lower = text.toLowerCase()
  return KNOWN_BRANDS.some(b => lower.includes(b))
}

// Sanitização SUAVE: só remove termos que disparam filtro de copyright,
// mas preserva nomes de marca/modelo (essenciais para fidelidade).
const SOFT_SANITIZE: Array<[RegExp, string]> = [
  [/\b(official|oficial)\b/gi, ''],
  [/\b(logo|logotipo|branded|marca\s+registrada|copyrighted|copyright)\b/gi, ''],
  [/\b(replica|réplica|fake|falsificado)\b/gi, ''],
]

// Tradução pt→en focada em categorias de produto (sem apagar marcas)
const PT_EN_PHRASES: Array<[RegExp, string]> = [
  // Áudio
  [/microfone\s+de\s+lapela(\s+usb)?/gi, 'lavalier clip-on microphone with USB cable'],
  [/microfone\s+lapela(\s+usb)?/gi, 'lavalier clip-on microphone with USB cable'],
  [/microfone\s+condensador/gi, 'studio condenser microphone with stand'],
  [/microfone\s+sem\s+fio/gi, 'wireless handheld microphone'],
  [/caixa\s+de\s+som\s+bluetooth/gi, 'portable bluetooth speaker'],
  [/caixa\s+de\s+som\s+port[áa]til/gi, 'portable bluetooth speaker'],
  [/fone\s+de\s+ouvido\s+bluetooth/gi, 'bluetooth wireless headphones'],
  [/fone\s+de\s+ouvido\s+sem\s+fio/gi, 'wireless headphones'],
  [/fone\s+de\s+ouvido/gi, 'over-ear headphones'],
  [/soundbar/gi, 'soundbar speaker for TV'],
  // Ferramentas
  [/furadeira\s+parafusadeira(\s+\d+v)?/gi, 'cordless drill driver with battery and chuck'],
  [/furadeira\s+sem\s+fio/gi, 'cordless drill with battery'],
  [/parafusadeira/gi, 'cordless screwdriver with battery'],
  [/serra\s+circular/gi, 'circular saw power tool'],
  [/lixadeira/gi, 'orbital sander power tool'],
  [/esmerilhadeira/gi, 'angle grinder power tool'],
  [/chave\s+de\s+impacto/gi, 'impact wrench power tool'],
  [/maleta\s+de\s+ferramentas/gi, 'tool kit case with tools'],
  // Cozinha / eletrodomésticos
  [/air\s*fryer|fritadeira\s+el[ée]trica|fritadeira\s+sem\s+[óo]leo/gi, 'air fryer kitchen appliance'],
  [/liquidificador/gi, 'kitchen blender'],
  [/batedeira/gi, 'stand mixer'],
  [/processador\s+de\s+alimentos/gi, 'food processor'],
  [/cafeteira\s+el[ée]trica/gi, 'electric coffee maker'],
  [/cafeteira/gi, 'coffee maker'],
  [/sandu[ií]cheira/gi, 'sandwich maker grill'],
  [/grill\s+el[ée]trico/gi, 'electric grill'],
  [/forno\s+el[ée]trico/gi, 'electric countertop oven'],
  [/micro-?ondas/gi, 'microwave oven'],
  [/geladeira|refrigerador/gi, 'refrigerator'],
  [/fog[ãa]o/gi, 'kitchen stove'],
  [/aspirador\s+de\s+p[óo]/gi, 'vacuum cleaner'],
  [/ferro\s+de\s+passar/gi, 'steam iron'],
  // Beleza / cuidados
  [/secador\s+de\s+cabelo/gi, 'hair dryer'],
  [/chapinha|prancha\s+de\s+cabelo/gi, 'hair straightener flat iron'],
  [/barbeador\s+el[ée]trico/gi, 'electric shaver'],
  [/escova\s+de\s+dentes\s+el[ée]trica/gi, 'electric toothbrush'],
  // Eletrônicos
  [/smart\s*tv\s*(\d+)"?/gi, 'smart TV $1 inch with thin bezels'],
  [/televis[ãa]o|tv\s+\d+/gi, 'flat screen smart TV'],
  [/notebook|laptop/gi, 'laptop computer with metallic finish'],
  [/tablet/gi, 'tablet device with thin bezels'],
  [/smartphone|celular/gi, 'smartphone'],
  [/c[âa]mera\s+digital/gi, 'digital camera'],
  [/c[âa]mera\s+de\s+a[çc][ãa]o/gi, 'compact action camera'],
  [/console\s+de\s+videogame|videogame/gi, 'gaming console'],
  [/controle\s+de\s+videogame|joystick/gi, 'gaming controller gamepad'],
  [/teclado\s+gamer/gi, 'mechanical gaming keyboard with RGB lights'],
  [/mouse\s+gamer/gi, 'ergonomic gaming mouse with RGB'],
  [/headset\s+gamer/gi, 'gaming headset with microphone'],
  [/monitor\s+gamer/gi, 'curved gaming monitor'],
  [/monitor/gi, 'computer monitor with thin bezels'],
  [/rel[óo]gio\s+inteligente|smartwatch/gi, 'smartwatch with touchscreen face and band'],
  [/rel[óo]gio/gi, 'wristwatch'],
  // Casa / lifestyle
  [/ventilador/gi, 'electric fan'],
  [/ar\s+condicionado/gi, 'air conditioner unit'],
  [/bicicleta\s+el[ée]trica/gi, 'electric bicycle'],
  [/bicicleta/gi, 'bicycle'],
  [/patinete\s+el[ée]trico/gi, 'electric scooter'],
  [/mochila/gi, 'backpack'],
  [/mala\s+de\s+viagem/gi, 'travel suitcase with wheels'],
  [/perfume/gi, 'perfume bottle'],
  // Conectores / palavras de ligação
  [/\bsem\s+fio\b/gi, 'cordless'],
  [/\bbateria\s+recarreg[áa]vel\b/gi, 'rechargeable battery'],
  [/\bcom\b/gi, 'with'],
  [/\be\b/gi, 'and'],
  [/\bpara\b/gi, 'for'],
  [/\bpreto\b/gi, 'black'],
  [/\bbranco\b/gi, 'white'],
  [/\bcinza\b/gi, 'gray'],
  [/\bvermelho\b/gi, 'red'],
  [/\bazul\b/gi, 'blue'],
  [/\bprateado\b/gi, 'silver'],
  [/\bdourado\b/gi, 'gold'],
  [/\bpolegadas?\b/gi, 'inch'],
]

// Âncoras visuais por categoria (reduz "alucinação" do modelo)
const CATEGORY_ANCHORS: Record<string, string> = {
  eletronicos: 'electronic device with screen, buttons or ports, modern industrial design',
  smartphones: 'rectangular touchscreen device with thin bezels and rear camera bump on the back',
  tablets: 'large rectangular touchscreen device with thin bezels',
  notebooks: 'clamshell laptop with screen and keyboard, metallic finish',
  audio: 'audio device with speaker grille, drivers or microphone capsule visible',
  fones: 'over-ear or in-ear headphones with cushioned cups or earbuds and headband',
  caixas_som: 'cylindrical or rectangular speaker with mesh grille',
  tvs: 'large flat screen with thin bezels and stand',
  videogames: 'gaming console body with controller, glossy or matte finish',
  cameras: 'camera body with detachable lens, viewfinder and grip',
  relogios: 'circular or square watch face with strap or band',
  ferramentas: 'tool body with grip handle and operational head, industrial design',
  eletrodomesticos: 'home appliance with control panel and functional shape',
  cozinha: 'kitchen appliance with control panel, transparent parts or heating elements',
  beleza: 'personal care device with handle and operational head',
  esportes: 'sports equipment, ergonomic shape',
  brinquedos: 'toy with bright colors and playful shape',
  moda: 'fashion item with fabric texture and stitching',
  geral: 'consumer product with clear functional shape',
}

function applyReplacements(text: string, rules: Array<[RegExp, string]>): string {
  let result = text
  for (const [pattern, replacement] of rules) {
    result = result.replace(pattern, replacement)
  }
  return result
}

function softTranslate(text: string): string {
  let result = applyReplacements(text, SOFT_SANITIZE)
  result = applyReplacements(result, PT_EN_PHRASES)
  result = result.replace(/\s+/g, ' ').replace(/\s+,/g, ',').trim()
  return result || text
}

function buildPrompt(
  translatedTitle: string,
  translatedDescription: string,
  category: string,
): string {
  const desc = translatedDescription && translatedDescription.trim().length > 0
    ? `${translatedDescription}.`
    : ''
  const anchor = CATEGORY_ANCHORS[category] || CATEGORY_ANCHORS.geral
  return [
    `Professional product photography of a ${translatedTitle}.`,
    desc,
    `Key visual features: ${anchor}.`,
    `The product MUST visually match a ${translatedTitle} — do NOT generate any other type of object.`,
    `Centered on pure white background, studio lighting, soft shadows, sharp focus on the product,`,
    `photorealistic, e-commerce catalog style, square 1:1 aspect ratio.`,
    `No text, no logos, no watermarks, no people, no hands.`,
  ].filter(Boolean).join(' ')
}

const buildGenericFallback = (category: string) => {
  const anchor = CATEGORY_ANCHORS[category] || CATEGORY_ANCHORS.geral
  return `Professional product photography of a generic ${category || 'consumer'} product. ` +
    `Key visual features: ${anchor}. ` +
    `Pure white background, studio lighting, soft shadows, photorealistic, e-commerce catalog style, square 1:1. ` +
    `No text, no watermark, no people.`
}

async function callGemini(lovableKey: string, prompt: string, model: string) {
  const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${lovableKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      modalities: ['image', 'text'],
    }),
  })
  return resp
}

function extractImage(aiData: any): { url: string | null; bytes: number } {
  const url = aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined
  if (!url || !url.startsWith('data:image/')) return { url: null, bytes: 0 }
  const base64 = url.split(',')[1] || ''
  // ~tamanho em bytes do PNG decodificado
  const bytes = Math.floor(base64.length * 0.75)
  return { url, bytes }
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
      .select('id, title, description, category, tier')
      .eq('id', templateId)
      .single()

    if (tErr || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const translatedTitle = softTranslate(template.title)
    const translatedDescription = template.description
      ? softTranslate(template.description)
      : ''
    const brandPresent = hasKnownBrand(template.title)

    const prompt = customPrompt && customPrompt.trim().length > 0
      ? customPrompt
      : buildPrompt(translatedTitle, translatedDescription, template.category)

    console.log(`[generate-template-image] ${templateId}`)
    console.log(`  original title: "${template.title}"`)
    console.log(`  translated title: "${translatedTitle}"`)
    console.log(`  category: "${template.category}" | brandPresent=${brandPresent}`)
    console.log(`  custom prompt: ${customPrompt ? 'YES' : 'no'}`)
    console.log(`  final prompt: "${prompt}"`)

    const FLASH = 'google/gemini-3.1-flash-image-preview'
    const PRO = 'google/gemini-3-pro-image-preview'

    // ===== Tentativa 1: Flash =====
    let flashResult: { url: string | null; bytes: number } = { url: null, bytes: 0 }
    let flashStatus = 0
    let flashError = ''
    try {
      const aiResp = await callGemini(lovableKey, prompt, FLASH)
      flashStatus = aiResp.status
      if (aiResp.ok) {
        const aiData = await aiResp.json()
        flashResult = extractImage(aiData)
        console.log(`[attempt=1 model=${FLASH}] hasImage=${!!flashResult.url} bytes=${flashResult.bytes} finish=${aiData?.choices?.[0]?.finish_reason}`)
      } else {
        flashError = await aiResp.text()
        console.error(`[attempt=1] ${flashStatus} ${flashError.slice(0, 300)}`)
      }
    } catch (e) {
      console.error('[attempt=1] exception:', e)
    }

    // Erros monetários/limite têm prioridade
    if (flashStatus === 429) {
      return new Response(JSON.stringify({ error: 'Limite de requisições atingido. Tente novamente em alguns instantes.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (flashStatus === 402) {
      return new Response(JSON.stringify({ error: 'Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.' }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ===== Tentativa 2 =====
    // - Se flash falhou (sem imagem): retry com Pro + prompt genérico
    // - Se flash veio com imagem E há marca conhecida: tentar Pro para ganhar fidelidade
    let proResult: { url: string | null; bytes: number } = { url: null, bytes: 0 }
    let didProAttempt = false

    const shouldTryProForFidelity = !!flashResult.url && brandPresent && !customPrompt
    const shouldTryProAsRescue = !flashResult.url

    if (shouldTryProForFidelity || shouldTryProAsRescue) {
      didProAttempt = true
      const proPrompt = shouldTryProAsRescue
        ? buildGenericFallback(template.category || 'eletronicos')
        : prompt
      try {
        const aiResp = await callGemini(lovableKey, proPrompt, PRO)
        if (aiResp.ok) {
          const aiData = await aiResp.json()
          proResult = extractImage(aiData)
          console.log(`[attempt=2 model=${PRO} reason=${shouldTryProAsRescue ? 'rescue' : 'fidelity'}] hasImage=${!!proResult.url} bytes=${proResult.bytes}`)
        } else {
          const t = await aiResp.text()
          console.error(`[attempt=2] ${aiResp.status} ${t.slice(0, 300)}`)
        }
      } catch (e) {
        console.error('[attempt=2] exception:', e)
      }
    }

    // Decisão final: prefere Pro quando disponível e robusto
    let finalUrl: string | null = null
    let finalSource = ''
    if (proResult.url && shouldTryProForFidelity && proResult.bytes >= flashResult.bytes * 0.8) {
      finalUrl = proResult.url
      finalSource = `pro (${proResult.bytes}B vs flash ${flashResult.bytes}B)`
    } else if (proResult.url && shouldTryProAsRescue) {
      finalUrl = proResult.url
      finalSource = `pro-rescue (${proResult.bytes}B)`
    } else if (flashResult.url) {
      finalUrl = flashResult.url
      finalSource = `flash (${flashResult.bytes}B)${didProAttempt ? ' [pro descartado]' : ''}`
    }

    console.log(`[generate-template-image] DECISION: ${finalSource || 'NONE'}`)

    if (!finalUrl) {
      return new Response(JSON.stringify({
        error: 'O modelo recusou gerar esta imagem — provavelmente conflito de marca/copyright. Tente um prompt customizado ou use upload manual.'
      }), {
        status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const base64Data = finalUrl.split(',')[1]
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

    // Cache-buster para forçar atualização da imagem na CDN do navegador
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filePath}?v=${Date.now()}`

    await supabase
      .from('product_templates')
      .update({ image_url: publicUrl, image_source: 'ai' })
      .eq('id', templateId)

    return new Response(
      JSON.stringify({ ok: true, image_url: publicUrl, template_id: templateId, source: finalSource }),
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
