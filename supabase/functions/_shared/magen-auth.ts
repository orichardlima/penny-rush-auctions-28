const VPS_MAGEN_URL = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3100'
const VPS_AUTH_TOKEN = Deno.env.get('VPS_AUTH_TOKEN') || ''

export async function createMagenDeposit(params: {
  amount: number
  txId: string
  description?: string
  payerName: string
  payerTaxId: string
  keyId?: string
}) {
  if (!VPS_AUTH_TOKEN) {
    throw new Error('VPS_AUTH_TOKEN não configurado')
  }

  console.log('💳 Enviando para VPS proxy MagenPay:', params.txId, 'amount:', params.amount)

  const res = await fetch(`${VPS_MAGEN_URL}/magen/create-qrcode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${VPS_AUTH_TOKEN}`,
    },
    body: JSON.stringify({
      amount: params.amount,
      txId: params.txId,
      description: params.description || 'Pagamento PIX',
      payerName: params.payerName || 'Usuario',
      payerTaxId: params.payerTaxId.replace(/\D/g, ''),
      keyId: params.keyId || undefined,
    }),
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ VPS proxy MagenPay falhou:', res.status, errorData)
    throw new Error('Erro ao gerar pagamento PIX via MagenPay')
  }

  const data = await res.json()
  console.log('✅ VPS proxy retornou:', JSON.stringify(data))

  return {
    transactionId: data.transactionId,
    status: data.status || 'pending',
    pixCopyPaste: data.pixCopyPaste || '',
    qrCodeBase64: data.qrCodeBase64 || '',
    qrCodeUrl: data.qrCodeUrl || '',
    amount: params.amount,
  }
}
