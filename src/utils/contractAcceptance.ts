import { supabase } from '@/integrations/supabase/client';

export const PARTNER_DECLARATION_TEXT =
  'Declaro que li, compreendi e aceito integralmente o Contrato de Adesão ao Programa de Parceiros da Show de Lances, incluindo as regras de repasses, limite máximo de recebimento, prazo de garantia de 7 dias, multa de 30% em caso de cancelamento após o prazo de garantia, regras de indicação, bônus, lances e demais condições contratuais.';

export const BETTOR_DECLARATION_TEXT =
  'Declaro que li, compreendi e aceito integralmente os Termos de Uso e o Contrato do Apostador da Show de Lances, incluindo as regras de leilões, lances, créditos, bônus e demais condições contratuais.';

async function fetchClientIp(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://api.ipify.org?format=json', { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    const j = await res.json();
    return j?.ip ?? null;
  } catch {
    return null;
  }
}

function parseUserAgent(ua: string) {
  const lower = ua.toLowerCase();
  let browser = 'Outro';
  if (lower.includes('edg/')) browser = 'Edge';
  else if (lower.includes('chrome/')) browser = 'Chrome';
  else if (lower.includes('firefox/')) browser = 'Firefox';
  else if (lower.includes('safari/')) browser = 'Safari';

  let os = 'Outro';
  if (lower.includes('windows')) os = 'Windows';
  else if (lower.includes('android')) os = 'Android';
  else if (lower.includes('iphone') || lower.includes('ipad') || lower.includes('ios')) os = 'iOS';
  else if (lower.includes('mac os')) os = 'macOS';
  else if (lower.includes('linux')) os = 'Linux';

  const device = /mobile|android|iphone/i.test(ua) ? 'mobile' : 'desktop';
  return { browser, os, device };
}

export interface RegisterAcceptanceInput {
  contract_type: 'partner' | 'bettor';
  origin: 'signup' | 'partner_adhesion' | 'partner_upgrade' | 'renewal' | 'amendment';
  declaration_text: string;
  partner_contract_id?: string | null;
  plan_name?: string | null;
  plan_value?: number | null;
  payment_reference?: string | null;
  extra?: Record<string, unknown>;
}

export async function registerContractAcceptance(input: RegisterAcceptanceInput): Promise<string | null> {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const { browser, os, device } = parseUserAgent(ua);
    const ip = await fetchClientIp();
    const route = typeof window !== 'undefined' ? window.location.pathname : null;

    const { data, error } = await supabase.rpc('register_contract_acceptance', {
      p_contract_type: input.contract_type,
      p_origin: input.origin,
      p_declaration_text: input.declaration_text,
      p_partner_contract_id: input.partner_contract_id ?? null,
      p_plan_name: input.plan_name ?? null,
      p_plan_value: input.plan_value ?? null,
      p_ip: ip,
      p_user_agent: ua,
      p_browser: browser,
      p_os: os,
      p_device: device,
      p_route: route,
      p_accepted_at_client: new Date().toISOString(),
      p_payment_reference: input.payment_reference ?? null,
      p_extra: (input.extra ?? {}) as never,
    });

    if (error) {
      console.error('[registerContractAcceptance] erro:', error);
      return null;
    }
    return (data as string) ?? null;
  } catch (e) {
    console.error('[registerContractAcceptance] exceção:', e);
    return null;
  }
}
