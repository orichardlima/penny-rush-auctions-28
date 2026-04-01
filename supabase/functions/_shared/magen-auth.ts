const VPS_BASE_URL = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3000'
const VPS_AUTH_TOKEN = Deno.env.get('VPS_AUTH_TOKEN') || ''
const MAGEN_KEY_ID = Deno.env.get('MAGEN_PUBLIC_KEY_ID') || 'afd04971-db66-44f2-8111-0f8937cd0e90'

export async function createMagenDeposit(params: {
  amount: number
  txId: string
  description?: string
  payerName: string
  payerTaxId: string
  keyId?: string
}) {
  const requestBody = {
    keyId: params.keyId || MAGEN_KEY_ID,
    body: {
      order_id: params.txId,
      amount: params.amount,
      currency: 'BRL',
      payment_method: 'pix',
      customer: {
        name: params.payerName || 'Usuario',
        email: ''
      }
    }
  }

  const url = `${VPS_BASE_URL}/pagamento`
  console.log('💳 Enviando para VPS MagenPay:', url, 'order_id:', params.txId, 'amount:', params.amount)

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

  const data = await res.json()
  console.log('✅ VPS MagenPay retornou:', JSON.stringify(data))

  return {
    transactionId: data.transactionId || data.txId || params.txId,
    status: data.status || 'pending',
    pixCopyPaste: data.pix_copy_and_paste || data.pixCopyPaste || data.pixCopiaECola || '',
    qrCodeBase64: data.qr_code || data.qrCodeBase64 || data.qrcode || '',
    qrCodeUrl: data.qrCodeUrl || '',
    amount: params.amount,
  }
}
