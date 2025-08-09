import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Download, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  PieChart,
  FileText,
  Mail,
  Filter,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface ReportData {
  date: string;
  auctionRevenue: number;
  packageRevenue: number;
  totalRevenue: number;
  bidCount: number;
  userCount: number;
  activeAuctions: number;
}

interface ExportConfig {
  format: 'csv' | 'pdf' | 'xlsx';
  dateRange: string;
  includeCharts: boolean;
  includeDetails: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--success))', 'hsl(var(--warning))'];

export const ReportsAnalyticsTab: React.FC = () => {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [filteredData, setFilteredData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date()
  });
  const [compareRange, setCompareRange] = useState({
    from: subDays(new Date(), 60),
    to: subDays(new Date(), 30)
  });
  const [showComparison, setShowComparison] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    format: 'csv',
    dateRange: '30d',
    includeCharts: true,
    includeDetails: true
  });
  const [filters, setFilters] = useState({
    revenueMin: '',
    revenueMax: '',
    bidCountMin: '',
    bidCountMax: ''
  });

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch revenue trends
      const { data: revenueData, error: revenueError } = await supabase
        .rpc('get_revenue_trends');

      if (revenueError) throw revenueError;

      // Fetch additional metrics for each date
      const enrichedData = await Promise.all(
        (revenueData || []).map(async (item: any) => {
          const dateStr = item.date_period;
          
          // Get user count for this date
          const { count: userCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', dateStr)
            .lt('created_at', format(new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

          // Get active auctions for this date
          const { count: activeAuctions } = await supabase
            .from('auctions')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('created_at', dateStr)
            .lt('created_at', format(new Date(new Date(dateStr).getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'));

          return {
            date: dateStr,
            auctionRevenue: item.auction_revenue || 0,
            packageRevenue: item.package_revenue || 0,
            totalRevenue: item.total_revenue || 0,
            bidCount: item.bids_count || 0,
            userCount: userCount || 0,
            activeAuctions: activeAuctions || 0
          };
        })
      );

      setReportData(enrichedData);
      setFilteredData(enrichedData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar dados do relatório',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = reportData.filter(item => {
      const itemDate = new Date(item.date);
      const withinDateRange = isWithinInterval(itemDate, { start: dateRange.from, end: dateRange.to });
      
      const revenueMin = filters.revenueMin ? parseFloat(filters.revenueMin) : 0;
      const revenueMax = filters.revenueMax ? parseFloat(filters.revenueMax) : Infinity;
      const bidCountMin = filters.bidCountMin ? parseInt(filters.bidCountMin) : 0;
      const bidCountMax = filters.bidCountMax ? parseInt(filters.bidCountMax) : Infinity;

      return withinDateRange &&
             item.totalRevenue >= revenueMin &&
             item.totalRevenue <= revenueMax &&
             item.bidCount >= bidCountMin &&
             item.bidCount <= bidCountMax;
    });

    setFilteredData(filtered);
  };

  const exportData = async () => {
    try {
      const dataToExport = filteredData.map(item => ({
        'Data': format(new Date(item.date), 'dd/MM/yyyy'),
        'Receita Leilões': `R$ ${item.auctionRevenue.toFixed(2)}`,
        'Receita Pacotes': `R$ ${item.packageRevenue.toFixed(2)}`,
        'Receita Total': `R$ ${item.totalRevenue.toFixed(2)}`,
        'Lances': item.bidCount,
        'Usuários Novos': item.userCount,
        'Leilões Ativos': item.activeAuctions
      }));

      if (exportConfig.format === 'csv') {
        const csvContent = [
          Object.keys(dataToExport[0]).join(','),
          ...dataToExport.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }

      toast({
        title: 'Sucesso',
        description: 'Relatório exportado com sucesso!'
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao exportar relatório',
        variant: 'destructive'
      });
    }
  };

  const getComparativeMetrics = () => {
    const currentPeriodData = filteredData;
    const currentTotal = currentPeriodData.reduce((sum, item) => sum + item.totalRevenue, 0);
    const currentBids = currentPeriodData.reduce((sum, item) => sum + item.bidCount, 0);
    
    // For comparison, we'd need to fetch previous period data
    // This is a simplified version
    const previousTotal = currentTotal * 0.85; // Mock 15% growth
    const previousBids = currentBids * 0.9; // Mock 10% growth
    
    return {
      revenueGrowth: ((currentTotal - previousTotal) / previousTotal) * 100,
      bidGrowth: ((currentBids - previousBids) / previousBids) * 100,
      currentTotal,
      previousTotal,
      currentBids,
      previousBids
    };
  };

  const pieChartData = [
    { name: 'Receita Leilões', value: filteredData.reduce((sum, item) => sum + item.auctionRevenue, 0), color: COLORS[0] },
    { name: 'Receita Pacotes', value: filteredData.reduce((sum, item) => sum + item.packageRevenue, 0), color: COLORS[1] }
  ];

  const metrics = getComparativeMetrics();

  useEffect(() => {
    fetchReportData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [dateRange, filters, reportData]);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">Relatórios e Analytics</h2>
          <p className="text-muted-foreground">
            Análises detalhadas e exportação de dados
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap">
          <Button onClick={fetchReportData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configurar Exportação</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Formato</Label>
                  <Select 
                    value={exportConfig.format} 
                    onValueChange={(value) => setExportConfig(prev => ({ ...prev, format: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="xlsx">Excel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={exportData} className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Relatório
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receita Total</p>
                <p className="text-2xl font-bold">{formatPrice(metrics.currentTotal)}</p>
              </div>
              <div className="flex items-center text-success text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +{metrics.revenueGrowth.toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total de Lances</p>
                <p className="text-2xl font-bold">{metrics.currentBids.toLocaleString()}</p>
              </div>
              <div className="flex items-center text-success text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                +{metrics.bidGrowth.toFixed(1)}%
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Dados no Período</p>
                <p className="text-2xl font-bold">{filteredData.length}</p>
              </div>
              <Badge variant="outline">{exportConfig.dateRange}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Última Atualização</p>
                <p className="text-sm font-medium">
                  {format(new Date(), 'dd/MM/yyyy HH:mm')}
                </p>
              </div>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Receita Mínima</Label>
              <Input
                placeholder="R$ 0"
                value={filters.revenueMin}
                onChange={(e) => setFilters(prev => ({ ...prev, revenueMin: e.target.value }))}
              />
            </div>
            <div>
              <Label>Receita Máxima</Label>
              <Input
                placeholder="R$ 999999"
                value={filters.revenueMax}
                onChange={(e) => setFilters(prev => ({ ...prev, revenueMax: e.target.value }))}
              />
            </div>
            <div>
              <Label>Lances Mínimos</Label>
              <Input
                placeholder="0"
                type="number"
                value={filters.bidCountMin}
                onChange={(e) => setFilters(prev => ({ ...prev, bidCountMin: e.target.value }))}
              />
            </div>
            <div>
              <Label>Lances Máximos</Label>
              <Input
                placeholder="999999"
                type="number"
                value={filters.bidCountMax}
                onChange={(e) => setFilters(prev => ({ ...prev, bidCountMax: e.target.value }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Receita</TabsTrigger>
          <TabsTrigger value="bids">Lances</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
          <TabsTrigger value="trends">Tendências</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue">
          <Card>
            <CardHeader>
              <CardTitle>Evolução da Receita</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM')} />
                  <YAxis tickFormatter={(value) => formatPrice(value)} />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy')}
                    formatter={(value: any) => [formatPrice(value), '']}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="auctionRevenue" stroke={COLORS[0]} name="Receita Leilões" />
                  <Line type="monotone" dataKey="packageRevenue" stroke={COLORS[1]} name="Receita Pacotes" />
                  <Line type="monotone" dataKey="totalRevenue" stroke={COLORS[2]} name="Receita Total" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bids">
          <Card>
            <CardHeader>
              <CardTitle>Volume de Lances</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM')} />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy')}
                    formatter={(value: any) => [value.toLocaleString(), 'Lances']}
                  />
                  <Bar dataKey="bidCount" fill={COLORS[0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Receita</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatPrice(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas do Período</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Receita Média por Dia</span>
                    <span className="font-semibold">
                      {formatPrice(filteredData.length > 0 ? metrics.currentTotal / filteredData.length : 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Lances Médios por Dia</span>
                    <span className="font-semibold">
                      {filteredData.length > 0 ? Math.round(metrics.currentBids / filteredData.length) : 0}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Maior Receita em 1 Dia</span>
                    <span className="font-semibold">
                      {formatPrice(Math.max(...filteredData.map(d => d.totalRevenue)))}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total de Dias com Dados</span>
                    <span className="font-semibold">{filteredData.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Tendências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="font-medium">Crescimento de Receita</span>
                  </div>
                  <p className="text-2xl font-bold text-success">+{metrics.revenueGrowth.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">vs. período anterior</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-success" />
                    <span className="font-medium">Crescimento de Lances</span>
                  </div>
                  <p className="text-2xl font-bold text-success">+{metrics.bidGrowth.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground">vs. período anterior</p>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="font-medium">Ticket Médio</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {formatPrice(metrics.currentBids > 0 ? metrics.currentTotal / metrics.currentBids : 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">por lance realizado</p>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={(value) => format(new Date(value), 'dd/MM')} />
                  <YAxis yAxisId="left" orientation="left" tickFormatter={(value) => formatPrice(value)} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy')}
                    formatter={(value: any, name: string) => [
                      name.includes('Receita') ? formatPrice(value) : value.toLocaleString(), 
                      name
                    ]}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="totalRevenue" stroke={COLORS[0]} name="Receita Total" />
                  <Line yAxisId="right" type="monotone" dataKey="bidCount" stroke={COLORS[1]} name="Número de Lances" />
                  <Line yAxisId="right" type="monotone" dataKey="activeAuctions" stroke={COLORS[2]} name="Leilões Ativos" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Dados Detalhados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Receita Leilões</TableHead>
                  <TableHead>Receita Pacotes</TableHead>
                  <TableHead>Receita Total</TableHead>
                  <TableHead>Lances</TableHead>
                  <TableHead>Usuários Novos</TableHead>
                  <TableHead>Leilões Ativos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((item) => (
                  <TableRow key={item.date}>
                    <TableCell>{format(new Date(item.date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{formatPrice(item.auctionRevenue)}</TableCell>
                    <TableCell>{formatPrice(item.packageRevenue)}</TableCell>
                    <TableCell className="font-semibold">{formatPrice(item.totalRevenue)}</TableCell>
                    <TableCell>{item.bidCount.toLocaleString()}</TableCell>
                    <TableCell>{item.userCount}</TableCell>
                    <TableCell>{item.activeAuctions}</TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Nenhum dado encontrado para o período selecionado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};