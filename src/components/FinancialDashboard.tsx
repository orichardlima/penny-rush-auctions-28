import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  PieChart,
  Calculator,
  Trophy,
  Activity
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from 'recharts';

interface FinancialData {
  totalSpent: number;
  totalBidsUsed: number;
  totalBidsRemaining: number;
  totalPurchases: number;
  averageSpentPerBid: number;
  monthlySpending: Array<{ month: string; amount: number; bids: number }>;
  packageBreakdown: Array<{ name: string; value: number; color: string }>;
  auctionParticipation: Array<{ title: string; bidsUsed: number; amountSpent: number; status: string; date: string }>;
  wonAuctions: Array<{ title: string; finalPrice: number; invested: number; roi: number; date: string }>;
}

interface Purchase {
  id: string;
  bids_purchased: number;
  amount_paid: number;
  payment_status: string;
  created_at: string;
  bid_packages: {
    name: string;
  };
}

interface Bid {
  id: string;
  auction_id: string;
  bid_amount: number;
  cost_paid: number;
  created_at: string;
  auctions: {
    title: string;
    status: string;
    winner_id?: string;
    current_price: number;
  };
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

export const FinancialDashboard = () => {
  const { profile } = useAuth();
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      // Fetch purchases
      const { data: purchasesData } = await supabase
        .from('bid_purchases')
        .select(`
          *,
          bid_packages (
            name
          )
        `)
        .order('created_at', { ascending: false });

      // Fetch bids
      const { data: bidsData } = await supabase
        .from('bids')
        .select(`
          *,
          auctions (
            title,
            status,
            winner_id,
            current_price
          )
        `)
        .order('created_at', { ascending: false });

      setPurchases(purchasesData || []);
      setBids(bidsData || []);
      
      processFinancialData(purchasesData || [], bidsData || []);
    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processFinancialData = (purchases: Purchase[], bids: Bid[]) => {
    const totalSpent = purchases
      .filter(p => p.payment_status === 'completed')
      .reduce((sum, p) => sum + p.amount_paid, 0);

    const totalBidsUsed = bids.length;
    const totalBidsRemaining = profile?.bids_balance || 0;
    const totalPurchases = purchases.filter(p => p.payment_status === 'completed').length;
    const averageSpentPerBid = totalBidsUsed > 0 ? totalSpent / totalBidsUsed : 0;

    // Monthly spending data
    const monthlyData = purchases
      .filter(p => p.payment_status === 'completed')
      .reduce((acc, purchase) => {
        const month = new Date(purchase.created_at).toLocaleDateString('pt-BR', { 
          month: 'short', 
          year: '2-digit' 
        });
        const existing = acc.find(item => item.month === month);
        if (existing) {
          existing.amount += purchase.amount_paid;
          existing.bids += purchase.bids_purchased;
        } else {
          acc.push({
            month,
            amount: purchase.amount_paid,
            bids: purchase.bids_purchased
          });
        }
        return acc;
      }, [] as Array<{ month: string; amount: number; bids: number }>);

    // Package breakdown
    const packageBreakdown = purchases
      .filter(p => p.payment_status === 'completed')
      .reduce((acc, purchase) => {
        const packageName = purchase.bid_packages?.name || 'Desconhecido';
        const existing = acc.find(item => item.name === packageName);
        if (existing) {
          existing.value += purchase.amount_paid;
        } else {
          acc.push({
            name: packageName,
            value: purchase.amount_paid,
            color: COLORS[acc.length % COLORS.length]
          });
        }
        return acc;
      }, [] as Array<{ name: string; value: number; color: string }>);

    // Auction participation
    const auctionParticipation = bids.map(bid => ({
      title: bid.auctions?.title || 'Leilão Desconhecido',
      bidsUsed: 1,
      amountSpent: bid.cost_paid,
      status: bid.auctions?.status || 'unknown',
      date: bid.created_at
    }));

    // Won auctions
    const wonAuctions = bids
      .filter(bid => bid.auctions?.winner_id === profile?.user_id)
      .map(bid => {
        const totalInvested = bids
          .filter(b => b.auction_id === bid.auction_id)
          .reduce((sum, b) => sum + b.cost_paid, 0);
        
        const finalPrice = bid.auctions?.current_price || 0;
        const roi = finalPrice > 0 ? ((finalPrice - totalInvested) / totalInvested) * 100 : 0;
        
        return {
          title: bid.auctions?.title || 'Leilão Desconhecido',
          finalPrice,
          invested: totalInvested,
          roi,
          date: bid.created_at
        };
      });

    setFinancialData({
      totalSpent,
      totalBidsUsed,
      totalBidsRemaining,
      totalPurchases,
      averageSpentPerBid,
      monthlySpending: monthlyData,
      packageBreakdown,
      auctionParticipation,
      wonAuctions
    });
  };

  const formatPrice = (priceInReais: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(priceInReais || 0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-48 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!financialData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Erro ao carregar dados financeiros</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Resumo Financeiro</h2>
        <p className="text-muted-foreground">
          Acompanhe seus gastos, investimentos e retornos nos leilões
        </p>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Investido</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPrice(financialData.totalSpent)}</div>
            <p className="text-xs text-muted-foreground">
              em {financialData.totalPurchases} compras
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lances Utilizados</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialData.totalBidsUsed}</div>
            <p className="text-xs text-muted-foreground">
              Restam {financialData.totalBidsRemaining} lances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo por Lance</CardTitle>
            <Calculator className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatPrice(Math.round(financialData.averageSpentPerBid))}
            </div>
            <p className="text-xs text-muted-foreground">
              média por lance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leilões Ganhos</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{financialData.wonAuctions.length}</div>
            <p className="text-xs text-muted-foreground">
              vitórias conquistadas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Gastos Mensais */}
        <Card>
          <CardHeader>
            <CardTitle>Gastos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={financialData.monthlySpending}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(value) => formatPrice(value)} />
                <Tooltip formatter={(value) => formatPrice(value as number)} />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição de Pacotes */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Pacote</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie
                  data={financialData.packageBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {financialData.packageBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPrice(value as number)} />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabelas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Histórico de Compras */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Compras</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pacote</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.slice(0, 5).map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{purchase.bid_packages?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {purchase.bids_purchased} lances
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatPrice(purchase.amount_paid)}</TableCell>
                    <TableCell>{formatDate(purchase.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Leilões Ganhos */}
        <Card>
          <CardHeader>
            <CardTitle>Leilões Ganhos</CardTitle>
          </CardHeader>
          <CardContent>
            {financialData.wonAuctions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Leilão</TableHead>
                    <TableHead>Investido</TableHead>
                    <TableHead>ROI</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financialData.wonAuctions.map((auction, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{auction.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDate(auction.date)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatPrice(auction.invested)}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {auction.roi >= 0 ? (
                            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                          )}
                          <span className={auction.roi >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {auction.roi.toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                Você ainda não ganhou nenhum leilão.
                <br />
                Continue participando para conquistar sua primeira vitória!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};