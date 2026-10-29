export function validateMagenPaid(charge: {tx_id: string; amount: number; payer_cpf: string}, payload: any) {
  const data = payload?.dados ?? payload;
  if (payload?.sucesso === false) throw new Error('Provider response unsuccessful');
  const status = String(data?.status || 'pending').toLowerCase();
  if (status !== 'paid') return { status };
  const tx = data?.txId;
  const amount = Number(data?.paymentDetails?.amountPaid ?? data?.amount);
  const cpf = String(data?.payerTaxId ?? '').replace(/\D/g, '');
  if (tx !== charge.tx_id) throw new Error('Provider transaction mismatch');
  if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount*100) !== Math.round(Number(charge.amount)*100)) throw new Error('Provider amount mismatch');
  if (cpf.length !== 11 || cpf !== charge.payer_cpf) throw new Error('Provider payer mismatch');
  return { status: 'paid', amount, cpf };
}

export async function confirmMagenCharge(sb: any, charge: any) {
  if (charge.status === 'completed') return {status: 'paid', already_processed: true};
  if (charge.status !== 'pending') return {status: charge.status, processed: false};
  const raw = Deno.env.get('VPS_MAGEN_URL'); const token = Deno.env.get('MAGENPAY_VPS_TOKEN');
  if (!raw || !token) throw new Error('MagenPay VPS configuration missing');
  const base = raw.replace(/\/(pix|pagamento).*$/, '').replace(/\/$/, '');
  const response = await fetch(`${base}/pix/status/${encodeURIComponent(charge.tx_id)}`, {
    headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`MagenPay VPS HTTP ${response.status}`);
  const verified = validateMagenPaid(charge, await response.json());
  if (verified.status !== 'paid') return {status: verified.status, processed: false};
  const {data, error} = await sb.rpc('magenpay_apply_paid', {p_charge_id: charge.id, p_tx_id: charge.tx_id, p_amount: verified.amount, p_cpf: verified.cpf});
  if (error) throw new Error('Atomic payment processing failed');
  return data;
}