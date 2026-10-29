import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

export async function prepareMagenCharge(sb: any, reference: string, amount: number, authorization?: string) {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !authorization?.startsWith('Bearer ')) throw new Error('Sessão obrigatória para gerar PIX MagenPay');
  const client = createClient(url, key);
  const { data, error } = await client.auth.getUser(authorization.slice(7));
  if (error || !data.user) throw new Error('Sessão inválida');
  const userId = data.user.id;
  const { data: profile } = await sb.from('profiles').select('cpf, full_name, profile_complete, is_blocked').eq('user_id', userId).single();
  const cpf = String(profile?.cpf || '').replace(/\D/g, '');
  if (!profile?.profile_complete || profile.is_blocked || cpf.length !== 11) throw new Error('Perfil incompleto ou bloqueado');
  const [type, id, target] = reference.split(':');
  let snapshot: Record<string, unknown>; let expected: number;
  if (['upgrade','cotas-upgrade','regularize'].includes(type)) {
    const { data: c } = await sb.from('partner_contracts').select('*').eq('id', id).eq('user_id', userId).single();
    if (!c || c.status !== 'ACTIVE') throw new Error('Contrato inválido');
    if (type === 'regularize') {
      if (c.financial_status === 'paid') throw new Error('Contrato já regularizado');
      expected = Number(c.aporte_value); snapshot = { type, entity_id: id };
    } else {
      if (Number(c.total_received) >= Number(c.total_cap) * .8) throw new Error('Upgrade bloqueado pelo teto');
      const query = sb.from('partner_plans').select('*').eq('is_active', true);
      const { data: plan } = type === 'upgrade' ? await query.eq('id', target).single() : await query.eq('name', c.plan_name).single();
      if (!plan) throw new Error('Plano inválido');
      const cotas = type === 'upgrade' ? 1 : Number(target);
      if (!Number.isInteger(cotas) || cotas < 1 || cotas > plan.max_cotas || (type === 'cotas-upgrade' && cotas <= c.cotas)) throw new Error('Cotas inválidas');
      const newAporte = Number(plan.aporte_value) * cotas;
      expected = newAporte - Number(c.aporte_value);
      snapshot = { type, entity_id: id, previous_plan_name: c.plan_name, previous_cotas: c.cotas, previous_aporte: c.aporte_value,
        new_plan_name: plan.name, new_cotas: cotas, new_aporte: newAporte, new_weekly_cap: Number(plan.weekly_cap)*cotas,
        new_total_cap: Number(plan.total_cap)*cotas, new_bonus_bids: Number(plan.bonus_bids || 0)*cotas };
    }
  } else if (type === 'credit') {
    const { data: d } = await sb.from('partner_credit_debts').select('*').eq('id', id).eq('user_id', userId).single();
    if (!d || ['PAID','WRITTEN_OFF'].includes(d.status)) throw new Error('Dívida inválida');
    expected = target ? Number(target)/100 : Number(d.amount)-Number(d.paid_amount || 0);
    if (expected > Number(d.amount)-Number(d.paid_amount || 0)) throw new Error('Valor acima da dívida');
    snapshot = { type, entity_id: id };
  } else if (type === 'order') {
    const { data: o } = await sb.from('orders').select('*').eq('id', id).eq('winner_id', userId).single();
    if (!o || o.status !== 'awaiting_payment') throw new Error('Pedido inválido');
    expected = Number(o.final_price); snapshot = { type, entity_id: id };
  } else {
    const { data: b } = await sb.from('bid_purchases').select('*').eq('id', reference).eq('user_id', userId).maybeSingle();
    if (b) {
      if (b.payment_status !== 'pending') throw new Error('Compra já processada');
      expected = Number(b.amount_paid); snapshot = { type: 'bid_purchase', entity_id: b.id };
    } else {
      const { data: i } = await sb.from('partner_payment_intents').select('*').eq('id', reference).eq('user_id', userId).single();
      if (!i || i.payment_status !== 'pending') throw new Error('Intenção inválida');
      expected = Number(i.aporte_value); snapshot = { type: 'partner_intent', entity_id: i.id };
    }
  }
  if (!(expected > 0) || !Number.isFinite(amount) || Math.round(expected*100) !== Math.round(amount*100)) throw new Error('Valor do PIX divergente');
  return { user_id: userId, payer_cpf: cpf, payer_name: profile.full_name, snapshot };
}

export async function saveMagenCharge(sb: any, prepared: Awaited<ReturnType<typeof prepareMagenCharge>>, reference: string, result: {transactionId: string; pixCopyPaste: string; amount: number}) {
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(result.transactionId) || !result.pixCopyPaste) throw new Error('Resposta PIX MagenPay inválida');
  const { payer_name: _name, ...charge } = prepared;
  const { data, error } = await sb.from('magenpay_charges').insert({ ...charge, tx_id: result.transactionId, external_reference: reference, amount: result.amount, pix_copy_paste: result.pixCopyPaste }).select('id').single();
  if (error || !data) throw new Error('Não foi possível salvar o vínculo do PIX');
  // Bind the entity before making its charge recoverable.
  const type = prepared.snapshot.type;
  const table = type === 'bid_purchase' ? 'bid_purchases' : type === 'partner_intent' ? 'partner_payment_intents' : type === 'order' ? 'orders' : null;
  if (table) {
    const { error: bindingError } = await sb.from(table).update({payment_id: result.transactionId}).eq('id', prepared.snapshot.entity_id);
    if (bindingError) throw new Error('Não foi possível vincular o PIX ao pedido');
  }
  return data.id as string;
}