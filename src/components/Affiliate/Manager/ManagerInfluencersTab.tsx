import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Crown, Users, UserPlus, Eye, Pause, Play, Ban, Unlink, MoreHorizontal, Copy } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { InfluencerKPICards } from './InfluencerKPICards';
import { InfluencerDetailModal } from './InfluencerDetailModal';
import { InfluencerRanking } from './InfluencerRanking';
import { ManagerRecruitmentLinkCard } from './ManagerRecruitmentLinkCard';
import { useManagerInfluencerMetrics, type InfluencerMetric } from '@/hooks/useManagerInfluencerMetrics';

interface Props {
  managerAffiliateId: string;
  managerAffiliateCode?: string;
  onInvite: () => void;
  onUnlink: (linkId: string, name: string) => void;
}

const statusBadge = (status: InfluencerMetric['status']) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active: { label: 'Ativo', variant: 'default' },
    paused: { label: 'Pausado', variant: 'secondary' },
    blocked: { label: 'Bloqueado', variant: 'destructive' },
    pending: { label: 'Pendente', variant: 'outline' },
  };
  const cfg = map[status] || map.active;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
};

export const ManagerInfluencersTab = ({ managerAffiliateId, managerAffiliateCode, onInvite, onUnlink }: Props) => {
  const { metrics, stats, loading, updateInfluencerStatus } = useManagerInfluencerMetrics(managerAffiliateId);
  const [detailInfluencer, setDetailInfluencer] = useState<InfluencerMetric | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openDetail = (inf: InfluencerMetric) => {
    setDetailInfluencer(inf);
    setDetailOpen(true);
  };

  const copyInfluencerLink = (code: string) => {
    const url = `${window.location.origin}/?ref=${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copiado', description: url });
  };

  return (
    <div className="space-y-6">
      {managerAffiliateCode && <ManagerRecruitmentLinkCard affiliateCode={managerAffiliateCode} />}
      <InfluencerKPICards stats={stats} />
      <InfluencerRanking metrics={metrics} />

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Meus Influencers
            </CardTitle>
            <CardDescription>Performance individual da sua rede de aquisição</CardDescription>
          </div>
          <Button onClick={onInvite}>
            <UserPlus className="mr-2 h-4 w-4" />
            Convidar Influencer
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando métricas...</p>
          ) : metrics.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum influencer vinculado ainda.</p>
              <p className="text-sm mt-1">Use o botão acima para convidar pelo código de afiliado.</p>
              <p className="text-xs mt-3">
                Ou compartilhe seu link: <code className="bg-muted px-2 py-0.5 rounded">/afiliado?ref=SEU_CODIGO</code>
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Influencer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Cliques</TableHead>
                    <TableHead className="text-right">Cadastros</TableHead>
                    <TableHead className="text-right">Compradores</TableHead>
                    <TableHead className="text-right">Conversão</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Override</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.map((inf) => (
                    <TableRow key={inf.link_id}>
                      <TableCell>
                        <div className="font-medium">{inf.full_name}</div>
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{inf.affiliate_code}</code>
                      </TableCell>
                      <TableCell>{statusBadge(inf.status)}</TableCell>
                      <TableCell className="text-right">{inf.total_clicks.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{inf.total_signups.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{inf.unique_buyers.toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">
                        <span className={inf.conversion_rate >= 5 ? 'text-primary font-semibold' : ''}>
                          {inf.conversion_rate.toFixed(2)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(inf.total_sales)}</TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {formatPrice(inf.total_override)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openDetail(inf)}>
                              <Eye className="mr-2 h-4 w-4" /> Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {inf.status !== 'active' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateInfluencerStatus(inf.link_id, 'active', managerAffiliateId, inf.influencer_affiliate_id, inf.status)
                                }
                              >
                                <Play className="mr-2 h-4 w-4" /> Ativar
                              </DropdownMenuItem>
                            )}
                            {inf.status === 'active' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateInfluencerStatus(inf.link_id, 'paused', managerAffiliateId, inf.influencer_affiliate_id, inf.status)
                                }
                              >
                                <Pause className="mr-2 h-4 w-4" /> Pausar
                              </DropdownMenuItem>
                            )}
                            {inf.status !== 'blocked' && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  updateInfluencerStatus(inf.link_id, 'blocked', managerAffiliateId, inf.influencer_affiliate_id, inf.status)
                                }
                              >
                                <Ban className="mr-2 h-4 w-4" /> Bloquear
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onUnlink(inf.link_id, inf.full_name)}
                            >
                              <Unlink className="mr-2 h-4 w-4" /> Desvincular
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <InfluencerDetailModal influencer={detailInfluencer} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
};
