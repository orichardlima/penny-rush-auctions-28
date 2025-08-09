import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bot, 
  Play, 
  Pause, 
  Settings, 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign
} from 'lucide-react';

interface BotConfig {
  id: string;
  auction_id: string;
  is_active: boolean;
  min_intervention_time: number;
  max_intervention_time: number;
  revenue_threshold: number;
  aggressiveness_level: string;
}

interface BotLog {
  id: string;
  auction_id: string;
  status: string;
  created_at: string;
  error?: string;
  http_status?: number;
}

interface BotMonitorTabProps {
  auctions: any[];
  onRefresh: () => void;
}

export const BotMonitorTab: React.FC<BotMonitorTabProps> = ({ auctions, onRefresh }) => {
  const { toast } = useToast();
  const [botConfigs, setBotConfigs] = useState<BotConfig[]>([]);
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);

  const fetchBotData = async () => {
    setLoading(true);
    try {
      // Fetch bot webhook logs
      const { data: logsData, error: logsError } = await supabase
        .from('bot_webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setBotLogs(logsData || []);

    } catch (error) {
      console.error('Error fetching bot data:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados dos bots.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBotData();
  }, []);

  const triggerBotManually = async (auctionId: string) => {
    try {
      const { error } = await supabase.functions.invoke('auction-webhook', {
        body: { auction_id: auctionId }
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Bot acionado manualmente com sucesso.",
      });

      fetchBotData();
    } catch (error) {
      console.error('Error triggering bot:', error);
      toast({
        title: "Erro",
        description: "Erro ao acionar bot manualmente.",
        variant: "destructive",
      });
    }
  };

  const getBotStatus = (auction: any) => {
    const recentLogs = botLogs.filter(log => log.auction_id === auction.id);
    const lastLog = recentLogs[0];
    
    if (!lastLog) return { status: 'Inativo', color: 'secondary', icon: Pause };
    
    if (lastLog.status === 'success') {
      return { status: 'Ativo', color: 'default', icon: CheckCircle };
    } else if (lastLog.status === 'error') {
      return { status: 'Erro', color: 'destructive', icon: AlertTriangle };
    }
    
    return { status: 'Processando', color: 'outline', icon: Activity };
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
  };

  const formatPrice = (priceInCents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(priceInCents / 100);
  };

  const getRevenuePercentage = (auction: any) => {
    if (!auction.revenue_target || auction.revenue_target === 0) return 0;
    return Math.round((auction.company_revenue / (auction.revenue_target / 100)) * 100) / 100;
  };

  const activeAuctions = auctions.filter(auction => auction.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Monitor Avançado de Bots
          </h2>
          <p className="text-muted-foreground">
            Controle e monitoramento detalhado do sistema de bots automáticos
          </p>
        </div>
        <Button onClick={fetchBotData} disabled={loading}>
          Atualizar Dados
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Leilões Ativos</p>
                <p className="text-xl font-bold">{activeAuctions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Bots Ativos</p>
                <p className="text-xl font-bold">
                  {activeAuctions.filter(a => getBotStatus(a).status === 'Ativo').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Bots com Erro</p>
                <p className="text-xl font-bold text-red-600">
                  {activeAuctions.filter(a => getBotStatus(a).status === 'Erro').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-xl font-bold">
                  {botLogs.length > 0 ? 
                    Math.round((botLogs.filter(log => log.status === 'success').length / botLogs.length) * 100) 
                    : 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Auctions Bot Control */}
      <Card>
        <CardHeader>
          <CardTitle>Controle de Bots por Leilão</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leilão</TableHead>
                  <TableHead>Status do Bot</TableHead>
                  <TableHead>Tempo Restante</TableHead>
                  <TableHead>Receita Atual</TableHead>
                  <TableHead>Meta (%)</TableHead>
                  <TableHead>Último Log</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAuctions.map((auction) => {
                  const botStatus = getBotStatus(auction);
                  const revenuePercentage = getRevenuePercentage(auction);
                  const lastLog = botLogs.find(log => log.auction_id === auction.id);
                  
                  return (
                    <TableRow key={auction.id}>
                      <TableCell className="font-medium">
                        <div>
                          <p className="font-semibold">{auction.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Preço: {formatPrice(auction.current_price)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <botStatus.icon className="h-4 w-4" />
                          <Badge variant={botStatus.color as any}>
                            {botStatus.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {auction.time_left}s
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-semibold">
                            {formatPrice((auction.company_revenue || 0) * 100)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Meta: {formatPrice(auction.revenue_target || 0)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-secondary rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                revenuePercentage >= 80 ? 'bg-green-500' :
                                revenuePercentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(revenuePercentage, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">
                            {revenuePercentage.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {lastLog ? formatDateTime(lastLog.created_at) : 'Nenhum log'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerBotManually(auction.id)}
                            disabled={loading}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => setSelectedAuction(auction)}
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Configurar Bot - {auction.title}</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label>Limiar de Receita (%)</Label>
                                  <Input type="number" placeholder="80" />
                                  <p className="text-xs text-muted-foreground">
                                    Bot será acionado quando receita estiver abaixo deste percentual
                                  </p>
                                </div>
                                <div>
                                  <Label>Tempo Mínimo para Intervenção (segundos)</Label>
                                  <Input type="number" placeholder="5" />
                                </div>
                                <div>
                                  <Label>Tempo Máximo para Intervenção (segundos)</Label>
                                  <Input type="number" placeholder="7" />
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Switch id="bot-active" />
                                  <Label htmlFor="bot-active">Bot Ativo</Label>
                                </div>
                                <Button className="w-full">
                                  Salvar Configuração
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activeAuctions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum leilão ativo no momento
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Bot Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Logs de Atividade dos Bots</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-64">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Leilão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Código HTTP</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {botLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {auctions.find(a => a.id === log.auction_id)?.title || 'Leilão não encontrado'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.http_status || 'N/A'}
                    </TableCell>
                    <TableCell className="text-sm text-red-600">
                      {log.error || '-'}
                    </TableCell>
                  </TableRow>
                ))}
                {botLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};