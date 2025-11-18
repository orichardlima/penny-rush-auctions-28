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
    .from('affiliates')
    .select('id')
    .eq('affiliate_code', code)
    .maybeSingle();
  
  // Se encontrou dados (data existe), o código já está em uso (não disponível)
  // Se não encontrou dados (data é null), o código está disponível
  return data === null && !error;
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
    
    // Criar registro de afiliado
    const { data, error } = await supabase
      .from('affiliates')
      .insert({
        user_id: userId,
        affiliate_code: affiliateCode,
        status: 'active',
        commission_rate: 10.00, // Taxa padrão de 10%
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
