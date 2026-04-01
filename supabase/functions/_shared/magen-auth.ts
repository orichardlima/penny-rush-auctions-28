import * as secp from 'https://esm.sh/@noble/secp256k1@2.1.0'
import { sha256 } from 'https://esm.sh/@noble/hashes@1.4.0/sha256'
import { hmac } from 'https://esm.sh/@noble/hashes@1.4.0/hmac'

// Enable synchronous signing
secp.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) =>
  hmac(sha256, k, secp.etc.concatBytes(...m))

const MAGEN_BASE_URL = (() => {
  const envUrl = Deno.env.get('MAGEN_BASE_URL') || ''
  // Ensure we use the actual MagenPay API, not a VPS proxy
  if (envUrl && envUrl.includes('magenpay.io')) return envUrl
  return 'https://api.magenpay.io'
})()
const MAGEN_PUBLIC_KEY_ID = Deno.env.get('MAGEN_PUBLIC_KEY_ID') || ''
const MAGEN_PRIVATE_KEY = Deno.env.get('MAGEN_PRIVATE_KEY') || ''
const MAGEN_PIX_KEY_ID = Deno.env.get('MAGEN_PIX_KEY_ID') || ''

function pemToPrivateKeyBytes(pem: string): Uint8Array {
  const lines = pem
    .replace(/-----BEGIN EC PRIVATE KEY-----/, '')
    .replace(/-----END EC PRIVATE KEY-----/, '')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')

  const binaryStr = atob(lines)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }

  // For EC private keys (SEC1 format), the raw key is typically at offset 7, 32 bytes
  // For PKCS8 format, the raw key is deeper in the ASN.1 structure
  // Try to find the 32-byte private key in the DER structure
  if (bytes.length === 32) return bytes

  // SEC1 EC key: SEQUENCE { version, privateKey OCTET STRING, ... }
  // The private key octet string is usually after tag 0x04 (octet string) with length 0x20 (32)
  for (let i = 0; i < bytes.length - 32; i++) {
    if (bytes[i] === 0x04 && bytes[i + 1] === 0x20) {
      return bytes.slice(i + 2, i + 34)
    }
  }

  // Fallback: try offset 7 for SEC1
  if (bytes.length >= 39) {
    return bytes.slice(7, 39)
  }

  throw new Error('Não foi possível extrair a chave privada do PEM')
}

function generateNonce(): string {
  return crypto.randomUUID()
}

function buildSignedData(
  method: string,
  path: string,
  query: string,
  body: string,
  timestamp: string,
  nonce: string
): string {
  const signedData = {
    method: method.toUpperCase(),
    path,
    query,
    body,
    timestamp,
    nonce,
  }
  return JSON.stringify(signedData)
}

function signData(signedData: string, privateKeyBytes: Uint8Array): string {
  const msgHash = sha256(new TextEncoder().encode(signedData))
  const sig = secp.sign(msgHash, privateKeyBytes)

  // Get DER bytes - handle different API versions
  let derBytes: Uint8Array
  if (typeof sig.toDERRawBytes === 'function') {
    derBytes = sig.toDERRawBytes()
  } else if (typeof sig.toDERHex === 'function') {
    const hex = sig.toDERHex()
    derBytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))
  } else {
    // Manual DER encoding from r, s
    const r = sig.r
    const s = sig.s
    function bigintToBytes(n: bigint): Uint8Array {
      const hex = n.toString(16).padStart(64, '0')
      return new Uint8Array(hex.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16)))
    }
    function encodeDERInteger(bytes: Uint8Array): Uint8Array {
      const needsPadding = bytes[0] >= 0x80
      const len = bytes.length + (needsPadding ? 1 : 0)
      const result = new Uint8Array(2 + len)
      result[0] = 0x02
      result[1] = len
      if (needsPadding) {
        result[2] = 0x00
        result.set(bytes, 3)
      } else {
        result.set(bytes, 2)
      }
      return result
    }
    const rDer = encodeDERInteger(bigintToBytes(r))
    const sDer = encodeDERInteger(bigintToBytes(s))
    derBytes = new Uint8Array(2 + rDer.length + sDer.length)
    derBytes[0] = 0x30
    derBytes[1] = rDer.length + sDer.length
    derBytes.set(rDer, 2)
    derBytes.set(sDer, 2 + rDer.length)
  }

  // Convert to base64
  let binary = ''
  for (let i = 0; i < derBytes.length; i++) {
    binary += String.fromCharCode(derBytes[i])
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
  if (!MAGEN_PRIVATE_KEY) {
    throw new Error('MAGEN_PRIVATE_KEY não configurado')
  }
  if (!MAGEN_PUBLIC_KEY_ID) {
    throw new Error('MAGEN_PUBLIC_KEY_ID não configurado')
  }

  const privateKeyBytes = pemToPrivateKeyBytes(MAGEN_PRIVATE_KEY)

  const requestBody = {
    amount: params.amount,
    txId: params.txId,
    description: params.description || 'Pagamento PIX',
    payerName: params.payerName || 'Usuario',
    payerTaxId: params.payerTaxId.replace(/\D/g, ''),
    keyId: params.keyId || MAGEN_PIX_KEY_ID || undefined,
  }

  const bodyStr = JSON.stringify(requestBody)
  const path = '/qrcode/api/v1/external/instant'
  const timestamp = new Date().toISOString()
  const nonce = generateNonce()

  const signedData = buildSignedData('POST', path, '', bodyStr, timestamp, nonce)
  const signature = signData(signedData, privateKeyBytes)

  console.log('💳 Enviando para MagenPay diretamente:', params.txId, 'amount:', params.amount)

  const res = await fetch(`${MAGEN_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': signature,
      'X-Timestamp': timestamp,
      'X-Nonce': nonce,
      'X-Public-Key-ID': MAGEN_PUBLIC_KEY_ID,
    },
    body: bodyStr,
  })

  if (!res.ok) {
    const errorData = await res.text()
    console.error('❌ MagenPay falhou:', res.status, errorData)
    throw new Error(`Erro ao gerar pagamento PIX via MagenPay: ${res.status}`)
  }

  const data = await res.json()
  console.log('✅ MagenPay retornou:', JSON.stringify(data))

  return {
    transactionId: data.transactionId || data.txId || params.txId,
    status: data.status || 'pending',
    pixCopyPaste: data.pixCopyPaste || data.pixCopiaECola || '',
    qrCodeBase64: data.qrCodeBase64 || data.qrcode || '',
    qrCodeUrl: data.qrCodeUrl || '',
    amount: params.amount,
  }
}
