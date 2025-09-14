import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FinancialFilters {
  startDate: Date | null;
  endDate: Date | null;
  realDataOnly: boolean;
  revenueType: 'all' | 'auctions' | 'packages';
  period: 'custom' | 'today' | '7days' | '30days' | '90days' | 'year';
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

export const useFinancialAnalytics = (filters?: FinancialFilters) => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [auctionDetails, setAuctionDetails] = useState<AuctionFinancialData[]>([]);
  const [revenueTrends, setRevenueTrends] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchFinancialSummary = async (currentFilters?: FinancialFilters) => {
    try {
      const appliedFilters = currentFilters || filters;
      let data, error;

      if (appliedFilters?.startDate || appliedFilters?.endDate || appliedFilters?.realDataOnly) {
        // Use filtered function
        ({ data, error } = await supabase.rpc('get_financial_summary_filtered', {
          start_date: appliedFilters.startDate ? appliedFilters.startDate.toISOString().split('T')[0] : null,
          end_date: appliedFilters.endDate ? appliedFilters.endDate.toISOString().split('T')[0] : null,
          real_only: appliedFilters.realDataOnly || false
        }));
      } else {
        // Use original function
        ({ data, error } = await supabase.rpc('get_financial_summary'));
      }
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        setSummary(data[0]);
      }
    } catch (err) {
      console.error('Error fetching financial summary:', err);
      setError('Erro ao carregar resumo financeiro');
    }
  };

  const fetchAuctionDetails = async () => {
    try {
      // First get all auctions
      const { data: auctions, error: auctionsError } = await supabase
        .from('auctions')
        .select('id, title, status')
        .order('created_at', { ascending: false });

      if (auctionsError) throw auctionsError;

      if (auctions && auctions.length > 0) {
        // Get financial details for each auction
        const auctionDetailsPromises = auctions.map(async (auction) => {
          const { data, error } = await supabase.rpc('get_auction_financials', {
            auction_uuid: auction.id
          });
          
          if (error) {
            console.error(`Error fetching details for auction ${auction.id}:`, error);
            return null;
          }
          
          return data && data.length > 0 ? data[0] : null;
        });

        const results = await Promise.all(auctionDetailsPromises);
        const validResults = results.filter((result): result is AuctionFinancialData => result !== null);
        
        setAuctionDetails(validResults);
      }
    } catch (err) {
      console.error('Error fetching auction details:', err);
      setError('Erro ao carregar detalhes dos leilões');
    }
  };

  const fetchRevenueTrends = async (currentFilters?: FinancialFilters) => {
    try {
      const appliedFilters = currentFilters || filters;
      let data, error;

      if (appliedFilters?.startDate || appliedFilters?.endDate || appliedFilters?.realDataOnly) {
        // Use filtered function
        ({ data, error } = await supabase.rpc('get_revenue_trends_filtered', {
          start_date: appliedFilters.startDate ? appliedFilters.startDate.toISOString().split('T')[0] : null,
          end_date: appliedFilters.endDate ? appliedFilters.endDate.toISOString().split('T')[0] : null,
          real_only: appliedFilters.realDataOnly || false
        }));
      } else {
        // Use original function
        ({ data, error } = await supabase.rpc('get_revenue_trends'));
      }
      
      if (error) throw error;
      
      if (data) {
        setRevenueTrends(data);
      }
    } catch (err) {
      console.error('Error fetching revenue trends:', err);
      setError('Erro ao carregar tendências de receita');
    }
  };

  const refreshData = async (currentFilters?: FinancialFilters) => {
    // Evitar múltiplas chamadas simultâneas
    if (isRefreshing) {
      console.log('[useFinancialAnalytics] Refresh já em andamento, ignorando');
      return;
    }

    setIsRefreshing(true);
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        fetchFinancialSummary(currentFilters),
        fetchAuctionDetails(),
        fetchRevenueTrends(currentFilters)
      ]);
    } catch (err) {
      console.error('Error refreshing financial data:', err);
      setError('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [filters]);

  // Realtime auto-refresh with debounce
  const refreshTimerRef = useRef<number | null>(null);
  const lastRefreshRef = useRef<number>(0);
  
  useEffect(() => {
    const triggerAutoRefresh = () => {
      const now = Date.now();
      // Evitar refresh muito frequente (mínimo 2 segundos entre chamadas)
      if (now - lastRefreshRef.current < 2000) {
        console.log('[useFinancialAnalytics] Refresh muito frequente, ignorando');
        return;
      }

      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      refreshTimerRef.current = window.setTimeout(() => {
        lastRefreshRef.current = Date.now();
        console.log('[useFinancialAnalytics] Realtime event -> refreshing');
        refreshData();
      }, 1500); // Aumentado para 1.5 segundos
    };

    console.log('[useFinancialAnalytics] Subscribing to realtime changes');
    const channel = supabase
      .channel('financial-analytics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, triggerAutoRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bids' }, triggerAutoRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_purchases' }, triggerAutoRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, triggerAutoRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bid_packages' }, triggerAutoRefresh)
      .subscribe();

    return () => {
      console.log('[useFinancialAnalytics] Unsubscribing realtime channel');
      supabase.removeChannel(channel);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []); // Stable empty dependency array

  return {
    summary,
    auctionDetails,
    revenueTrends,
    loading,
    error,
    refreshData,
    isRefreshing
  };
};