import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const REFERRAL_COOKIE_KEY = 'ref_code';
const REFERRAL_STORAGE_KEY = 'affiliate_referral';
const COOKIE_EXPIRY_DAYS = 30;

export const useReferralTracking = () => {
  useEffect(() => {
    // [FASE 1A] Captura passiva de UTMs + referrer para performance de parceiros.
    // Não afeta o fluxo de afiliados abaixo.
    try { capturePerfUtmsFromUrl(); } catch { /* noop */ }

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

// ============================================================================
// [FASE 1A] Helpers do sistema de performance de parceiros.
// Independentes do fluxo de afiliados acima. NÃO alteram sponsor, patrocinador,
// binário, contratos, comissões, payout ou afiliados financeiros.
// ============================================================================

const PERF_VISITOR_KEY = 'perf_visitor_id';
const PERF_REF_CODE_KEY = 'perf_ref_code';
const PERF_UTM_KEY = 'perf_utm';
const PERF_REFERRER_KEY = 'perf_referrer';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export type PerfUtms = Partial<Record<(typeof UTM_KEYS)[number], string>>;

function randomId(): string {
  try {
    // crypto.randomUUID disponível em browsers modernos
    // fallback abaixo caso indisponível
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return c.randomUUID();
    const bytes = new Uint8Array(16);
    c?.getRandomValues?.(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

export function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(PERF_VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = randomId();
    localStorage.setItem(PERF_VISITOR_KEY, fresh);
    return fresh;
  } catch {
    return randomId();
  }
}

export function getStoredPerfRefCode(): string | null {
  try { return localStorage.getItem(PERF_REF_CODE_KEY); } catch { return null; }
}

export function setStoredPerfRefCode(code: string): void {
  try { localStorage.setItem(PERF_REF_CODE_KEY, code); } catch { /* noop */ }
}

export function getStoredPerfUtms(): PerfUtms {
  try {
    const raw = localStorage.getItem(PERF_UTM_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

export function capturePerfUtmsFromUrl(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const utms: PerfUtms = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) utms[k] = v.slice(0, 100);
    }
    if (Object.keys(utms).length > 0) {
      localStorage.setItem(PERF_UTM_KEY, JSON.stringify(utms));
    }
    const ref = document.referrer;
    if (ref && !localStorage.getItem(PERF_REFERRER_KEY)) {
      localStorage.setItem(PERF_REFERRER_KEY, ref.slice(0, 500));
    }
  } catch { /* noop */ }
}

export function getStoredPerfReferrer(): string | null {
  try { return localStorage.getItem(PERF_REFERRER_KEY); } catch { return null; }
}
