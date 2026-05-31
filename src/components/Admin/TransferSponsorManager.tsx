import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowRightLeft, Search, Loader2, AlertTriangle, Building2, User, CheckCircle2 } from 'lucide-react';

interface PartnerHit {
  contract_id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  plan_name: string;
  status: string;
}

interface PreviewData {
  contract_id: string;
  partner_user_id: string;
  partner_name: string | null;
  old_sponsor_user_id: string | null;
  old_sponsor_name: string | null;
  pending_count: number;
  pending_total: number;
  available_count: number;
  available_total: number;
  paid_count: number;
  paid_total: number;
  binary_parent_contract_id: string | null;
  binary_parent_name: string | null;
  binary_position: string | null;
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

const TransferSponsorManager: React.FC = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PartnerHit[]>([]);
  const [selected, setSelected] = useState<PartnerHit | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [destination, setDestination] = useState<'company' | 'partner'>('company');
  const [newSponsorSearch, setNewSponsorSearch] = useState('');
  const [newSponsorResults, setNewSponsorResults] = useState<PartnerHit[]>([]);
  const [newSponsor, setNewSponsor] = useState<PartnerHit | null>(null);
  const [cancelPending, setCancelPending] = useState(true);
  const [reverseAvailable, setReverseAvailable] = useState(true);
  const [removeFromBinary, setRemoveFromBinary] = useState(true);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [executing, setExecuting] = useState(false);

