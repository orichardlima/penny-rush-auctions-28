import { createVeopagDeposit } from './veopag-auth.ts'
import { createMagenDeposit } from './magen-auth.ts'

interface DepositParams {
  amount: number
  externalId: string
  description?: string
  payerName: string
  payerEmail?: string
  payerDocument: string
}

interface DepositResult {
  transactionId: string
  status: string
  pixCopyPaste: string
  qrCodeBase64: string
  qrCodeUrl: string
  amount: number
}

export async function createDeposit(
  supabase: any,
  params: DepositParams
): Promise<DepositResult> {
  // Read active gateway from system_settings
  const { data: setting } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'active_payment_gateway')
    .single()

  const gateway = setting?.setting_value || 'veopag'
  console.log(`🏦 Payment gateway ativo: ${gateway}`)

  if (gateway === 'magenpay') {
    const result = await createMagenDeposit({
      amount: params.amount,
      txId: params.externalId,
      description: params.description,
      payerName: params.payerName,
      payerTaxId: params.payerDocument
    })
    return {
      transactionId: result.transactionId,
      status: result.status,
      pixCopyPaste: result.pixCopyPaste,
      qrCodeBase64: result.qrCodeBase64,
      qrCodeUrl: result.qrCodeUrl,
      amount: result.amount
    }
  }

  // Default: VeoPag
  const result = await createVeopagDeposit({
    amount: params.amount,
    external_id: params.externalId,
    description: params.description,
    payer: {
      name: params.payerName || 'Usuario',
      email: params.payerEmail || '',
      document: params.payerDocument
    }
  })
  return {
    transactionId: result.transactionId,
    status: result.status,
    pixCopyPaste: result.pixCopyPaste,
    qrCodeBase64: result.qrCodeBase64,
    qrCodeUrl: result.qrCodeUrl,
    amount: result.amount
  }
}
