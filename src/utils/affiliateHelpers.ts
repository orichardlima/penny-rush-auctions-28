import { supabase } from "@/integrations/supabase/client";

export type AffiliateEligibility =
  | { eligible: true; role: 'manager'; managerAffiliateId: null }
  | { eligible: true; role: 'influencer'; managerAffiliateId: string; managerCode: string }
  | { eligible: false; reason: 'already_affiliate' | 'not_eligible' };

/**
 * Verifica elegibilidade do usuário para entrar no programa de afiliados.
 * Regras:
 *  - Já é afiliado -> não recria.
 *  - Tem partner_contract ATIVO -> manager.
 *  - Tem código de referral salvo apontando para um Manager ativo -> influencer.
 *  - Caso contrário -> bloqueado.
 */
export const checkAffiliateEligibility = async (userId: string): Promise<AffiliateEligibility> => {
  // 1. Já é afiliado?
  const { data: existing } = await supabase
    .from('affiliates')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();
  if (existing) return { eligible: false, reason: 'already_affiliate' };

  // 2. Parceiro ativo?
  const { data: partner } = await supabase
    .from('partner_contracts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle();
  if (partner) {
    return { eligible: true, role: 'manager', managerAffiliateId: null };
  }

  // 3. Convite de manager via referral code (URL/cookie/localStorage)?
  const { getReferralCode } = await import('@/hooks/useReferralTracking');
  const refCode = getReferralCode();
  if (refCode) {
    const { data: manager } = await supabase
      .from('affiliates')
      .select('id, affiliate_code, role, status')
      .eq('affiliate_code', refCode)
      .eq('role', 'manager')
      .eq('status', 'active')
      .maybeSingle();
    if (manager) {
      return {
        eligible: true,
        role: 'influencer',
        managerAffiliateId: manager.id,
        managerCode: manager.affiliate_code,
      };
    }
  }

  return { eligible: false, reason: 'not_eligible' };
};

/**
 * Gera um código único de afiliado baseado no nome e ID do usuário.
 */
export const generateAffiliateCode = (userId: string, fullName: string | null): string => {
  const firstName = fullName 
    ? fullName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
    : 'USER';
  const userIdSuffix = userId.slice(-4).toUpperCase();
  return `${firstName}${userIdSuffix}`;
};

export const checkCodeAvailability = async (code: string): Promise<boolean> => {
  const { data, error } = await supabase
    .rpc('check_affiliate_code_availability', { code_to_check: code });
  if (error) {
    console.error('Error checking code availability:', error);
    return false;
  }
  return data === true;
};

const fetchNumberSetting = async (key: string, fallback: number): Promise<number> => {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .maybeSingle();
    if (data?.setting_value) {
      const parsed = parseFloat(data.setting_value);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (e) {
    console.warn(`Could not fetch setting ${key}, using fallback ${fallback}`);
  }
  return fallback;
};

/**
 * Cria conta de afiliado respeitando elegibilidade.
 * Apenas Parceiros (=> manager) ou convidados de Manager (=> influencer) podem ativar.
 */
export const createAffiliateAccount = async (
  userId: string,
  fullName: string | null
): Promise<{ success: boolean; code?: string; role?: string; error?: string }> => {
  try {
    const eligibility = await checkAffiliateEligibility(userId);
    if (eligibility.eligible === false) {
      if (eligibility.reason === 'already_affiliate') {
        return { success: false, error: 'Você já possui uma conta de afiliado.' };
      }
      return {
        success: false,
        error: 'O programa de afiliados é exclusivo para Parceiros de Expansão e convidados de um Gerente de Afiliados.'
      };
    }

    // Gerar código único
    let affiliateCode = generateAffiliateCode(userId, fullName);
    let isAvailable = await checkCodeAvailability(affiliateCode);
    let attempt = 1;
    while (!isAvailable && attempt < 10) {
      affiliateCode = `${generateAffiliateCode(userId, fullName)}${attempt}`;
      isAvailable = await checkCodeAvailability(affiliateCode);
      attempt++;
    }
    if (!isAvailable) {
      return { success: false, error: 'Não foi possível gerar um código único. Tente novamente.' };
    }

    // Buscar taxas conforme tipo
    const isManager = eligibility.role === 'manager';
    const commissionRate = await fetchNumberSetting(
      isManager ? 'affiliate_manager_commission_rate' : 'affiliate_influencer_commission_rate',
      isManager ? 50 : 10
    );
    const repurchaseRate = await fetchNumberSetting(
      isManager ? 'affiliate_manager_repurchase_rate' : 'affiliate_influencer_repurchase_rate',
      isManager ? 10 : 5
    );

    const insertPayload: any = {
      user_id: userId,
      affiliate_code: affiliateCode,
      status: 'pending',
      role: eligibility.role,
      commission_rate: commissionRate,
      repurchase_commission_rate: repurchaseRate,
      total_referrals: 0,
      total_conversions: 0,
      commission_balance: 0,
      total_commission_earned: 0,
      total_commission_paid: 0,
    };

    if (eligibility.role === 'influencer') {
      insertPayload.source_manager_affiliate_id = eligibility.managerAffiliateId;
      insertPayload.recruited_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('affiliates')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating affiliate account:', error);
      if (error.code === '23505') {
        return { success: false, error: 'Este código de afiliado já existe. Tente novamente.' };
      }
      if (error.code === '42501' || /row-level security/i.test(error.message || '')) {
        return {
          success: false,
          error: 'Você não tem permissão para ativar conta de afiliado. O programa é exclusivo para Parceiros e convidados de Gerente.'
        };
      }
      return { success: false, error: 'Erro ao criar conta de afiliado. Tente novamente.' };
    }

    // Se influencer: criar vínculo no affiliate_managers + audit
    if (eligibility.role === 'influencer') {
      try {
        const overrideRate = await fetchNumberSetting('affiliate_default_override_rate', 2);
        const { error: linkErr } = await (supabase
          .from('affiliate_managers' as any)
          .insert({
            manager_affiliate_id: eligibility.managerAffiliateId,
            influencer_affiliate_id: data.id,
            override_rate: overrideRate,
            status: 'active',
          }) as any);

        if (linkErr && linkErr.code !== '23505') {
          console.error('Manager link insert error:', linkErr);
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await (supabase.from('affiliate_manager_audit' as any).insert({
              manager_affiliate_id: eligibility.managerAffiliateId,
              influencer_affiliate_id: data.id,
              action_type: 'linked',
              performed_by: user.id,
              new_value: { status: 'active', override_rate: overrideRate, source: 'invite_via_ref' },
              notes: `Recrutamento via link ?ref=${eligibility.managerCode}`,
            }) as any);
          }
        }
      } catch (linkErr) {
        console.warn('Auto-link to manager failed (non-blocking):', linkErr);
      }
    }

    return { success: true, code: affiliateCode, role: eligibility.role };
  } catch (error) {
    console.error('Error in createAffiliateAccount:', error);
    return { success: false, error: 'Erro inesperado ao criar conta de afiliado.' };
  }
};
