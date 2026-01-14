import { useEffect } from 'react';

const PARTNER_REFERRAL_KEY = 'partner_referral';

export const usePartnerReferralTracking = () => {
  useEffect(() => {
    // Verificar se já existe referral salvo
    const existingRef = localStorage.getItem(PARTNER_REFERRAL_KEY);
    if (existingRef) {
      return; // Já tem referral tracking ativo
    }

    // Capturar código de referral da URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      // Salvar no localStorage
      localStorage.setItem(PARTNER_REFERRAL_KEY, refCode);
      console.log('[PartnerReferral] Código de indicação salvo:', refCode);
    }
  }, []);
};

// Função auxiliar para obter código de referral atual
export const getPartnerReferralCode = (): string | null => {
  return localStorage.getItem(PARTNER_REFERRAL_KEY);
};

// Função para limpar tracking (usado após criação do contrato)
export const clearPartnerReferralTracking = () => {
  localStorage.removeItem(PARTNER_REFERRAL_KEY);
  console.log('[PartnerReferral] Código de indicação limpo');
};