  const searchPartners = async (term: string, setter: (r: PartnerHit[]) => void) => {
    if (term.trim().length < 2) {
      setter([]);
      return;
    }
    setSearching(true);
    try {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .or(`full_name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(20);
      const userIds = (profiles || []).map((p: any) => p.user_id);
      if (!userIds.length) {
        setter([]);
        return;
      }
      const { data: contracts } = await supabase
        .from('partner_contracts')
        .select('id, user_id, plan_name, status')
        .in('user_id', userIds)
        .eq('status', 'ACTIVE');
      const hits: PartnerHit[] = (contracts || []).map((c: any) => {
        const p = (profiles || []).find((x: any) => x.user_id === c.user_id);
        return {
          contract_id: c.id,
          user_id: c.user_id,
          full_name: p?.full_name ?? null,
          email: p?.email ?? null,
          plan_name: c.plan_name,
          status: c.status,
        };
      });
      setter(hits);
    } finally {
      setSearching(false);
    }
  };


  const loadPreview = async (hit: PartnerHit) => {
    setSelected(hit);
    setPreview(null);
    const { data, error } = await supabase.rpc('admin_preview_partner_sponsor_transfer', {
      p_contract_id: hit.contract_id,
    } as any);
    if (error) {
      toast({ title: 'Erro ao carregar prévia', description: error.message, variant: 'destructive' });
      return;
    }
    setPreview(data as any);
  };

  const execute = async () => {
    if (!selected) return;
    setExecuting(true);
    try {
      const { data, error } = await supabase.rpc('admin_transfer_partner_sponsor', {
        p_contract_id: selected.contract_id,
        p_new_sponsor_user_id: destination === 'partner' ? newSponsor?.user_id ?? null : null,
        p_cancel_pending_bonuses: cancelPending,
        p_reverse_available_bonuses: reverseAvailable,
        p_remove_from_binary: removeFromBinary,
        p_reason: reason || null,
      } as any);
      if (error) throw error;
      toast({
        title: 'Transferência concluída',
        description: `Parceiro transferido. ${(data as any)?.cancelled_pending_count || 0} bônus pendentes cancelados, ${(data as any)?.reversed_available_count || 0} disponíveis revertidos.`,
      });
      // reset
      setSelected(null);
      setPreview(null);
      setNewSponsor(null);
      setReason('');
      setConfirming(false);
    } catch (err: any) {
      toast({ title: 'Erro na transferência', description: err.message, variant: 'destructive' });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5" />
          Transferir Patrocinador
        </CardTitle>
        <CardDescription>
          Move um parceiro para outro patrocinador (ou para a Empresa), com opção de cancelar e reverter bônus
          gerados para o antigo upline e desconectar da árvore binária.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Busca de parceiro */}
        <div className="space-y-2">
          <Label>1. Buscar parceiro a transferir</Label>
          <div className="flex gap-2">
            <Input
              placeholder="Nome ou email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchPartners(search, setResults)}
            />
            <Button onClick={() => searchPartners(search, setResults)} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>
          {results.length > 0 && !selected && (
            <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
              {results.map((r) => (
                <button
                  key={r.contract_id}
                  className="w-full text-left p-3 hover:bg-muted transition-colors"
                  onClick={() => loadPreview(r)}
                >
                  <div className="font-medium">{r.full_name || 'Sem nome'}</div>
                  <div className="text-sm text-muted-foreground">{r.email} · {r.plan_name}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && preview && (
          <>
            <Separator />

            {/* Situação atual */}
            <div className="space-y-3">
              <Label>2. Situação atual</Label>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Parceiro:</span>
                  <span className="font-medium">{preview.partner_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Patrocinador atual:</span>
                  <span className="font-medium">
                    {preview.old_sponsor_name || <Badge variant="secondary">Empresa</Badge>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Posição binária:</span>
                  <span className="font-medium">
                    {preview.binary_parent_name
                      ? `${preview.binary_parent_name} (${preview.binary_position})`
                      : <Badge variant="secondary">Sem posição</Badge>}
                  </span>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Pendentes</div>
                    <div className="font-bold">{preview.pending_count}</div>
                    <div className="text-xs">{fmtMoney(preview.pending_total)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Disponíveis</div>
                    <div className="font-bold text-amber-600">{preview.available_count}</div>
                    <div className="text-xs">{fmtMoney(preview.available_total)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground">Já pagos</div>
                    <div className="font-bold text-muted-foreground">{preview.paid_count}</div>
                    <div className="text-xs">{fmtMoney(preview.paid_total)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Destino */}
            <div className="space-y-3">
              <Label>3. Novo destino</Label>
              <RadioGroup value={destination} onValueChange={(v: any) => setDestination(v)}>
                <div className="flex items-center space-x-2 border rounded-md p-3">
                  <RadioGroupItem value="company" id="company" />
                  <label htmlFor="company" className="flex items-center gap-2 cursor-pointer flex-1">
                    <Building2 className="h-4 w-4" />
                    <span>Empresa (órfão — sem patrocinador)</span>
                  </label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3">
                  <RadioGroupItem value="partner" id="partner" />
                  <label htmlFor="partner" className="flex items-center gap-2 cursor-pointer flex-1">
                    <User className="h-4 w-4" />
                    <span>Outro parceiro ativo</span>
                  </label>
                </div>
              </RadioGroup>

              {destination === 'partner' && (
                <div className="space-y-2 pl-6">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Buscar novo patrocinador..."
                      value={newSponsorSearch}
                      onChange={(e) => setNewSponsorSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && searchPartners(newSponsorSearch, setNewSponsorResults)}
                    />
                    <Button variant="outline" onClick={() => searchPartners(newSponsorSearch, setNewSponsorResults)}>
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  {newSponsor ? (
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded p-2">
                      <div className="text-sm">
                        <CheckCircle2 className="h-4 w-4 inline mr-1 text-primary" />
                        {newSponsor.full_name} ({newSponsor.email})
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setNewSponsor(null)}>Trocar</Button>
                    </div>
                  ) : (
                    newSponsorResults.length > 0 && (
                      <div className="border rounded-md divide-y max-h-40 overflow-y-auto">
                        {newSponsorResults.map((r) => (
                          <button
                            key={r.contract_id}
                            className="w-full text-left p-2 hover:bg-muted text-sm"
                            onClick={() => { setNewSponsor(r); setNewSponsorResults([]); }}
                          >
                            {r.full_name} · {r.email}
                          </button>
                        ))}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* Opções de reversão */}
            <div className="space-y-3">
              <Label>4. Opções de reversão (aplicam ao antigo patrocinador)</Label>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox id="pending" checked={cancelPending} onCheckedChange={(v) => setCancelPending(!!v)} />
                  <div>
                    <label htmlFor="pending" className="cursor-pointer text-sm font-medium">
                      Cancelar bônus PENDENTES ({preview.pending_count} · {fmtMoney(preview.pending_total)})
                    </label>
                    <p className="text-xs text-muted-foreground">Bônus que ainda não viraram disponíveis.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="available" checked={reverseAvailable} onCheckedChange={(v) => setReverseAvailable(!!v)} />
                  <div>
                    <label htmlFor="available" className="cursor-pointer text-sm font-medium">
                      Reverter bônus DISPONÍVEIS não sacados ({preview.available_count} · {fmtMoney(preview.available_total)})
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Debita do saldo disponível do antigo patrocinador.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox id="binary" checked={removeFromBinary} onCheckedChange={(v) => setRemoveFromBinary(!!v)} />
                  <div>
                    <label htmlFor="binary" className="cursor-pointer text-sm font-medium">
                      Remover da árvore binária
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Desconecta a posição. Pontos acumulados nos uplines devem ser recalculados manualmente
                      (mesma regra usada na realocação binária).
                    </p>
                  </div>
                </div>
              </div>

              {preview.paid_count > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Bônus já pagos não são revertidos</AlertTitle>
                  <AlertDescription>
                    O antigo patrocinador já recebeu {fmtMoney(preview.paid_total)} desta indicação. Esses valores
                    permanecem como definitivos.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label>5. Motivo (auditoria)</Label>
              <Textarea
                placeholder="Ex.: Parceira solicitou desligamento da rede após divergência..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setSelected(null); setPreview(null); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => setConfirming(true)}
                disabled={destination === 'partner' && !newSponsor}
              >
                Revisar e confirmar
              </Button>
            </div>
          </>
        )}

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar transferência de patrocinador</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <div><strong>{preview?.partner_name}</strong> deixará a rede de{' '}
                    <strong>{preview?.old_sponsor_name || 'Empresa'}</strong> e irá para{' '}
                    <strong>{destination === 'company' ? 'Empresa' : newSponsor?.full_name}</strong>.
                  </div>
                  <ul className="list-disc pl-5">
                    {cancelPending && <li>Cancela {preview?.pending_count} bônus PENDENTES ({fmtMoney(preview?.pending_total || 0)})</li>}
                    {reverseAvailable && <li>Reverte {preview?.available_count} bônus DISPONÍVEIS ({fmtMoney(preview?.available_total || 0)}) — debita saldo</li>}
                    {removeFromBinary && <li>Desconecta da árvore binária</li>}
                  </ul>
                  <div className="text-destructive font-medium">Esta ação não pode ser desfeita automaticamente.</div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={executing}>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={execute} disabled={executing}>
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirmar transferência
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default TransferSponsorManager;
