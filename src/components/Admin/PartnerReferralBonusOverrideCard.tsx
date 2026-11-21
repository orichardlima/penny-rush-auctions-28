import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Users, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  userId: string;
  planPercentage?: number | null;
}

interface OverrideRow { percentage: number; is_active: boolean; reason: string | null }
interface AuditRow {
  id: string; created_at: string; old_percentage: number | null; new_percentage: number | null;
  new_is_active: boolean | null; reason: string | null;
}

const db = supabase as any;

const PartnerReferralBonusOverrideCard: React.FC<Props> = ({ userId, planPercentage }) => {
  const { toast } = useToast();
  const [override, setOverride] = useState<OverrideRow | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [percentage, setPercentage] = useState('');
  const [reason, setReason] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    const [{ data: row }, { data: rows }] = await Promise.all([
      db.from('partner_referral_bonus_overrides').select('percentage,is_active,reason').eq('user_id', userId).maybeSingle(),
      db.from('partner_referral_bonus_override_audit').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
    ]);
    setOverride(row ?? null);
    setAudit(rows ?? []);
    setPercentage(row ? String(row.percentage) : '');
    setIsActive(row ? row.is_active : true);
    setReason('');
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const submit = async (value: number, active: boolean) => {
    if (reason.trim().length < 3) {
      toast({ variant: 'destructive', title: 'Informe o motivo da alteração' });
      return;
    }
    setSaving(true);
    const { error } = await db.rpc('admin_set_referral_bonus_override', {
      p_user_id: userId, p_percentage: value, p_is_active: active, p_reason: reason.trim(),
    });
    setSaving(false);
    if (error) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: error.message });
      return;
    }
    toast({ title: 'Bônus de indicação atualizado' });
    await load();
  };

  const handleSave = () => {
    const value = Number(String(percentage).replace(',', '.'));
    if (Number.isNaN(value) || value < 0 || value > 50) {
      toast({ variant: 'destructive', title: 'Percentual inválido', description: 'Informe um valor entre 0 e 50.' });
      return;
    }
    void submit(value, isActive);
  };

  const active = override?.is_active;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Bônus de Indicação Individual</CardTitle>
        </div>
        {active ? (
          <Badge variant="default" className="text-[10px]">Exceção ativa: {Number(override!.percentage)}%</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            Usando o plano{planPercentage != null ? `: ${Number(planPercentage)}%` : ''}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Quando ativo, substitui o percentual do plano no bônus de indicação direta (Nível 1) deste parceiro.
          Vale só para novas ativações; bônus já gerados não mudam. Níveis 2 e 3 continuam iguais.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Percentual de indicação (%)</Label>
            <Input type="number" step="0.01" min="0" max="50" value={percentage}
              onChange={(e) => setPercentage(e.target.value)} placeholder="Ex.: 20" disabled={saving} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Motivo (obrigatório)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo da alteração" disabled={saving} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={saving} />
            <span className="text-xs">Exceção ativa</span>
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <Button variant="outline" size="sm" disabled={saving}
                onClick={() => submit(Number(override!.percentage), false)}>
                Voltar ao plano
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || percentage === ''}>Salvar</Button>
          </div>
        </div>
        {audit.length > 0 && (
          <div>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-3 w-3 mr-1" />
              {showHistory ? 'Ocultar histórico' : `Histórico de alterações (${audit.length})`}
            </Button>
            {showHistory && (
              <div className="mt-2 max-h-40 overflow-auto rounded border divide-y">
                {audit.map((row) => (
                  <div key={row.id} className="px-2 py-1.5 text-[11px] flex flex-col gap-0.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">{new Date(row.created_at).toLocaleString('pt-BR')}</span>
                      <span>
                        {row.old_percentage ?? '—'}% → {row.new_percentage ?? '—'}%
                        {row.new_is_active === false ? ' (inativa)' : ''}
                      </span>
                    </div>
                    {row.reason && <span className="text-muted-foreground">{row.reason}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerReferralBonusOverrideCard;
