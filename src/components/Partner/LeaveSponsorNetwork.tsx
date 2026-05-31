import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Search, Loader2, LogOut, CheckCircle2, Clock, UserMinus } from 'lucide-react';

interface Props {
  contractId: string;
  partnerFullName: string;
  onChanged?: () => void;
}

interface Eligibility {
  eligible: boolean;
  reason?: string;
  days_since_activation?: number;
  days_until_deadline?: number;
  deadline?: string;
  cooldown_until?: string;
  last_exit_at?: string;
}

interface Preview {
  old_sponsor_name: string | null;
  pending_count: number; pending_total: number;
  available_count: number; available_total: number;
  paid_count: number; paid_total: number;
  binary_parent_name: string | null;
  binary_position: string | null;
}

interface ActiveExit {
  id: string;
  status: string;
  old_sponsor_user_id: string | null;
  expires_at: string;
  cancelled_pending_total: number;
  reversed_available_total: number;
}

interface SponsorHit {
  contract_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan_name: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const reasonLabel = (r?: string) => {
  switch (r) {
    case 'window_expired': return 'O prazo de 30 dias após o cadastro do contrato para sair da rede já expirou.';
    case 'cooldown': return 'Você já saiu de uma rede recentemente. Aguarde o fim do período de carência (90 dias).';
    case 'contract_not_active': return 'Contrato não está ativo.';
    case 'contract_delinquent': return 'Contrato está inadimplente. Regularize antes de solicitar a saída.';
    case 'no_sponsor': return 'Você já está vinculado diretamente à Empresa.';
    case 'exit_in_progress': return 'Você já possui uma saída em andamento.';
    default: return r || 'Indisponível no momento.';
  }
};

const LeaveSponsorNetwork: React.FC<Props> = ({ contractId, partnerFullName, onChanged }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [activeExit, setActiveExit] = useState<ActiveExit | null>(null);
  const [oldSponsorName, setOldSponsorName] = useState<string | null>(null);

  // Form
  const [reason, setReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);

  // Escolha de novo patrocinador
  const [search, setSearch] = useState('');
  const [hits, setHits] = useState<SponsorHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [chosen, setChosen] = useState<SponsorHit | null>(null);
  const [confirmingChoice, setConfirmingChoice] = useState(false);
  const [choosing, setChoosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // exit ativo?
      const { data: exits } = await supabase
        .from('partner_network_exits')
        .select('*')
        .eq('partner_contract_id', contractId)
        .eq('status', 'IN_TRANSIT')
        .order('created_at', { ascending: false })
        .limit(1);
      const ex = (exits || [])[0] as any;
      if (ex) {
        setActiveExit(ex);
        if (ex.old_sponsor_user_id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', ex.old_sponsor_user_id)
            .maybeSingle();
          setOldSponsorName(p?.full_name ?? null);
        }
      } else {
        setActiveExit(null);
      }

      // elegibilidade
      const { data: eRes, error: eErr } = await supabase.rpc(
        'partner_check_leave_eligibility' as any, { p_contract_id: contractId } as any,
      );
      if (eErr) throw eErr;
      setElig(eRes as any);

      // prévia (se ainda tem sponsor)
      if (!ex && (eRes as any)?.eligible !== undefined) {
        try {
          const { data: pRes } = await supabase.rpc(
            'partner_preview_leave_network' as any, { p_contract_id: contractId } as any,
          );
          setPreview(pRes as any);
        } catch {/* sem sponsor: ignora */}
      }
    } catch (err: any) {
      console.error('[LeaveSponsorNetwork] load error', err);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const executeLeave = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc(
        'partner_leave_sponsor_network' as any,
        { p_contract_id: contractId, p_reason: reason || null, p_ip: null } as any,
      );
      if (error) throw error;
      toast({
        title: 'Saída efetivada',
        description: `Você tem 7 dias para escolher um novo patrocinador. ${
          (data as any)?.cancelled_pending_count || 0
        } bônus pendentes cancelados.`,
      });
      setConfirming(false);
      setReason(''); setConfirmName(''); setUnderstood(false);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast({ title: 'Erro ao processar saída', description: err.message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  const searchSponsors = async () => {
    if (search.trim().length < 2) return;
    setSearching(true);
    try {
      const { data, error } = await supabase.rpc(
        'partner_search_eligible_sponsors' as any,
        { p_contract_id: contractId, p_term: search.trim() } as any,
      );
      if (error) throw error;
      setHits((data as any) || []);
    } catch (err: any) {
      toast({ title: 'Erro na busca', description: err.message, variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const confirmChoice = async () => {
    if (!chosen) return;
    setChoosing(true);
    try {
      const { error } = await supabase.rpc(
        'partner_choose_new_sponsor' as any,
        { p_contract_id: contractId, p_new_sponsor_user_id: chosen.user_id } as any,
      );
      if (error) throw error;
      toast({ title: 'Novo patrocinador confirmado', description: `Agora você faz parte da rede de ${chosen.full_name}.` });
      setConfirmingChoice(false);
      setChosen(null); setHits([]); setSearch('');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast({ title: 'Erro ao confirmar', description: err.message, variant: 'destructive' });
    } finally {
      setChoosing(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </CardContent>
      </Card>
    );
  }

  // ===== Estado: em trânsito =====
  if (activeExit) {
    const daysLeft = Math.max(0, Math.ceil(
      (new Date(activeExit.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ));
    return (
      <Card className="border-amber-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-700">
            <Clock className="h-5 w-5" />
            Você está sem patrocinador
          </CardTitle>
          <CardDescription>
            Você saiu da rede de <strong>{oldSponsorName || 'seu antigo patrocinador'}</strong>.
            Restam <strong>{daysLeft} dia(s)</strong> para escolher um novo patrocinador. Se não escolher
            até {new Date(activeExit.expires_at).toLocaleDateString('pt-BR')}, você voltará automaticamente
            para a rede anterior.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/50 rounded p-3">
              <div className="text-xs text-muted-foreground">Bônus pendentes cancelados</div>
              <div className="font-bold">{fmt(activeExit.cancelled_pending_total)}</div>
            </div>
            <div className="bg-muted/50 rounded p-3">
              <div className="text-xs text-muted-foreground">Bônus disponíveis revertidos</div>
              <div className="font-bold">{fmt(activeExit.reversed_available_total)}</div>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Buscar novo patrocinador (nome ou e-mail)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Digite o nome ou e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchSponsors()}
              />
              <Button onClick={searchSponsors} disabled={searching}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {chosen ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded p-2">
                <div className="text-sm">
                  <CheckCircle2 className="h-4 w-4 inline mr-1 text-primary" />
                  {chosen.full_name} ({chosen.email})
                </div>
                <Button variant="ghost" size="sm" onClick={() => setChosen(null)}>Trocar</Button>
              </div>
            ) : hits.length > 0 && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {hits.map((h) => (
                  <button
                    key={h.contract_id}
                    className="w-full text-left p-2 hover:bg-muted text-sm"
                    onClick={() => { setChosen(h); setHits([]); }}
                  >
                    {h.full_name} · {h.email}
                  </button>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Você não pode escolher seu ex-patrocinador nem alguém da sua própria downline.
            </p>
          </div>

          <Button
            className="w-full"
            disabled={!chosen}
            onClick={() => setConfirmingChoice(true)}
          >
            Confirmar novo patrocinador
          </Button>
        </CardContent>

        <AlertDialog open={confirmingChoice} onOpenChange={setConfirmingChoice}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar novo patrocinador</AlertDialogTitle>
              <AlertDialogDescription>
                Você passará a fazer parte da rede de <strong>{chosen?.full_name}</strong>.
                Esta ação encerra o período de trânsito e não pode ser desfeita pelo autoatendimento.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={choosing}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmChoice} disabled={choosing}>
                {choosing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    );
  }

  // ===== Estado: não-elegível =====
  if (elig && !elig.eligible) {
    if (elig.reason === 'no_sponsor') return null; // não mostra para órfãos
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserMinus className="h-5 w-5 text-muted-foreground" />
            Sair da rede do meu patrocinador
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Indisponível no momento</AlertTitle>
            <AlertDescription className="space-y-1">
              <div>{reasonLabel(elig.reason)}</div>
              {elig.reason === 'window_expired' && elig.deadline && (
                <div className="text-xs">Prazo encerrado em {new Date(elig.deadline).toLocaleDateString('pt-BR')}.</div>
              )}
              {elig.reason === 'cooldown' && elig.cooldown_until && (
                <div className="text-xs">
                  Disponível a partir de {new Date(elig.cooldown_until).toLocaleDateString('pt-BR')}.
                </div>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // ===== Estado: elegível =====
  const canConfirm = understood && confirmName.trim().toLowerCase() === partnerFullName.trim().toLowerCase();

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserMinus className="h-5 w-5 text-destructive" />
          Sair da rede do meu patrocinador
        </CardTitle>
        <CardDescription>
          Você tem até 30 dias após o cadastro do contrato para sair da rede do seu patrocinador
          {elig?.deadline && (
            <> (prazo até <strong>{new Date(elig.deadline).toLocaleDateString('pt-BR')}</strong>)</>
          )}
          {elig?.days_until_deadline != null && (
            <> — restam <strong>{elig.days_until_deadline} dia(s)</strong></>
          )}
          . Após confirmar, você terá 7 dias para escolher um novo patrocinador; caso contrário, voltará automaticamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Patrocinador atual:</span>
              <span className="font-medium">{preview.old_sponsor_name || <Badge variant="secondary">Empresa</Badge>}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-3 gap-2 pt-2 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Bônus pendentes</div>
                <div className="font-bold">{fmt(preview.pending_total)}</div>
                <div className="text-xs text-muted-foreground">{preview.pending_count} bônus</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Disponíveis (não sacados)</div>
                <div className="font-bold text-amber-600">{fmt(preview.available_total)}</div>
                <div className="text-xs text-muted-foreground">{preview.available_count} bônus</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Já pagos (não revertem)</div>
                <div className="font-bold text-muted-foreground">{fmt(preview.paid_total)}</div>
                <div className="text-xs text-muted-foreground">{preview.paid_count} bônus</div>
              </div>
            </div>
          </div>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O que acontece quando você sai</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <div>• Bônus pendentes do seu patrocinador originados de você serão <strong>cancelados</strong>.</div>
            <div>• Bônus já disponíveis e ainda não sacados serão <strong>revertidos</strong> (debitados do saldo dele).</div>
            <div>• Bônus já pagos permanecem (não há reversão).</div>
            <div>• Você será desconectado da posição binária atual.</div>
            <div>• Você terá <strong>7 dias</strong> para escolher um novo patrocinador, senão volta para o atual.</div>
            <div>• Após concluir, só poderá sair novamente após <strong>90 dias</strong>.</div>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>Motivo (opcional)</Label>
          <Textarea
            placeholder="Ex.: Incompatibilidade pessoal, falta de suporte..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
        </div>

        <Button variant="destructive" onClick={() => setConfirming(true)} className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Solicitar saída da rede
        </Button>
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar saída da rede</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <div>
                  Você sairá da rede de <strong>{preview?.old_sponsor_name || 'seu patrocinador'}</strong>.
                  Para confirmar, digite seu nome completo abaixo:
                </div>
                <div className="text-xs text-muted-foreground">
                  Nome esperado: <strong>{partnerFullName}</strong>
                </div>
                <Input
                  placeholder="Digite seu nome completo"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
                <div className="flex items-start gap-2">
                  <Checkbox id="understood" checked={understood} onCheckedChange={(v) => setUnderstood(!!v)} />
                  <label htmlFor="understood" className="text-xs cursor-pointer">
                    Entendo que esta ação é irreversível, que tenho 7 dias para escolher um novo patrocinador
                    e que, caso eu não escolha, voltarei automaticamente para o patrocinador atual.
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={executing}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeLeave}
              disabled={executing || !canConfirm}
              className="bg-destructive hover:bg-destructive/90"
            >
              {executing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar saída
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default LeaveSponsorNetwork;
