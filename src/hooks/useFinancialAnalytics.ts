import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialFilters {
  startDate: Date | null;
  endDate: Date | null;
  realOnly: boolean;
  revenueType: 'all' | 'auctions' | 'packages';
  period: 'custom' | 'today' | '7d' | '30d' | '90d' | 'year';
}

interface FinancialSummary {
  total_revenue: number;
  auction_revenue: number;
  package_revenue: number;
  total_auctions: number;
  active_auctions: number;
  finished_auctions: number;
  total_users: number;
  paying_users: number;
  average_auction_revenue: number;
  total_bids: number;
  user_bids: number;
  bot_bids: number;
  conversion_rate: number;
}

interface AuctionFinancialData {
  auction_id: string;
  title: string;
  total_bids_count: number;
  user_bids_count: number;
  bot_bids_count: number;
  user_bids_percentage: number;
  bot_bids_percentage: number;
  real_revenue: number;
  revenue_target: number;
  target_percentage: number;
  current_price: number;
  market_value: number;
  roi_percentage: number;
  profit_margin: number;
  status: string;
}

interface RevenueData {
  date_period: string;
  auction_revenue: number;
  package_revenue: number;
  total_revenue: number;
  bids_count: number;
}

const serializeFilters = (filters?: FinancialFilters): string => {
  if (!filters) return 'default';
  return JSON.stringify({
    startDate: filters.startDate?.toISOString() || null,
    endDate: filters.endDate?.toISOString() || null,
    realOnly: filters.realOnly,
    revenueType: filters.revenueType,
    period: filters.period,
  });
};

export const useFinancialAnalytics = (filters?: FinancialFilters) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [auctionDetails, setAuctionDetails] = useState<AuctionFinancialData[]>([]);
  const [revenueTrends, setRevenueTrends] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isRefreshingRef = useRef(false);
  const lastFiltersRef = useRef<string>('');
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchFinancialSummary = async (f?: FinancialFilters) => {
    try {
      const startDate = f?.startDate ? f.startDate.toISOString().split('T')[0] : null;
      const endDate = f?.endDate ? f.endDate.toISOString().split('T')[0] : null;
      const realOnly = f?.realOnly || false;

      const { data, error } = await supabase.rpc('get_financial_summary_filtered', {
        start_date: startDate,
        end_date: endDate,
        real_only: realOnly
      });
      
      if (error) throw error;
      if (data && data.length > 0 && isMountedRef.current) {
        setSummary(data[0]);
      }
    } catch (err) {
      console.error('Error fetching financial summary:', err);
      if (isMountedRef.current) setError('Erro ao carregar resumo financeiro');
    }
  };

  const fetchAuctionDetails = async () => {
    try {
      const { data: auctions, error: auctionsError } = await supabase
        .from('auctions')
        .select('id, title, status')
        .order('created_at', { ascending: false })
        .limit(20);

      if (auctionsError) throw auctionsError;

      if (auctions && auctions.length > 0) {
        const results = await Promise.all(
          auctions.map(async (auction) => {
            const { data, error } = await supabase.rpc('get_auction_financials', {
              auction_uuid: auction.id
            });
            if (error) return null;
            return data && data.length > 0 ? data[0] : null;
          })
        );
        const validResults = results.filter((r): r is AuctionFinancialData => r !== null);
        if (isMountedRef.current) setAuctionDetails(validResults);
      }
    } catch (err) {
      console.error('Error fetching auction details:', err);
      if (isMountedRef.current) setError('Erro ao carregar detalhes dos leilões');
    }
  };

  const fetchRevenueTrends = async (f?: FinancialFilters) => {
    try {
      const startDate = f?.startDate ? f.startDate.toISOString().split('T')[0] : null;
      const endDate = f?.endDate ? f.endDate.toISOString().split('T')[0] : null;
      const realOnly = f?.realOnly || false;

      const { data, error } = await supabase.rpc('get_revenue_trends_filtered', {
        start_date: startDate,
        end_date: endDate,
        real_only: realOnly
      });
      
      if (error) throw error;
      if (data && isMountedRef.current) {
        setRevenueTrends(data);
      }
    } catch (err) {
      console.error('Error fetching revenue trends:', err);
      if (isMountedRef.current) setError('Erro ao carregar tendências de receita');
    }
  };

  const refreshData = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchFinancialSummary(filters),
        fetchAuctionDetails(),
        fetchRevenueTrends(filters)
      ]);
    } catch (err) {
      console.error('Error refreshing financial data:', err);
      if (isMountedRef.current) setError('Erro ao carregar dados financeiros');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
      isRefreshingRef.current = false;
    }
  }, [filters]);

  useEffect(() => {
    const serialized = serializeFilters(filters);
    if (serialized === lastFiltersRef.current) return;
    lastFiltersRef.current = serialized;
    refreshData();
  }, [filters, refreshData]);

  return {
    summary,
    auctionDetails,
    revenueTrends,
    loading,
    error,
    refreshData,
    isRefreshing: loading
  };
};