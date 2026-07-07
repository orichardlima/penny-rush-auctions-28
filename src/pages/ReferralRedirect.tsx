// [FASE 1A] Rota curta pública /r/:code.
// Chama a Edge Function track-referral (POST), que decide qualificação, dedupe,
// flags, cap e landing. O frontend nunca envia partner_user_id, auth_user_id,
// is_qualified, points_awarded, status ou fraud_flags.
// Em qualquer falha, redireciona para a landing padrão. Não bloqueia o visitante.

import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  getOrCreateVisitorId,
  getStoredPerfUtms,
  setStoredPerfRefCode,
  capturePerfUtmsFromUrl,
} from '@/hooks/useReferralTracking';

const DEFAULT_LANDING = 'https://showdelances.com/';

const goTo = (url: string) => {
  try { window.location.replace(url); }
  catch { window.location.href = url; }
};

const ReferralRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // Fallback duro se o code não passar validação básica.
      if (!code || !/^[A-Za-z0-9_-]{3,64}$/.test(code)) {
        goTo(DEFAULT_LANDING);
        return;
      }

      // Persiste o ref_code para eventual conversão futura (cadastro).
      setStoredPerfRefCode(code);
      capturePerfUtmsFromUrl();

      const visitor_id = getOrCreateVisitorId();
      const utms = getStoredPerfUtms();
      const params = new URLSearchParams(window.location.search);
      const landingParam = params.get('landing') || undefined;
      const session_id = params.get('sid') || undefined;

      // Authorization Bearer só se houver sessão válida (self_click server-side).
      let headers: Record<string, string> | undefined;
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) headers = { Authorization: `Bearer ${token}` };
      } catch { /* noop */ }

      try {
        const { data, error } = await supabase.functions.invoke('track-referral', {
          body: {
            code,
            visitor_id,
            session_id,
            referrer: document.referrer || undefined,
            landing_url: landingParam,
            utm_source: utms.utm_source,
            utm_medium: utms.utm_medium,
            utm_campaign: utms.utm_campaign,
            utm_content: utms.utm_content,
            utm_term: utms.utm_term,
          },
          headers,
        });

        if (cancelled) return;

        if (error) {
          goTo(DEFAULT_LANDING);
          return;
        }

        const landing = (data && typeof data === 'object' && typeof (data as { landing?: unknown }).landing === 'string')
          ? (data as { landing: string }).landing
          : DEFAULT_LANDING;
        goTo(landing);
      } catch {
        if (!cancelled) goTo(DEFAULT_LANDING);
      }
    };

    run();
    return () => { cancelled = true; };
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Redirecionando...</p>
      </div>
    </div>
  );
};

export default ReferralRedirect;
