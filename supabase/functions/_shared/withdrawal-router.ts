import { createVeopagWithdrawal } from './veopag-auth.ts'
import { sendMagenPixOut, waitMagenPixOutCompletion } from './magen-payout.ts'

export interface WithdrawalRouterParams {
  amount: number
  externalId: string         // UUID único da transação (NÃO reutilizar)
  pixKey: string
  pixKeyType: string         // valor já mapeado para o gateway (ex.: CPF, EMAIL...)
  taxId?: string
  holderName?: string
  description?: string
}

export interface WithdrawalRouterResult {
  gateway: 'magenpay' | 'veopag'
  status: 'success' | 'processing' | 'failed' | string
  transactionId?: string
  fee?: number
  raw: any
}

export async function sendWithdrawal(
  supabase: any,
  params: WithdrawalRouterParams
): Promise<WithdrawalRouterResult> {
  const { data: setting } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'active_payment_gateway')
    .single()

  const gateway = setting?.setting_value || 'veopag'
  console.log(`🏦 [WITHDRAWAL-ROUTER] gateway=${gateway} externalId=${params.externalId}`)

  if (gateway === 'magenpay') {
    // 1. Disparar envio
    const sent = await sendMagenPixOut({
      amount: params.amount,
      externalId: params.externalId,
      receiverPixKey: params.pixKey,
      description: params.description,
    })

    // 2. Se já veio success/failed, retorna direto
    if (sent.status === 'success' || sent.status === 'failed') {
      return {
        gateway: 'magenpay',
        status: sent.status,
        transactionId: sent.externalId,
        raw: sent.raw,
      }
    }

    // 3. Caso contrário, faz polling até concluir (timeout 60s)
    const final = await waitMagenPixOutCompletion(params.externalId, {
      intervalMs: 5000,
      timeoutMs: 60000,
    })
    return {
      gateway: 'magenpay',
      status: final.status,
      transactionId: final.externalId,
      raw: final.raw,
    }
  }

  // Default: VeoPag (síncrono, status já final)
  const result = await createVeopagWithdrawal({
    amount: params.amount,
    external_id: params.externalId,
    pix_key: params.pixKey,
    key_type: params.pixKeyType as any,
    taxId: params.taxId || params.pixKey,
    name: params.holderName || 'Beneficiario',
    description: params.description || 'Saque',
  })
  return {
    gateway: 'veopag',
    status: 'success',
    transactionId: result.transaction_id,
    fee: result.fee,
    raw: result,
  }
}
