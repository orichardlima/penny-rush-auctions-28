// MagenPay PIX Out (envio de PIX) via VPS proxy
const VPS_MAGEN_RAW = Deno.env.get('VPS_MAGEN_URL') || 'http://76.13.162.10:3333'
const VPS_BASE_URL = VPS_MAGEN_RAW.replace(/\/(pix|pagamento).*$/, '').replace(/\/$/, '')
const VPS_AUTH_TOKEN = Deno.env.get('VPS_AUTH_TOKEN') || ''

export interface MagenPixOutParams {
  amount: number
  externalId: string         // UUID único — NUNCA reutilizar
  receiverPixKey: string     // CPF, CNPJ, e-mail, telefone ou aleatória
  description?: string
}

export interface MagenPixOutResult {
  externalId: string
  status: 'processing' | 'success' | 'failed' | string
  amount?: number
  creditor?: { name?: string; document?: string }
  finishedAt?: string
  raw: any
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (VPS_AUTH_TOKEN) headers['Authorization'] = `Bearer ${VPS_AUTH_TOKEN}`
  return headers
}

/**
 * Inicia envio de PIX via MagenPay (POST /pix/enviar).
 * O externalId DEVE ser um UUID único por transação (use crypto.randomUUID()).
 */
export async function sendMagenPixOut(params: MagenPixOutParams): Promise<MagenPixOutResult> {
  const url = `${VPS_BASE_URL}/pix/enviar`
  const body = {
    externalId: params.externalId,
    receiverPixKey: params.receiverPixKey,
    amount: params.amount,
    amountFormat: 'brl',
    description: params.description || 'Pagamento PIX',
  }

  console.log('💸 [MAGEN-PIX-OUT] POST', url, JSON.stringify({ ...body, receiverPixKey: '***' }))

  const res = await fetch(url, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: any = {}
  try { json = JSON.parse(text) } catch { /* ignore */ }

  if (!res.ok) {
    console.error('❌ [MAGEN-PIX-OUT] HTTP', res.status, text)
    throw new Error(`MagenPay PIX Out falhou: ${res.status} ${text.slice(0, 200)}`)
  }

  console.log('✅ [MAGEN-PIX-OUT] resposta:', text)

  const dados = json?.dados || json
  return {
    externalId: dados?.externalId || params.externalId,
    status: dados?.status || 'processing',
    amount: dados?.amount,
    creditor: dados?.creditor,
    finishedAt: dados?.finishedAt,
    raw: json,
  }
}

/**
 * Consulta status de um envio PIX (GET /pix/enviar/status/{externalId}).
 */
export async function checkMagenPixOutStatus(externalId: string): Promise<MagenPixOutResult> {
  const url = `${VPS_BASE_URL}/pix/enviar/status/${encodeURIComponent(externalId)}`
  const res = await fetch(url, { method: 'GET', headers: buildHeaders() })
  const text = await res.text()
  let json: any = {}
  try { json = JSON.parse(text) } catch { /* ignore */ }

  if (!res.ok) {
    console.error('❌ [MAGEN-PIX-OUT-STATUS] HTTP', res.status, text)
    throw new Error(`MagenPay status falhou: ${res.status} ${text.slice(0, 200)}`)
  }

  const dados = json?.dados || json
  return {
    externalId: dados?.externalId || externalId,
    status: dados?.status || 'processing',
    amount: dados?.amount,
    creditor: dados?.creditor,
    finishedAt: dados?.finishedAt,
    raw: json,
  }
}

/**
 * Aguarda conclusão (polling) do envio PIX. Consulta a cada `intervalMs` até `timeoutMs`.
 * Retorna o último resultado obtido, mesmo se ainda 'processing' no timeout.
 */
export async function waitMagenPixOutCompletion(
  externalId: string,
  opts: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<MagenPixOutResult> {
  const interval = opts.intervalMs ?? 5000
  const timeout = opts.timeoutMs ?? 60000
  const start = Date.now()
  let last: MagenPixOutResult | null = null

  while (Date.now() - start < timeout) {
    last = await checkMagenPixOutStatus(externalId)
    console.log(`🔄 [MAGEN-PIX-OUT-POLL] ${externalId} → ${last.status}`)
    if (last.status === 'success' || last.status === 'failed') return last
    await new Promise((r) => setTimeout(r, interval))
  }

  return last ?? { externalId, status: 'processing', raw: null }
}
