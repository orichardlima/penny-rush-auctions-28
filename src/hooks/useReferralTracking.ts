import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const REFERRAL_COOKIE_KEY = 'ref_code';
const REFERRAL_STORAGE_KEY = 'affiliate_referral';
const COOKIE_EXPIRY_DAYS = 30;

export const useReferralTracking = () => {
  useEffect(() => {
    const trackReferral = async () => {
      // Verificar se já existe referral salvo
      const existingRef = localStorage.getItem(REFERRAL_STORAGE_KEY);
      if (existingRef) {
        return; // Já tem referral tracking ativo
      }

      // Capturar código de referral da URL
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref');

      if (refCode) {
        // Salvar no localStorage
        localStorage.setItem(REFERRAL_STORAGE_KEY, refCode);
        
        // Salvar no cookie (30 dias)
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
        document.cookie = `${REFERRAL_COOKIE_KEY}=${refCode}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;

        // Buscar ID do afiliado
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id')
          .eq('affiliate_code', refCode)
          .eq('status', 'active')
          .single();

        if (affiliate) {
          // Registrar clique - o trigger increment_affiliate_clicks vai incrementar total_referrals automaticamente
          try {
            await supabase.from('affiliate_referrals').insert({
              affiliate_id: affiliate.id,
              click_source: window.location.href,
              ip_address: null,
              user_agent: navigator.userAgent
              // referred_user_id = null indica que é um CLIQUE (não um cadastro ainda)
            });
            // O trigger on_affiliate_click incrementa total_referrals automaticamente
            // Não precisamos fazer UPDATE aqui (que falharia por RLS de qualquer forma)
          } catch (error) {
            console.error('Error tracking click:', error);
          }
        }
      }
    };

    trackReferral();
  }, []);
};

// Função auxiliar para obter código de referral atual
export const getReferralCode = (): string | null => {
  // Tentar localStorage primeiro
  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (stored) return stored;

  // Fallback para cookie
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === REFERRAL_COOKIE_KEY) {
      return value;
    }
  }

  return null;
};

// Função para limpar tracking (usado após conversão)
export const clearReferralTracking = () => {
  localStorage.removeItem(REFERRAL_STORAGE_KEY);
  document.cookie = `${REFERRAL_COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};
