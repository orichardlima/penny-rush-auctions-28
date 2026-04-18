import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Unlock, Save, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface OpenWinModeCardProps {
  auctionId: string;
  auctionTitle: string;
}

type LeaderInfo =
  | { kind: 'none' }
  | { kind: 'bot'; name: string }
  | { kind: 'real'; userId: string; name: string; bidCount: number; eligible: boolean; reason: string };

export const OpenWinModeCard: React.FC<OpenWinModeCardProps> = ({ auctionId, auctionTitle }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [openWinMode, setOpenWinMode] = useState(false);
  const [minBids, setMinBids] = useState(0);
  const [initial, setInitial] = useState({ openWinMode: false, minBids: 0 });
  const [predefinedIds, setPredefinedIds] = useState<string[]>([]);
  const [leader, setLeader] = useState<LeaderInfo>({ kind: 'none' });
  const [saving, setSaving] = useState(false);

  const refreshState = async () => {
    const { data: a } = await supabase
      .from('auctions')
      .select('open_win_mode, min_bids_to_qualify, predefined_winner_ids, predefined_winner_id')
      .eq('id', auctionId)
      .single();

    if (!a) return;
    const ax = a as any;
    const own = ax.open_win_mode === true;
    const mb = Number(ax.min_bids_to_qualify || 0);
    setOpenWinMode(own);
    setMinBids(mb);
    setInitial({ openWinMode: own, minBids: mb });
    const arr: string[] = Array.isArray(ax.predefined_winner_ids) ? ax.predefined_winner_ids : [];
    const legacy = ax.predefined_winner_id ? [ax.predefined_winner_id] : [];
    const ids = Array.from(new Set([...arr, ...legacy]));
    setPredefinedIds(ids);

    // Status do líder
    const { data: lastBid } = await supabase
      .from('bids')
      .select('user_id')
      .eq('auction_id', auctionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastBid?.user_id) {
      setLeader({ kind: 'none' });
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, is_bot')
      .eq('user_id', lastBid.user_id)
      .single();

    const name = profile?.full_name || 'Sem nome';
    if (profile?.is_bot) {
      setLeader({ kind: 'bot', name });
      return;
    }

    const { count } = await supabase
      .from('bids')
      .select('id', { count: 'exact', head: true })
      .eq('auction_id', auctionId)
      .eq('user_id', lastBid.user_id);

    const bidCount = count || 0;
    const isPredefined = ids.includes(lastBid.user_id);
    let eligible = false;
    let reason = '';
    if (isPredefined) {
      eligible = true;
      reason = 'Vencedor predefinido';
    } else if (own) {
      if (mb <= 0) {
        eligible = true;
        reason = 'Modo aberto (sem mínimo)';
      } else if (bidCount >= mb) {
        eligible = true;
        reason = `Modo aberto (${bidCount}/${mb} lances)`;
      } else {
        eligible = false;
        reason = `Modo aberto, mas ${bidCount}/${mb} lances`;
      }
    } else {
      eligible = false;
      reason = 'Modo aberto desligado';
    }

    setLeader({ kind: 'real', userId: lastBid.user_id, name, bidCount, eligible, reason });
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auctionId]);

  const dirty = openWinMode !== initial.openWinMode || minBids !== initial.minBids;

  const handleSave = async () => {
    setSaving(true);
    try {
      const safeMin = Math.max(0, Math.floor(Number(minBids) || 0));
      const { error } = await supabase
        .from('auctions')
        .update({ open_win_mode: openWinMode, min_bids_to_qualify: safeMin } as any)
        .eq('id', auctionId);

      if (error) throw error;

      await supabase.from('admin_audit_log').insert({
        admin_user_id: user!.id,
        admin_name: user!.email || 'Admin',
        action_type: 'update_open_win_config',
        target_type: 'auction',
        target_id: auctionId,
        description: `Configuração de liberação alterada em "${auctionTitle}": open_win=${openWinMode ? 'ON' : 'OFF'}, min_bids=${safeMin}`,
        old_values: initial as any,
        new_values: { openWinMode, minBids: safeMin } as any,
      });

      toast({ title: 'Configuração salva', description: 'Modo de liberação atualizado.' });
      setInitial({ openWinMode, minBids: safeMin });
      await refreshState();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const renderLeaderBadge = () => {
    if (leader.kind === 'none') return <Badge variant="outline">⚪ Sem lances ainda</Badge>;
    if (leader.kind === 'bot') return <Badge variant="secondary">🤖 Bot lidera ({leader.name})</Badge>;
    if (leader.eligible)
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">🟢 {leader.name} lidera — bots pausados</Badge>;
    return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">🟡 {leader.name} lidera — bots ainda atuam</Badge>;
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Unlock className="h-4 w-4" />
          Liberação para Usuários Reais (opcional)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Permite que qualquer usuário real ganhe o leilão se for o último a dar lance.
          Funciona em paralelo aos vencedores predefinidos abaixo.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3 p-3 bg-muted/40 rounded-md">
          <div className="space-y-0.5">
            <Label htmlFor="open-win-toggle" className="text-sm font-medium cursor-pointer">
              Liberar para qualquer usuário real ganhar
            </Label>
            <p className="text-xs text-muted-foreground">
              Quando ativo, real liderando pausa os bots e arremata.
            </p>
          </div>
          <Switch
            id="open-win-toggle"
            checked={openWinMode}
            onCheckedChange={setOpenWinMode}
            disabled={saving}
          />
        </div>

        {openWinMode && (
          <div className="space-y-1.5 p-3 bg-muted/30 rounded-md">
            <Label htmlFor="min-bids" className="text-sm">
              Lances mínimos para qualificar usuário real
            </Label>
            <Input
              id="min-bids"
              type="number"
              min={0}
              step={1}
              value={minBids}
              onChange={(e) => setMinBids(Number(e.target.value))}
              disabled={saving}
              className="max-w-[140px]"
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>
                {minBids <= 0
                  ? 'Sem mínimo: qualquer real liderando já qualifica.'
                  : `Real precisa de pelo menos ${minBids} lance(s) neste leilão para se qualificar.`}
                {' '}Vencedores predefinidos não precisam atingir o mínimo.
              </span>
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 p-3 bg-muted/40 rounded-md">
          <div className="text-xs text-muted-foreground">Status atual:</div>
          {renderLeaderBadge()}
        </div>

        {leader.kind === 'real' && (
          <div className="text-xs text-muted-foreground -mt-2 px-1">
            Motivo: {leader.reason} • {leader.bidCount} lance(s) deste usuário
          </div>
        )}

        <Button onClick={handleSave} disabled={!dirty || saving} className="w-full" size="sm">
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Salvando...' : dirty ? 'Salvar configuração' : 'Sem alterações'}
        </Button>
      </CardContent>
    </Card>
  );
};
