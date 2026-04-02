const VPS_MAGEN_RAW = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3333'
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/pix.*$/, '').replace(/\/$/, '')
const VPS_AUTH_TOKEN = Deno.env.get('VPS_AUTH_TOKEN') || ''
const MAGEN_KEY_ID = Deno.env.get('MAGEN_PUBLIC_KEY_ID') || 'e2aaacb3-6a62-4880-9433-2116cf467b2e'

export async function createMagenDeposit(params: {
  amount: number
  txId: string
  description?: string
  payerName: string
  payerTaxId: string
  keyId?: string
}) {
  const requestBody = {
    amount: params.amount,
    amountFormat: 'brl',
    amountType: 'fixed',
    keyId: params.keyId || MAGEN_KEY_ID,
    description: params.description || 'Pagamento PIX',
    expirationInSeconds: 3600,
    payerName: params.payerName || 'Usuario',
    payerTaxId: params.payerTaxId || '',
  }

  const url = `${VPS_BASE_URL}/pix/criar`
  console.log('💳 Enviando para VPS MagenPay:', url, 'amount:', params.amount, 'txId:', params.txId)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (VPS_AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${VPS_AUTH_TOKEN}`
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ VPS MagenPay falhou:', res.status, errorData)
    throw new Error(`Erro ao gerar pagamento PIX via MagenPay VPS: ${res.status}`)
  }

  const result = await res.json()
  console.log('✅ VPS MagenPay retornou:', JSON.stringify(result))

  // Nova API retorna { sucesso, dados: { txId, pixCopiaECola, ... } }
  const dados = result.dados || result

  return {
    transactionId: dados.txId || params.txId,
    status: dados.status || 'pending',
    pixCopyPaste: dados.pixCopiaECola || dados.pix_copy_and_paste || dados.pixCopyPaste || '',
    qrCodeBase64: dados.qr_code || dados.qrCodeBase64 || dados.qrcode || '',
    qrCodeUrl: dados.qrCodeUrl || '',
    amount: params.amount,
  }
}
