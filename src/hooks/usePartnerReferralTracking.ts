import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const PARTNER_REFERRAL_KEY = 'partner_referral';

/**
 * Hook para capturar e armazenar código de indicação de parceiro da URL.
 * Deve ser usado globalmente (App.tsx) para capturar ref em qualquer rota.
 * 
 * Comportamento:
 * - Captura ?ref=XXX de qualquer URL
 * - Normaliza o código (trim + toUpperCase)
 * - Sobrescreve valor existente se houver novo ref na URL
 * - Reage a mudanças de rota
 */
export const usePartnerReferralTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Capturar código de referral da URL
    const urlParams = new URLSearchParams(location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      // Normalizar: trim + toUpperCase
      const normalizedCode = refCode.trim().toUpperCase();
      
      // Verificar se é diferente do que já está salvo
      const existingRef = localStorage.getItem(PARTNER_REFERRAL_KEY);
      
      if (existingRef !== normalizedCode) {
        // Salvar no localStorage (sobrescreve mesmo se existir outro)
        localStorage.setItem(PARTNER_REFERRAL_KEY, normalizedCode);
        console.log('[PartnerReferral] Código de indicação capturado e salvo:', normalizedCode);
      } else {
        console.log('[PartnerReferral] Código já existe no localStorage:', normalizedCode);
      }
    }
  }, [location.search]); // Reagir a mudanças na query string
};

/**
 * Obtém o código de referral atual do localStorage.
 * Retorna null se não existir.
 */
export const getPartnerReferralCode = (): string | null => {
  const code = localStorage.getItem(PARTNER_REFERRAL_KEY);
  // Normalizar ao ler também (para garantir consistência)
  return code ? code.trim().toUpperCase() : null;
};

/**
 * Obtém o código de referral da URL atual (prioritário) ou do localStorage (fallback).
 * Útil para garantir que temos o ref mais recente disponível.
 */
export const getPartnerReferralCodeFromUrlOrStorage = (): string | null => {
  // Primeiro: tentar da URL atual
  const urlParams = new URLSearchParams(window.location.search);
  const urlRef = urlParams.get('ref');
  
  if (urlRef) {
    const normalized = urlRef.trim().toUpperCase();
    console.log('[PartnerReferral] Código obtido da URL:', normalized);
    return normalized;
  }
  
  // Fallback: localStorage
  const storageRef = getPartnerReferralCode();
  if (storageRef) {
    console.log('[PartnerReferral] Código obtido do localStorage:', storageRef);
  }
  
  return storageRef;
};

/**
 * Limpa o código de indicação do localStorage.
 * Usar após criação bem-sucedida do contrato.
 */
export const clearPartnerReferralTracking = () => {
  localStorage.removeItem(PARTNER_REFERRAL_KEY);
  console.log('[PartnerReferral] Código de indicação limpo do localStorage');
};
