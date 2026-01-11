import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface RevenueProjection {
  week: number;
  weekLabel: string;
  bidRevenue: number;
  partnerRevenue: number;
  totalRevenue: number;
  projectedPayouts: number;
  netRevenue: number;
}

export interface ProjectionSummary {
  totalBidRevenue: number;
  totalPartnerRevenue: number;
  totalProjectedPayouts: number;
  avgWeeklyBidRevenue: number;
  avgWeeklyPartnerRevenue: number;
  avgWeeklyPayouts: number;
  growthRateBids: number;
  growthRatePartners: number;
}

interface HistoricalData {
  bidPurchases: {
    week: string;
    total: number;
    count: number;
  }[];
  partnerContracts: {
    week: string;
    total: number;
    count: number;
  }[];
  weeklyPayouts: {
    week: string;
    total: number;
  }[];
}

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const formatWeekLabel = (weekIndex: number): string => {
  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + (weekIndex * 7));
  const weekStart = getWeekStart(futureDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  
  return `${weekStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
};

export const useRevenueProjections = (weeksToProject: number = 8) => {
  const [projections, setProjections] = useState<RevenueProjection[]>([]);
  const [summary, setSummary] = useState<ProjectionSummary | null>(null);
  const [historicalData, setHistoricalData] = useState<HistoricalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistoricalData = useCallback(async () => {
    try {
      // Get last 12 weeks of bid purchases
      const twelveWeeksAgo = new Date();
      twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);

      const { data: bidPurchases, error: bidError } = await supabase
        .from('bid_purchases')
        .select('amount_paid, created_at')
        .eq('payment_status', 'approved')
        .gte('created_at', twelveWeeksAgo.toISOString())
        .order('created_at', { ascending: true });

      if (bidError) throw bidError;

      // Get last 12 weeks of partner contracts
      const { data: partnerContracts, error: partnerError } = await supabase
        .from('partner_contracts')
        .select('aporte_value, created_at')
        .gte('created_at', twelveWeeksAgo.toISOString())
        .order('created_at', { ascending: true });

      if (partnerError) throw partnerError;

      // Get weekly payouts from snapshots
      const { data: snapshots, error: snapshotError } = await supabase
        .from('weekly_revenue_snapshots')
        .select('period_start, partner_fund_value')
        .order('period_start', { ascending: false })
        .limit(12);

      if (snapshotError) throw snapshotError;

      // Group bid purchases by week
      const bidsByWeek = new Map<string, { total: number; count: number }>();
      (bidPurchases || []).forEach(purchase => {
        const weekStart = getWeekStart(new Date(purchase.created_at));
        const weekKey = weekStart.toISOString().split('T')[0];
        const existing = bidsByWeek.get(weekKey) || { total: 0, count: 0 };
        bidsByWeek.set(weekKey, {
          total: existing.total + (purchase.amount_paid || 0),
          count: existing.count + 1
        });
      });

      // Group partner contracts by week
      const partnersByWeek = new Map<string, { total: number; count: number }>();
      (partnerContracts || []).forEach(contract => {
        const weekStart = getWeekStart(new Date(contract.created_at));
        const weekKey = weekStart.toISOString().split('T')[0];
        const existing = partnersByWeek.get(weekKey) || { total: 0, count: 0 };
        partnersByWeek.set(weekKey, {
          total: existing.total + (contract.aporte_value || 0),
          count: existing.count + 1
        });
      });

      // Format historical data
      const historical: HistoricalData = {
        bidPurchases: Array.from(bidsByWeek.entries()).map(([week, data]) => ({
          week,
          total: data.total,
          count: data.count
        })),
        partnerContracts: Array.from(partnersByWeek.entries()).map(([week, data]) => ({
          week,
          total: data.total,
          count: data.count
        })),
        weeklyPayouts: (snapshots || []).map(s => ({
          week: s.period_start,
          total: s.partner_fund_value || 0
        }))
      };

      setHistoricalData(historical);
      return historical;
    } catch (err) {
      console.error('Error fetching historical data:', err);
      throw err;
    }
  }, []);

  const calculateProjections = useCallback((historical: HistoricalData) => {
    // Calculate averages and growth rates from historical data
    const bidRevenues = historical.bidPurchases.map(b => b.total);
    const partnerRevenues = historical.partnerContracts.map(p => p.total);
    const payouts = historical.weeklyPayouts.map(p => p.total);

    // Calculate averages
    const avgBidRevenue = bidRevenues.length > 0 
      ? bidRevenues.reduce((a, b) => a + b, 0) / bidRevenues.length 
      : 0;
    const avgPartnerRevenue = partnerRevenues.length > 0 
      ? partnerRevenues.reduce((a, b) => a + b, 0) / partnerRevenues.length 
      : 0;
    const avgPayouts = payouts.length > 0 
      ? payouts.reduce((a, b) => a + b, 0) / payouts.length 
      : 0;

    // Calculate growth rate (comparing last 4 weeks to previous 4 weeks)
    const calculateGrowthRate = (values: number[]): number => {
      if (values.length < 4) return 0;
      const recent = values.slice(-4);
      const previous = values.slice(-8, -4);
      if (previous.length === 0) return 0;
      
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
      
      if (previousAvg === 0) return 0;
      return ((recentAvg - previousAvg) / previousAvg) * 100;
    };

    const growthRateBids = calculateGrowthRate(bidRevenues);
    const growthRatePartners = calculateGrowthRate(partnerRevenues);

    // Generate projections for future weeks
    const projectedWeeks: RevenueProjection[] = [];
    let cumulativeBidRevenue = 0;
    let cumulativePartnerRevenue = 0;
    let cumulativePayouts = 0;

    for (let i = 0; i < weeksToProject; i++) {
      // Apply growth rate to projections (compound weekly)
      const bidGrowthFactor = 1 + (growthRateBids / 100 / 52);
      const partnerGrowthFactor = 1 + (growthRatePartners / 100 / 52);
      
      const projectedBidRevenue = avgBidRevenue * Math.pow(bidGrowthFactor, i);
      const projectedPartnerRevenue = avgPartnerRevenue * Math.pow(partnerGrowthFactor, i);
      
      // Payouts are typically a percentage of total revenue
      const projectedPayouts = avgPayouts * Math.pow(1.02, i); // Assume 2% growth in payouts
      
      cumulativeBidRevenue += projectedBidRevenue;
      cumulativePartnerRevenue += projectedPartnerRevenue;
      cumulativePayouts += projectedPayouts;

      projectedWeeks.push({
        week: i + 1,
        weekLabel: formatWeekLabel(i),
        bidRevenue: projectedBidRevenue,
        partnerRevenue: projectedPartnerRevenue,
        totalRevenue: projectedBidRevenue + projectedPartnerRevenue,
        projectedPayouts: projectedPayouts,
        netRevenue: projectedBidRevenue + projectedPartnerRevenue - projectedPayouts
      });
    }

    setProjections(projectedWeeks);

    // Calculate summary
    const summaryData: ProjectionSummary = {
      totalBidRevenue: cumulativeBidRevenue,
      totalPartnerRevenue: cumulativePartnerRevenue,
      totalProjectedPayouts: cumulativePayouts,
      avgWeeklyBidRevenue: cumulativeBidRevenue / weeksToProject,
      avgWeeklyPartnerRevenue: cumulativePartnerRevenue / weeksToProject,
      avgWeeklyPayouts: cumulativePayouts / weeksToProject,
      growthRateBids,
      growthRatePartners
    };

    setSummary(summaryData);
  }, [weeksToProject]);

  const refreshData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const historical = await fetchHistoricalData();
      calculateProjections(historical);
    } catch (err) {
      console.error('Error refreshing projections:', err);
      setError('Erro ao carregar projeções');
    } finally {
      setLoading(false);
    }
  }, [fetchHistoricalData, calculateProjections]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    projections,
    summary,
    historicalData,
    loading,
    error,
    refreshData
  };
};
