import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Crown, Search, Users, TrendingUp, CornerDownRight, Layers, Info } from 'lucide-react';

const sb = supabase as any;
const pts = (v: any) => new Intl.NumberFormat('pt-BR').format(Math.round(Number(v || 0)));
const dt = (v?: string | null) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const initials = (n?: string | null) => (n || 'P').trim().slice(0, 2).toUpperCase();

export interface TeamNetworkMember {
  user_id: string;
  name: string;
  avatar_url: string | null;
  depth: number;
  is_root: boolean;
  joined_at: string | null;
  plan_name: string | null;
  is_active: boolean;
  sponsor_user_id: string | null;
  sponsor_name: string | null;
  points_total: number;
  week_points: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  teamRootUserId: string | null;
  teamName: string;
}

type Sort = 'depth' | 'points' | 'recent';

export default function TeamNetworkDialog({ open, onOpenChange, teamRootUserId, teamName }: Props) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamNetworkMember[]>([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>('depth');

  useEffect(() => {
    if (!open || !teamRootUserId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await sb.rpc('expansion_get_team_network', {
        _team_root_user_id: teamRootUserId,
      });
      if (!cancelled) {
        setMembers(!error && Array.isArray(data) ? (data as TeamNetworkMember[]) : []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, teamRootUserId]);

  const totals = useMemo(() => {
    const maxDepth = members.reduce((m, x) => Math.max(m, Number(x.depth || 0)), 0);
    return {
      count: members.length,
      levels: maxDepth,
      active: members.filter((m) => m.is_active).length,
      week: members.reduce((s, m) => s + Number(m.week_points || 0), 0),
      total: members.reduce((s, m) => s + Number(m.points_total || 0), 0),
    };
  }, [members]);

  const byLevel = useMemo(() => {
    const term = q.trim().toLowerCase();
    const filtered = term
      ? members.filter((m) => (m.name || '').toLowerCase().includes(term))
      : members;
    const sorted = [...filtered].sort((a, b) => {
      if (sort === 'points') return Number(b.points_total) - Number(a.points_total);
      if (sort === 'recent')
        return new Date(b.joined_at || 0).getTime() - new Date(a.joined_at || 0).getTime();
      return (
        Number(a.depth) - Number(b.depth) ||
        new Date(a.joined_at || 0).getTime() - new Date(b.joined_at || 0).getTime()
      );
    });
    const groups = new Map<number, TeamNetworkMember[]>();
    sorted.forEach((m) => {
      const d = Number(m.depth || 0);
      groups.set(d, [...(groups.get(d) || []), m]);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [members, q, sort]);

  const levelLabel = (d: number) =>
    d <= 1 ? 'Nível 1 · sua indicação direta' : `Nível ${d} · indicados da equipe`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" />
            Rede da equipe de {teamName}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Todos os parceiros que fazem parte desta equipe, organizados por nível de profundidade a partir da sua
            indicação direta.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { icon: Users, label: 'Integrantes', value: pts(totals.count) },
                { icon: Layers, label: 'Níveis', value: pts(totals.levels) },
                { icon: TrendingUp, label: 'Pontos na semana', value: pts(totals.week) },
                { icon: Crown, label: 'Pontos históricos', value: pts(totals.total) },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border bg-muted/30 p-2">
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <m.icon className="h-3 w-3" /> {m.label}
                  </p>
                  <p className="text-lg font-semibold leading-tight">{m.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar parceiro pelo nome"
                  className="pl-7 h-8 text-sm"
                />
              </div>
              {([
                ['depth', 'Por nível'],
                ['points', 'Por pontos'],
                ['recent', 'Mais recentes'],
              ] as [Sort, string][]).map(([k, label]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={sort === k ? 'secondary' : 'ghost'}
                  className="h-8 text-xs"
                  onClick={() => setSort(k)}
                >
                  {label}
                </Button>
              ))}
            </div>

            <ScrollArea className="flex-1 -mx-2 px-2">
              {byLevel.length === 0 && (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhum parceiro encontrado nesta equipe.
                </div>
              )}

              <div className="space-y-4 pb-2">
                {byLevel.map(([depth, list]) => (
                  <div key={depth} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{levelLabel(depth)}</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {list.length} parceiro(s)
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>

                    <div className="space-y-2" style={{ paddingLeft: Math.min(depth - 1, 4) * 12 }}>
                      {list.map((m) => (
                        <div
                          key={m.user_id}
                          className="rounded-lg border p-3 flex items-start gap-3 hover:bg-muted/40 transition-colors"
                        >
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarImage src={m.avatar_url || undefined} alt={m.name} />
                            <AvatarFallback>{initials(m.name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium truncate">{m.name}</span>
                              {m.is_root && (
                                <Badge variant="secondary" className="gap-1 text-[10px]">
                                  <Crown className="h-3 w-3" /> Líder da equipe
                                </Badge>
                              )}
                              {m.plan_name && (
                                <Badge variant="outline" className="text-[10px]">{m.plan_name}</Badge>
                              )}
                              <Badge
                                variant={m.is_active ? 'default' : 'outline'}
                                className="text-[10px]"
                              >
                                {m.is_active ? 'Ativo' : 'Sem contrato ativo'}
                              </Badge>
                            </div>
                            {!m.is_root && m.sponsor_name && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <CornerDownRight className="h-3 w-3" /> Indicado por {m.sponsor_name}
                              </p>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs pt-1">
                              <span className="text-muted-foreground">
                                Entrou em: <span className="text-foreground font-medium">{dt(m.joined_at)}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Semana: <span className="text-foreground font-medium">{pts(m.week_points)}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Histórico: <span className="text-foreground font-medium">{pts(m.points_total)}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-[11px] text-muted-foreground flex items-start gap-1 pt-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Os pontos exibidos são os pontos de expansão gerados por cada parceiro dentro desta equipe. Dados de
              contato são privados e não são exibidos.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
