const VEOPAG_API_URL = 'https://api.veopag.com'

let cachedToken: string | null = null
let tokenExpiresAt = 0

export async function getVeopagToken(): Promise<string> {
  const now = Date.now()
  
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken
  }

  const clientId = Deno.env.get('VEOPAG_CLIENT_ID')
  const clientSecret = Deno.env.get('VEOPAG_CLIENT_SECRET')

  if (!clientId || !clientSecret) {
    throw new Error('VEOPAG_CLIENT_ID e VEOPAG_CLIENT_SECRET não configurados')
  }

  console.log('🔑 Authenticating with VeoPag...')

  const res = await fetch(`${VEOPAG_API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret
    })
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ VeoPag auth failed:', res.status, errorData)
    throw new Error('Falha na autenticação com VeoPag')
  }

  const data = await res.json()
  cachedToken = data.token
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000

  console.log('✅ VeoPag authenticated, expires in', data.expires_in, 's')
  return cachedToken!
}

// Assinatura do callback: só o servidor conhece a chave, então só callbacks
// gerados por nós (enviados à VeoPag) passam na verificação do webhook.
export async function veopagCallbackToken(externalId: string): Promise<string> {
  const keyMaterial = Deno.env.get('VEOPAG_CALLBACK_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(keyMaterial),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('veopag-cb:' + externalId))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyVeopagCallbackToken(externalId: string, token: string | null): Promise<boolean> {
  if (!token || !externalId) return false
  const expected = await veopagCallbackToken(externalId)
  if (expected.length !== token.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i)
  return diff === 0
}

async function signedWebhookUrl(externalId: string): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const t = await veopagCallbackToken(externalId)
  return `${supabaseUrl}/functions/v1/veopag-webhook?t=${t}&ref=${encodeURIComponent(externalId)}`
}

export async function createVeopagDeposit(params: {
  amount: number
  external_id: string
  description?: string
  payer: { name: string; email: string; document: string }
}) {
  const token = await getVeopagToken()
  const webhookUrl = await signedWebhookUrl(params.external_id)

  console.log('💳 Creating VeoPag deposit:', params.external_id, 'amount:', params.amount)

  const res = await fetch(`${VEOPAG_API_URL}/api/payments/deposit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: params.amount,
      external_id: params.external_id,
      clientCallbackUrl: webhookUrl,
      payer: {
        name: params.payer.name || 'Usuario',
        email: params.payer.email,
        document: params.payer.document.replace(/\D/g, '')
      }
    })
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ VeoPag deposit failed:', res.status, errorData)
    throw new Error('Erro ao gerar pagamento PIX via VeoPag')
  }

  const data = await res.json()
  console.log('📋 VeoPag full response:', JSON.stringify(data))
  console.log('✅ VeoPag deposit created:', data.qrCodeResponse?.transactionId)

  // Handle multiple QR code formats
  const rawQr = data.qrCodeResponse?.qrcode || data.qrCodeResponse?.qr_code || data.qrCodeResponse?.qrCode || ''
  let qrCodeBase64 = ''
  let qrCodeUrl = ''

  if (typeof rawQr === 'string' && rawQr.length > 0) {
    if (rawQr.startsWith('http')) {
      qrCodeUrl = rawQr
    } else if (rawQr.startsWith('data:')) {
      qrCodeBase64 = rawQr.replace(/^data:image\/\w+;base64,/, '')
    } else if (rawQr.startsWith('0002') || rawQr.length < 100) {
      // PIX EMV copy-paste string, NOT a base64 image
      // Leave qrCodeBase64 empty, frontend will use QRCodeSVG
    } else {
      qrCodeBase64 = rawQr
    }
  }

  console.log('🖼️ QR format:', qrCodeBase64 ? 'base64' : qrCodeUrl ? 'url' : 'none', '| length:', rawQr.length)

  return {
    transactionId: data.qrCodeResponse?.transactionId,
    status: data.qrCodeResponse?.status,
    pixCopyPaste: rawQr,
    qrCodeBase64,
    qrCodeUrl,
    amount: data.qrCodeResponse?.amount
  }
}

export async function createVeopagWithdrawal(params: {
  amount: number
  external_id: string
  pix_key: string
  key_type: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE_EVP'
  taxId: string
  name: string
  description?: string
}) {
  const token = await getVeopagToken()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/veopag-webhook`

  console.log('💸 Creating VeoPag withdrawal:', params.external_id, 'amount:', params.amount)

  const res = await fetch(`${VEOPAG_API_URL}/api/withdrawals/withdraw`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: params.amount,
      external_id: params.external_id,
      pix_key: params.pix_key,
      key_type: params.key_type,
      taxId: params.taxId.replace(/\D/g, ''),
      name: params.name,
      description: params.description || 'Saque parceiro - Penny Rush',
      clientCallbackUrl: webhookUrl
    })
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ VeoPag withdrawal failed:', res.status, errorData)
    throw new Error(`Erro ao enviar PIX via VeoPag: ${errorData}`)
  }

  const data = await res.json()
  console.log('📋 VeoPag withdrawal response:', JSON.stringify(data))

  return {
    transaction_id: data.withdrawal?.transaction_id || data.transaction_id,
    status: data.withdrawal?.status || data.status,
    amount: data.withdrawal?.amount || params.amount,
    fee: data.withdrawal?.fee || 0
  }
}

export { VEOPAG_API_URL }
