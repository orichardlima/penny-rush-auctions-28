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

export async function createVeopagDeposit(params: {
  amount: number
  external_id: string
  description?: string
  payer: { name: string; email: string; document: string }
}) {
  const token = await getVeopagToken()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const webhookUrl = `${supabaseUrl}/functions/v1/veopag-webhook`

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
  console.log('✅ VeoPag deposit created:', data.qrCodeResponse?.transactionId)

  return {
    transactionId: data.qrCodeResponse?.transactionId,
    status: data.qrCodeResponse?.status,
    qrCodeBase64: data.qrCodeResponse?.qrcode,
    amount: data.qrCodeResponse?.amount
  }
}

export { VEOPAG_API_URL }
