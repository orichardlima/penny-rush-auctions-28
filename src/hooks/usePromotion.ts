import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type PromoMode = 'base' | 'total' | 'bonus';

export interface PromotionData {
  enabled: boolean;
  multiplier: number;
  mode: PromoMode;
  label: string;
  expiresAt: string | null;
  isValid: boolean;
  timeRemaining: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    formatted: string;
  } | null;
}

export const usePromotion = () => {
  const [promoData, setPromoData] = useState<PromotionData | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateTimeRemaining = useCallback((expiresAt: string | null) => {
    if (!expiresAt) return null;
    
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diff = expiry - now;
    
    if (diff <= 0) return null;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0 || days > 0) formatted += `${hours}h `;
    formatted += `${minutes}min ${seconds}s`;
    
    return { days, hours, minutes, seconds, formatted: formatted.trim() };
  }, []);

  const fetchPromoSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'promo_multiplier_enabled',
          'promo_multiplier_value',
          'promo_multiplier_label',
          'promo_multiplier_expires_at',
          'promo_multiplier_mode'
        ]);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach(s => {
        settings[s.setting_key] = s.setting_value;
      });

      const enabled = settings['promo_multiplier_enabled'] === 'true';
      const multiplier = parseFloat(settings['promo_multiplier_value'] || '1') || 1;
      const label = settings['promo_multiplier_label'] || 'PROMOÇÃO';
      const expiresAt = settings['promo_multiplier_expires_at'] || null;
      const mode = (settings['promo_multiplier_mode'] as PromoMode) || 'base';
      
      const timeRemaining = calculateTimeRemaining(expiresAt);
      const isValid = enabled && (!expiresAt || timeRemaining !== null);

      setPromoData({
        enabled,
        multiplier,
        mode,
        label,
        expiresAt,
        isValid,
        timeRemaining
      });
    } catch (error) {
      console.error('Error fetching promotion settings:', error);
      setPromoData(null);
    } finally {
      setLoading(false);
    }
  }, [calculateTimeRemaining]);

  // Fetch initial data
  useEffect(() => {
    fetchPromoSettings();
  }, [fetchPromoSettings]);

  // Update countdown every second
  useEffect(() => {
    if (!promoData?.enabled || !promoData?.expiresAt) return;

    const interval = setInterval(() => {
      const timeRemaining = calculateTimeRemaining(promoData.expiresAt);
      
      setPromoData(prev => {
        if (!prev) return null;
        
        // If time expired, refetch to get fresh data
        if (!timeRemaining && prev.isValid) {
          fetchPromoSettings();
          return prev;
        }
        
        return {
          ...prev,
          isValid: prev.enabled && timeRemaining !== null,
          timeRemaining
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [promoData?.enabled, promoData?.expiresAt, calculateTimeRemaining, fetchPromoSettings]);

  return { promoData, loading, refetch: fetchPromoSettings };
};
