import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Eye, KeyRound, Loader2, AlertTriangle, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsSuperAdmin } from '@/hooks/useIsSuperAdmin';
import { Badge } from '@/components/ui/badge';

interface Props {
  targetUserId: string;
  targetName?: string;
}

interface SnapshotData {
  profile: any;
  contracts: any[];
}

/**
 * Botões de impersonation visíveis apenas para o super-admin.
 * - Ver como: chama edge function e mostra dialog read-only com perfil+contratos.
 * - Acessar como: gera magic link e abre em nova aba.
 * Ambos exigem motivo escrito de no mínimo 10 caracteres.
 */
export const ImpersonateActions: React.FC<Props> = ({ targetUserId, targetName }) => {
  const { isSuperAdmin, loading } = useIsSuperAdmin();
  const { toast } = useToast();
  const [mode, setMode] = useState<'view_as' | 'login_as' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);

  if (loading || !isSuperAdmin) return null;

  const reset = () => {
    setMode(null); setReason(''); setSnapshot(null); setMagicLink(null);
  };

  const submit = async () => {
    if (!mode || reason.trim().length < 10) {
      toast({ variant: 'destructive', title: 'Motivo obrigatório', description: 'Mínimo de 10 caracteres.' });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-impersonate-user', {
        body: { target_user_id: targetUserId, reason: reason.trim(), mode },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? 'Erro');

      if (mode === 'view_as') {
        setSnapshot(data.snapshot);
      } else {
        setMagicLink(data.action_link);
        window.open(data.action_link, '_blank', 'noopener,noreferrer');
      }
      toast({ title: 'Registrado em auditoria', description: `Acesso ${mode === 'view_as' ? 'de visualização' : 'completo'} liberado.` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Falha', description: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline" size="sm" title="Ver como (somente leitura)"
        onClick={() => setMode('view_as')}
        className="text-blue-600 border-blue-300 hover:bg-blue-50"
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        variant="outline" size="sm" title="Acessar como este parceiro"
        onClick={() => setMode('login_as')}
        className="text-orange-600 border-orange-300 hover:bg-orange-50"
      >
        <KeyRound className="h-4 w-4" />
      </Button>

      <Dialog open={mode !== null} onOpenChange={(o) => !o && reset()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'login_as' ? <KeyRound className="h-5 w-5 text-orange-600" /> : <Eye className="h-5 w-5 text-blue-600" />}
              {mode === 'login_as' ? 'Acessar como parceiro' : 'Visualizar como parceiro'}
            </DialogTitle>
            <DialogDescription>
              {targetName ? <>Alvo: <b>{targetName}</b>. </> : null}
              {mode === 'login_as'
                ? 'Você entrará no app logado como este parceiro. Todas as ações ficam registradas com seu nome no log de auditoria.'
                : 'Visualização somente leitura dos dados principais. Não permite executar ações.'}
            </DialogDescription>
          </DialogHeader>

          {!snapshot && !magicLink && (
            <div className="space-y-3">
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900 flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>Descreva por que você precisa deste acesso. Esse texto fica gravado e visível na auditoria.</div>
              </div>
              <div>
                <Label htmlFor="reason">Motivo (mínimo 10 caracteres)</Label>
                <Textarea
                  id="reason" value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: ticket #1234 — parceiro relatou PIX bloqueado, preciso verificar configuração."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1">{reason.trim().length}/10 caracteres</p>
              </div>
            </div>
          )}

          {snapshot && (
            <div className="space-y-4 text-sm">
              <div className="border rounded-md p-3 bg-muted/40">
                <h4 className="font-semibold mb-2">Perfil</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Nome:</span> {snapshot.profile?.full_name ?? '—'}</div>
                  <div><span className="text-muted-foreground">E-mail:</span> {snapshot.profile?.email ?? '—'}</div>
                  <div><span className="text-muted-foreground">CPF:</span> {snapshot.profile?.cpf ?? '—'}</div>
                  <div><span className="text-muted-foreground">Telefone:</span> {snapshot.profile?.phone ?? '—'}</div>
                  <div><span className="text-muted-foreground">Saldo de lances:</span> {snapshot.profile?.bids_balance ?? 0}</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Contratos ({snapshot.contracts?.length ?? 0})</h4>
                <div className="space-y-2">
                  {snapshot.contracts?.map((c: any) => (
                    <div key={c.id} className="border rounded-md p-2 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium">{c.plan_name}</span>
                        <Badge variant="outline">{c.status}</Badge>
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-1 text-muted-foreground">
                        <div>Aporte: R$ {Number(c.aporte_value).toFixed(2)}</div>
                        <div>Recebido: R$ {Number(c.total_received).toFixed(2)}</div>
                        <div>Saldo: R$ {Number(c.available_balance).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {magicLink && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border border-green-200 bg-green-50 p-3 text-green-900">
                Link aberto em nova aba. Caso o popup tenha sido bloqueado, copie o link abaixo e abra manualmente em uma janela anônima.
              </div>
              <div className="flex gap-2">
                <input className="flex-1 px-2 py-1 border rounded text-xs font-mono" readOnly value={magicLink} />
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(magicLink); toast({ title: 'Copiado' }); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Este link é de uso único e expira rapidamente. Não compartilhe.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={reset}>Fechar</Button>
            {!snapshot && !magicLink && (
              <Button onClick={submit} disabled={submitting || reason.trim().length < 10}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar e registrar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImpersonateActions;
