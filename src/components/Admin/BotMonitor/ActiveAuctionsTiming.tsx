import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ActiveAuction {
  id: string;
  title: string;
  time_left: number | null;
  last_bid_at: string | null;
  scheduled_bot_band: string | null;
  scheduled_bot_bid_at: string | null;
  last_bot_band: string | null;
  predefined_winner_id: string | null;
  open_win_mode: boolean | null;
  min_bids_to_qualify: number | null;
  total_bids: number;
  winner_name: string | null;
}

interface Props {
  onSelectAuction?: (id: string) => void;
  selectedId?: string;
}

const bandColor = (b: string | null) => {
  switch (b) {
    case 'early': return 'bg-blue-500';
    case 'mid-low': return 'bg-cyan-500';
    case 'middle': return 'bg-emerald-500';
    case 'late': return 'bg-amber-500';
    case 'rush': return 'bg-orange-500';
    case 'PANIC': return 'bg-red-600 animate-pulse';
    default: return 'bg-muted text-foreground';
  }
};

export const ActiveAuctionsTiming = ({ onSelectAuction, selectedId }: Props) => {
  const [auctions, setAuctions] = useState<ActiveAuction[]>([]);
  const [now, setNow] = useState(Date.now());

  const fetchActive = async () => {
    const { data } = await supabase
      .from('auctions')
      .select('id,title,time_left,last_bid_at,scheduled_bot_band,scheduled_bot_bid_at,last_bot_band,predefined_winner_id,open_win_mode,min_bids_to_qualify,total_bids,winner_name')
      .eq('status', 'active')
      .order('time_left', { ascending: true });
    setAuctions((data ?? []) as ActiveAuction[]);
  };

  useEffect(() => {
    fetchActive();
    const id = setInterval(fetchActive, 2000);
    const tick = setInterval(() => setNow(Date.now()), 250);
    const ch = supabase
      .channel('admin-bot-monitor-auctions')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions' }, fetchActive)
      .subscribe();
    return () => {
      clearInterval(id); clearInterval(tick);
      supabase.removeChannel(ch);
    };
  }, []);

  const fmtSecAgo = (ts: string | null) => ts ? `${Math.max(0, Math.floor((now - new Date(ts).getTime())/1000))}s` : '—';
  const fmtCountdown = (ts: string | null) => {
    if (!ts) return '—';
    const ms = new Date(ts).getTime() - now;
    if (ms <= 0) return 'agora';
    return `${(ms/1000).toFixed(1)}s`;
  };

  const stateBadge = (a: ActiveAuction) => {
    if (a.predefined_winner_id) return <Badge className="bg-purple-600">Vencedor pré-definido</Badge>;
    if (a.open_win_mode) return <Badge className="bg-pink-600">Open-win</Badge>;
    if ((a.time_left ?? 99) <= 1.5) return <Badge className="bg-red-600 animate-pulse">PANIC armado</Badge>;
    return <Badge variant="outline">Aguardando bot</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Leilões Ativos — Timing dos Bots ({auctions.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leilão</TableHead>
                <TableHead>Timer</TableHead>
                <TableHead>Último lance</TableHead>
                <TableHead>Banda agendada</TableHead>
                <TableHead>Próx. bot em</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último líder</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auctions.map(a => (
                <TableRow
                  key={a.id}
                  className={`cursor-pointer ${selectedId === a.id ? 'bg-muted' : ''}`}
                  onClick={() => onSelectAuction?.(a.id)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">{a.title}</TableCell>
                  <TableCell>
                    <span className={`font-mono ${(a.time_left ?? 99) <= 1.5 ? 'text-red-600 font-bold' : (a.time_left ?? 99) <= 5 ? 'text-orange-500' : ''}`}>
                      {a.time_left ?? '—'}s
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtSecAgo(a.last_bid_at)}</TableCell>
                  <TableCell>
                    {a.scheduled_bot_band ? (
                      <Badge className={`${bandColor(a.scheduled_bot_band)} text-white text-[10px]`}>{a.scheduled_bot_band}</Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                    {a.last_bot_band && <div className="text-[10px] text-muted-foreground mt-0.5">ant: {a.last_bot_band}</div>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{fmtCountdown(a.scheduled_bot_bid_at)}</TableCell>
                  <TableCell>{stateBadge(a)}</TableCell>
                  <TableCell className="text-xs truncate max-w-[140px]">{a.winner_name ?? '—'}</TableCell>
                </TableRow>
              ))}
              {auctions.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">Nenhum leilão ativo.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
