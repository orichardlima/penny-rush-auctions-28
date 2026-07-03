import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { FileSignature } from 'lucide-react';

/**
 * Reaceite automático de contrato quando o admin publica uma nova versão.
 * - Chama `check_contract_version_status` para saber se a versão atual do
 *   contrato de apostador ou parceiro é diferente da última aceita.
 * - Bloqueia navegação até o usuário reaceitar (contrato relevante primeiro).
 * - Silencioso em rotas públicas e no /auth.
 */
type Status = {
  bettor: { current: string | null; accepted: string | null; needs_reaccept: boolean };
  partner: { current: string | null; accepted: string | null; needs_reaccept: boolean };
};

const PUBLIC_ROUTES = ['/', '/auth', '/parceiro', '/investir', '/termos', '/privacidade', '/faq', '/contato', '/downloads'];

export function ContractReacceptGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<Status | null>(null);
  const [activeType, setActiveType] = useState<'partner' | 'bettor' | null>(null);
  const [terms, setTerms] = useState<{ version: string; content: string } | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isPublic = PUBLIC_ROUTES.some((r) => location.pathname === r);

  useEffect(() => {
    if (!user || isPublic) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase.rpc('check_contract_version_status', { p_user_id: user.id });
        if (error || !alive || !data) return;
        const st = data as unknown as Status;
        setStatus(st);
        // Contrato de parceiro tem prioridade
        if (st.partner?.needs_reaccept) setActiveType('partner');
        else if (st.bettor?.needs_reaccept) setActiveType('bettor');
        else setActiveType(null);
      } catch (e) {
        console.error('[ContractReacceptGuard] status error:', e);
      }
    })();
    return () => { alive = false; };
  }, [user, location.pathname, isPublic]);

  useEffect(() => {
    if (!activeType || !status) return;
    (async () => {
      const version = status[activeType].current;
      if (!version) return;
      const { data } = await supabase
        .from('contract_versions')
        .select('version, content')
        .eq('contract_type', activeType)
        .eq('version', version)
        .maybeSingle();
      if (data) setTerms({ version: data.version, content: data.content });
    })();
  }, [activeType, status]);

  const handleAccept = async () => {
    if (!activeType || !terms || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('register_contract_acceptance', {
        p_contract_type: activeType,
        p_origin: 'REACCEPT_GUARD',
        p_declaration_text:
          'Li e aceito a versão vigente do contrato apresentada nesta tela.',
        p_partner_contract_id: null,
        p_plan_name: null,
        p_plan_value: null,
        p_ip: null,
        p_user_agent: navigator.userAgent,
        p_browser: null,
        p_os: null,
        p_device: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        p_route: location.pathname,
        p_accepted_at_client: new Date().toISOString(),
        p_payment_reference: null,
        p_extra: { version: terms.version, source: 'reaccept_guard' },
      });
      if (error) throw error;
      toast.success('Aceite registrado. Obrigado.');
      setActiveType(null);
      setTerms(null);
      setAgreed(false);
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao registrar aceite');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {children}
      <AlertDialog open={!!activeType && !!terms}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              Nova versão do contrato — reaceite obrigatório
            </AlertDialogTitle>
            <AlertDialogDescription>
              Publicamos uma nova versão do{' '}
              {activeType === 'partner' ? 'contrato de parceria' : 'contrato do apostador'}.
              Leia e aceite para continuar utilizando a plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {terms && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">Versão vigente: <span className="font-mono">{terms.version}</span></div>
              <ScrollArea className="h-72 border rounded-md p-3 bg-background">
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">{terms.content}</pre>
              </ScrollArea>
              <div className="flex items-start gap-2">
                <Checkbox id="reaccept" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} />
                <Label htmlFor="reaccept" className="text-sm cursor-pointer">
                  Li e aceito a versão vigente do contrato apresentada acima.
                </Label>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <Button onClick={handleAccept} disabled={!agreed || submitting} className="bg-primary">
              {submitting ? 'Registrando…' : 'Aceitar e continuar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
