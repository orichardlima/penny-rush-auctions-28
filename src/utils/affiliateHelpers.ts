import { supabase } from "@/integrations/supabase/client";

/**
 * Gera um código único de afiliado baseado no nome e ID do usuário
 * Formato: NOME + últimos 4 caracteres do UUID
 * Exemplo: JOAO4A7B
 */
export const generateAffiliateCode = (userId: string, fullName: string | null): string => {
  // Pegar primeiro nome (ou primeiros caracteres se não houver espaço)
  const firstName = fullName 
    ? fullName.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
    : 'USER';
  
  // Pegar últimos 4 caracteres do UUID
  const userIdSuffix = userId.slice(-4).toUpperCase();
  
  return `${firstName}${userIdSuffix}`;
};

/**
 * Verifica se um código de afiliado já existe no banco
 */
export const checkCodeAvailability = async (code: string): Promise<boolean> => {
  const { data, error } = await supabase
    .rpc('check_affiliate_code_availability', { code_to_check: code });
  
  if (error) {
    console.error('Error checking code availability:', error);
    return false;
  }
  
  // A função retorna true se o código está disponível
  return data === true;
};

/**
 * Cria uma conta de afiliado para o usuário
 */
export const createAffiliateAccount = async (
  userId: string,
  fullName: string | null
): Promise<{ success: boolean; code?: string; error?: string }> => {
  try {
    console.log('Creating affiliate account for:', { userId, fullName });
    
    // Gerar código inicial
    let affiliateCode = generateAffiliateCode(userId, fullName);
    console.log('Generated initial code:', affiliateCode);
    
    // Verificar se código está disponível
    let isAvailable = await checkCodeAvailability(affiliateCode);
    console.log('Code availability:', { code: affiliateCode, isAvailable });
    
    // Se não estiver disponível, adicionar sufixo numérico
    let attempt = 1;
    while (!isAvailable && attempt < 10) {
      affiliateCode = `${generateAffiliateCode(userId, fullName)}${attempt}`;
      isAvailable = await checkCodeAvailability(affiliateCode);
      console.log(`Attempt ${attempt}:`, { code: affiliateCode, isAvailable });
      attempt++;
    }
    
    if (!isAvailable) {
      console.error('Failed to generate unique code after 10 attempts');
      return {
        success: false,
        error: 'Não foi possível gerar um código único. Tente novamente.'
      };
    }
    
    // Buscar taxa de comissão configurada pelo admin
    let defaultCommissionRate = 10;
    try {
      const { data: setting } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'affiliate_default_commission_rate')
        .single();
      
      if (setting?.setting_value) {
        const parsed = parseFloat(setting.setting_value);
        if (!isNaN(parsed) && parsed > 0) {
          defaultCommissionRate = parsed;
        }
      }
      console.log('Using commission rate from system_settings:', defaultCommissionRate);
    } catch (e) {
      console.warn('Could not fetch default commission rate, using fallback:', defaultCommissionRate);
    }
    
    // Criar registro de afiliado
    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: userId,
        affiliate_code: affiliateCode,
        status: 'pending',
        commission_rate: defaultCommissionRate,
        total_referrals: 0,
        total_conversions: 0,
        commission_balance: 0,
        total_commission_earned: 0,
        total_commission_paid: 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating affiliate account:', error);
      
      // Erro específico para código duplicado
      if (error.code === '23505') {
        return {
          success: false,
          error: 'Este código de afiliado já existe. Tente novamente.'
        };
      }
      
      return {
        success: false,
        error: 'Erro ao criar conta de afiliado. Tente novamente.'
      };
    }
    
    console.log('Affiliate account created successfully:', data);

    // 🆕 Recrutamento automático: se o usuário entrou via link ?ref=CODIGO_DE_UM_MANAGER,
    // vincula automaticamente o novo afiliado como influencer desse manager.
    try {
      await tryAutoLinkToManager(data.id);
    } catch (linkErr) {
      console.warn('Auto-link to manager failed (non-blocking):', linkErr);
    }

    return {
      success: true,
      code: affiliateCode
    };
  } catch (error) {
    console.error('Error in createAffiliateAccount:', error);
    return {
      success: false,
      error: 'Erro inesperado ao criar conta de afiliado.'
    };
  }
};

/**
 * Lê o código de referral salvo (de URL/cookie/localStorage) e, se for um manager ativo,
 * cria automaticamente um vínculo em affiliate_managers + atualiza source_manager_affiliate_id.
 * Não interfere no fluxo se não houver código ou se o código for de um afiliado comum.
 */
const tryAutoLinkToManager = async (newAffiliateId: string): Promise<void> => {
  // Importação local para evitar ciclo
  const { getReferralCode } = await import('@/hooks/useReferralTracking');
  const refCode = getReferralCode();
  if (!refCode) return;

  // Buscar afiliado dono do código
  const { data: refAffiliate } = await supabase
    .from('affiliates')
    .select('id, role, status')
    .eq('affiliate_code', refCode)
    .maybeSingle();

  if (!refAffiliate) return;
  if (refAffiliate.id === newAffiliateId) return; // não vincular a si mesmo
  if (refAffiliate.role !== 'manager') return; // só auto-vincula se for manager
  if (refAffiliate.status !== 'active') return;

  // Buscar taxa de override padrão
  let overrideRate = 2;
  try {
    const { data: setting } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'affiliate_default_override_rate')
      .maybeSingle();
    if (setting?.setting_value) {
      const parsed = parseFloat(setting.setting_value);
      if (!isNaN(parsed) && parsed > 0) overrideRate = parsed;
    }
  } catch (e) {
    console.warn('Could not fetch override rate, using default 2%');
  }

  // Criar vínculo (idempotente: se já existe, ignora)
  const { error: linkErr } = await (supabase
    .from('affiliate_managers' as any)
    .insert({
      manager_affiliate_id: refAffiliate.id,
      influencer_affiliate_id: newAffiliateId,
      override_rate: overrideRate,
      status: 'active',
    }) as any);

  if (linkErr && linkErr.code !== '23505') {
    console.error('Auto-link insert error:', linkErr);
    return;
  }

  // Marcar source no afiliado
  await supabase
    .from('affiliates')
    .update({
      source_manager_affiliate_id: refAffiliate.id,
      recruited_at: new Date().toISOString(),
    } as any)
    .eq('id', newAffiliateId);

  // Audit log
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase.from('affiliate_manager_audit' as any).insert({
        manager_affiliate_id: refAffiliate.id,
        influencer_affiliate_id: newAffiliateId,
        action_type: 'linked',
        performed_by: user.id,
        new_value: { status: 'active', override_rate: overrideRate, source: 'auto_link_via_ref' },
        notes: `Recrutamento automático via link ?ref=${refCode}`,
      }) as any);
    }
  } catch (auditErr) {
    console.warn('Audit log failed (non-blocking):', auditErr);
  }

  console.log('✅ Auto-linked new affiliate to manager:', refAffiliate.id);
};
