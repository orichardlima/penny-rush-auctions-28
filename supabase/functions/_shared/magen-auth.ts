const MAGEN_BASE_URL = Deno.env.get('MAGEN_BASE_URL') || 'https://api.magenpay.io'

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN (?:EC )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:EC )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

interface SignedData {
  method: string
  path: string
  query: string
  body: string
  timestamp: string
  nonce: string
}

function buildSignedData(method: string, url: string, body: string): SignedData {
  const parsed = new URL(url)
  return {
    method: method.toUpperCase(),
    path: parsed.pathname,
    query: parsed.search.slice(1),
    body: body || '',
    timestamp: new Date().toISOString(),
    nonce: generateNonce(),
  }
}

async function signData(privateKey: CryptoKey, signedData: SignedData): Promise<string> {
  const dataStr = JSON.stringify(signedData)
  const encoder = new TextEncoder()
  const data = encoder.encode(dataStr)
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    data
  )
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(signature)
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary)
}

export async function createMagenDeposit(params: {
  amount: number
  txId: string
  description?: string
  payerName: string
  payerTaxId: string
  keyId?: string
}) {
  const privateKeyPem = Deno.env.get('MAGEN_PRIVATE_KEY')
  const publicKeyId = Deno.env.get('MAGEN_PUBLIC_KEY_ID')
  const pixKeyId = params.keyId || Deno.env.get('MAGEN_PIX_KEY_ID')

  if (!privateKeyPem || !publicKeyId) {
    throw new Error('MAGEN_PRIVATE_KEY e MAGEN_PUBLIC_KEY_ID não configurados')
  }

  if (!pixKeyId) {
    throw new Error('MAGEN_PIX_KEY_ID não configurado')
  }

  console.log('💳 Creating MagenPay deposit:', params.txId, 'amount:', params.amount)

  const url = `${MAGEN_BASE_URL}/qrcode/api/v1/external/instant`
  const bodyObj = {
    amount: params.amount,
    amountType: 'fixed',
    description: params.description || 'Pagamento PIX',
    expirationInSeconds: 3600,
    keyId: pixKeyId,
    payerName: params.payerName || 'Usuario',
    payerTaxId: params.payerTaxId.replace(/\D/g, ''),
    txId: params.txId
  }
  const bodyStr = JSON.stringify(bodyObj)

  const privateKey = await importPrivateKey(privateKeyPem)
  const signedData = buildSignedData('POST', url, bodyStr)
  const signature = await signData(privateKey, signedData)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': signedData.timestamp,
      'X-Nonce': signedData.nonce,
      'X-Public-Key-ID': publicKeyId
    },
    body: bodyStr
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ MagenPay deposit failed:', res.status, errorData)
    throw new Error('Erro ao gerar pagamento PIX via MagenPay')
  }

  const data = await res.json()
  console.log('📋 MagenPay response:', JSON.stringify(data))

  const pixCopiaECola = data.pixCopiaECola || data.pixCopyPaste || ''
  const txId = data.txId || params.txId

  console.log('✅ MagenPay deposit created, txId:', txId)

  // Return compatible structure with createVeopagDeposit
  return {
    transactionId: txId,
    status: data.status || 'pending',
    pixCopyPaste: pixCopiaECola,
    qrCodeBase64: '',
    qrCodeUrl: '',
    amount: params.amount
  }
}
