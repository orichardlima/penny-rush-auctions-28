import * as secp from "https://esm.sh/@noble/secp256k1@2.1.0"
import { sha256 } from "https://esm.sh/@noble/hashes@1.6.1/sha256"

const MAGEN_BASE_URL = Deno.env.get('MAGEN_BASE_URL') || 'https://api.magenpay.io'

function generateNonce(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

function pemToPrivateKeyBytes(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN (?:EC )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:EC )?PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const der = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    der[i] = binary.charCodeAt(i)
  }

  // secp256k1 EC private key in DER/PKCS8 format
  // The raw 32-byte key is typically at the end of the DER structure
  // For EC PRIVATE KEY (SEC1): key is after octet string tag (0x04) at offset ~7
  // For PRIVATE KEY (PKCS8): key is deeper in the structure
  // We search for the 32-byte private key by looking for the OID or extracting last 32 bytes
  
  // Strategy: find 0x04 0x20 (octet string, 32 bytes) which contains the raw key
  for (let i = 0; i < der.length - 33; i++) {
    if (der[i] === 0x04 && der[i + 1] === 0x20) {
      return der.slice(i + 2, i + 34)
    }
  }

  // Fallback: for some PKCS8 formats, try finding the key after the OID
  // If der is exactly 32 bytes already (unlikely but handle)
  if (der.length === 32) return der

  throw new Error('Não foi possível extrair a chave privada secp256k1 do PEM')
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

function signData(privateKeyBytes: Uint8Array, signedData: SignedData): string {
  const dataStr = JSON.stringify(signedData)
  const msgHash = sha256(new TextEncoder().encode(dataStr))
  const signature = secp.sign(msgHash, privateKeyBytes)
  const sigBytes = signature.toDERRawBytes()
  // Convert to base64
  let binary = ''
  for (const b of sigBytes) {
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

  const privateKeyBytes = pemToPrivateKeyBytes(privateKeyPem)
  const signedData = buildSignedData('POST', url, bodyStr)
  const signature = signData(privateKeyBytes, signedData)

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

  return {
    transactionId: txId,
    status: data.status || 'pending',
    pixCopyPaste: pixCopiaECola,
    qrCodeBase64: '',
    qrCodeUrl: '',
    amount: params.amount
  }
}
