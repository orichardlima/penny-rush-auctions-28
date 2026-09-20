import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Percent, History } from 'lucide-react';
import { usePartnerRevenueOverride } from '@/hooks/usePartnerRevenueOverride';

interface Props {
  userId: string;
  partnerName?: string;
}

const PartnerRevenueOverrideCard: React.FC<Props> = ({ userId }) => {
  const { override, audit, loading, saving, saveOverride, removeOverride } = usePartnerRevenueOverride(userId);
  const [percentage, setPercentage] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setPercentage(override ? String(override.weekly_percentage) : '');
    setNote(override?.note || '');
    setIsActive(override ? override.is_active : true);
  }, [override]);

  const handleSave = async () => {
    const value = Number(String(percentage).replace(',', '.'));
    if (Number.isNaN(value)) return;
    await saveOverride(value, note, isActive);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <Percent className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Percentual Semanal Específico</CardTitle>
        </div>
        {override?.is_active ? (
          <Badge variant="default" className="text-[10px]">Exceção ativa: {Number(override.weekly_percentage)}%</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">Usando regra geral</Badge>
        )}
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Quando ativo, este percentual substitui o faturamento semanal geral apenas para este parceiro.
          Os limites semanal e total do contrato continuam valendo.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Percentual semanal (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              placeholder="Ex.: 3.5"
              disabled={loading || saving}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observação</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo da exceção"
              disabled={loading || saving}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={loading || saving} />
            <span className="text-xs">Exceção ativa</span>
          </div>
          <div className="flex items-center gap-2">
            {override && (
              <Button variant="outline" size="sm" onClick={removeOverride} disabled={saving}>
                Remover
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || percentage === ''}>
              Salvar
            </Button>
          </div>
        </div>

        {audit.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => setShowHistory((v) => !v)}
            >
              <History className="h-3 w-3 mr-1" />
              {showHistory ? 'Ocultar histórico' : `Histórico de alterações (${audit.length})`}
            </Button>
            {showHistory && (
              <div className="mt-2 max-h-40 overflow-auto rounded border divide-y">
                {audit.map((row) => (
                  <div key={row.id} className="px-2 py-1.5 text-[11px] flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      {new Date(row.created_at).toLocaleString('pt-BR')}
                    </span>
                    <span>
                      {row.action} · {row.old_percentage ?? '—'}% → {row.new_percentage ?? '—'}%
                      {row.new_is_active === false ? ' (inativa)' : ''}
                    </span>
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

export default PartnerRevenueOverrideCard;
