import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

/**
 * Redirect legado `/investir` → `/parceiro`.
 * Cliente faz replace imediato; adicionamos noindex + canonical para
 * garantir que a rota antiga não indexe. Um 301 no CDN deve ser
 * configurado externamente (Cloudflare/registrar) — Lovable hosting
 * não expõe _redirects/vercel.json.
 */
export default function InvestirRedirect() {
  useEffect(() => {
    // Fallback histórico para páginas indexadas
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/parceiro');
    }
  }, []);

  return (
    <>
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="/parceiro" />
        <title>Programa de Parceiros — Show de Lances</title>
      </Helmet>
      <Navigate to="/parceiro" replace />
    </>
  );
}
