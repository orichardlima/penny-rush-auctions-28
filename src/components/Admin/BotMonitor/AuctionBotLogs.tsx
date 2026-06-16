import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BidRow {
  id: string;
  auction_id: string;
  user_id: string;
  cost_paid: number;
  created_at: string;
}
interface WebhookLog {
  id: string;
  auction_id: string | null;
  status: string;
  http_status: number | null;
  error: string | null;
  created_at: string;
  correlation_id: string | null;
}

interface Props { auctionId: string | null }

export const AuctionBotLogs = ({ auctionId }: Props) => {
  const [bids, setBids] = useState<BidRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; is_bot: boolean }>>({});
  const [hooks, setHooks] = useState<WebhookLog[]>([]);

  useEffect(() => {
    if (!auctionId) { setBids([]); setHooks([]); return; }

    const fetchData = async () => {
      const [{ data: b }, { data: h }] = await Promise.all([
        supabase.from('bids').select('id,auction_id,user_id,cost_paid,created_at')
          .eq('auction_id', auctionId).order('created_at', { ascending: false }).limit(50),
        supabase.from('bot_webhook_logs').select('id,auction_id,status,http_status,error,created_at,correlation_id')
          .eq('auction_id', auctionId).order('created_at', { ascending: false }).limit(30),
      ]);
      setBids((b ?? []) as BidRow[]);
      setHooks((h ?? []) as WebhookLog[]);
      const ids = Array.from(new Set((b ?? []).map((x: any) => x.user_id)));
      if (ids.length > 0) {
        const { data: p } = await supabase.from('profiles').select('user_id,full_name,is_bot').in('user_id', ids);
        const map: Record<string, { full_name: string; is_bot: boolean }> = {};
        (p ?? []).forEach((x: any) => { map[x.user_id] = { full_name: x.full_name, is_bot: x.is_bot }; });
        setProfiles(map);
      }
    };

    fetchData();
    const id = setInterval(fetchData, 3000);
    const ch = supabase.channel(`logs-${auctionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auctionId}` }, fetchData)
      .subscribe();
    return () => { clearInterval(id); supabase.removeChannel(ch); };
  }, [auctionId]);

  const intervals = useMemo(() => {
    const sorted = [...bids].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return sorted.map((b, i) => i === 0 ? null : (new Date(b.created_at).getTime() - new Date(sorted[i-1].created_at).getTime())/1000);
  }, [bids]);

  if (!auctionId) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Logs por leilão</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Selecione um leilão na tabela acima para ver os logs.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Últimos lances ({bids.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px]">
            <div className="space-y-1">
              {bids.map((b, i) => {
                const p = profiles[b.user_id];
                const sorted = [...bids].sort((x, y) => new Date(x.created_at).getTime() - new Date(y.created_at).getTime());
                const idx = sorted.findIndex(x => x.id === b.id);
                const interval = intervals[idx];
                return (
                  <div key={b.id} className="flex items-center justify-between text-xs border-b pb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={p?.is_bot ? 'secondary' : 'default'} className="text-[10px]">{p?.is_bot ? 'BOT' : 'REAL'}</Badge>
                      <span className="truncate">{p?.full_name ?? b.user_id.slice(0,8)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground shrink-0">
                      {interval != null && <span className="font-mono">+{interval.toFixed(1)}s</span>}
                      <span>{new Date(b.created_at).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>
                );
              })}
              {bids.length === 0 && <p className="text-sm text-muted-foreground">Sem lances ainda.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Webhooks de bots ({hooks.length})</CardTitle></CardHeader>
        <CardContent>
          <ScrollArea className="h-[360px]">
            <div className="space-y-1">
              {hooks.map(h => (
                <div key={h.id} className="text-xs border-b pb-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={h.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">{h.status}</Badge>
                      {h.http_status != null && <span className="font-mono">{h.http_status}</span>}
                    </div>
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleTimeString('pt-BR')}</span>
                  </div>
                  {h.error && <div className="text-red-500 mt-0.5 break-all">{h.error.slice(0, 200)}</div>}
                  {h.correlation_id && <div className="text-muted-foreground font-mono text-[10px]">{h.correlation_id}</div>}
                </div>
              ))}
              {hooks.length === 0 && <p className="text-sm text-muted-foreground">Sem webhooks registrados.</p>}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
