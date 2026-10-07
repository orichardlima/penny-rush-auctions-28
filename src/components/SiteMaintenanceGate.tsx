import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Helmet } from 'react-helmet-async';
import { TimerReset, Wrench } from 'lucide-react';
import { useSiteMaintenance } from '@/hooks/useSiteMaintenance';

/**
 * Bloqueia o site inteiro para visitantes/usuários quando o modo de
 * manutenção está ativo em system_settings. Admins continuam navegando
 * normalmente, com um pequeno aviso fixo de que o site está em manutenção.
 */
export const SiteMaintenanceGate = ({ children }: { children: ReactNode }) => {
  const { status, isLocked, isAdmin } = useSiteMaintenance();

  // Evita rolagem do conteúdo embaixo da tela de manutenção.
  useEffect(() => {
    if (isLocked) {
      document.documentElement.style.overflow = 'hidden';
      return () => {
        document.documentElement.style.overflow = '';
      };
    }
  }, [isLocked]);

  if (isLocked) {
    return (
      <>
        <Helmet>
          <title>Manutenção | Show de Lances</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div
          role="alert"
          aria-live="polite"
          className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center"
        >
          <div className="max-w-md w-full">
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-elegant">
                <TimerReset className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
              </div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Show de Lances
              </h1>
            </div>

            <div className="mb-6">
              <Wrench className="w-16 h-16 text-muted-foreground/60 mx-auto animate-pulse" aria-hidden="true" />
            </div>

            <h2 className="text-xl font-semibold text-foreground mb-3">
              Site em Manutenção
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              {status.message}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {isAdmin && status.enabled && (
        <div
          role="status"
          className="fixed bottom-4 left-4 z-[70] flex items-center gap-2 rounded-full border border-border bg-background/95 backdrop-blur-sm px-3 py-1.5 shadow-elegant"
        >
          <Wrench className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
          <span className="text-xs font-medium text-foreground">
            Modo de manutenção ativo — visível apenas para admins
          </span>
        </div>
      )}
      {children}
    </>
  );
};
