import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Chave PÚBLICA do Cloudflare Turnstile (site key). A chave secreta fica
 * somente no painel do Supabase (Auth → Bot and Abuse Protection).
 * Enquanto vazia, o widget não aparece e os formulários seguem como antes.
 */
export const TURNSTILE_SITE_KEY = '';
export const turnstileEnabled = TURNSTILE_SITE_KEY.length > 0;

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;
const loadScript = () => {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { scriptPromise = null; reject(new Error('turnstile')); };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
};

export interface TurnstileHandle { reset: () => void }

interface Props { onToken: (token: string | null) => void }

export const TurnstileWidget = forwardRef<TurnstileHandle, Props>(({ onToken }, ref) => {
  const box = useRef<HTMLDivElement>(null);
  const id = useRef<string | null>(null);
  const cb = useRef(onToken);
  cb.current = onToken;

  useImperativeHandle(ref, () => ({
    reset: () => { cb.current(null); if (id.current) window.turnstile?.reset(id.current); },
  }));

  useEffect(() => {
    if (!turnstileEnabled) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return;
      id.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: 'pt-br',
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      });
    }).catch(() => cb.current(null));
    return () => {
      cancelled = true;
      if (id.current) window.turnstile?.remove(id.current);
      id.current = null;
    };
  }, []);

  if (!turnstileEnabled) return null;
  return <div ref={box} className="flex justify-center" />;
});
TurnstileWidget.displayName = 'TurnstileWidget';
