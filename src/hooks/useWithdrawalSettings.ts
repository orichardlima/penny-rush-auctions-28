import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WithdrawalSettings {
  allowedDays: number[];
  startHour: number;
  endHour: number;
  feePercentage: number;
  partnerMinWithdrawal: number;
  affiliateMinWithdrawal: number;
}

const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

export const useWithdrawalSettings = () => {
  const [settings, setSettings] = useState<WithdrawalSettings>({
    allowedDays: [1, 2, 3, 4, 5],
    startHour: 8,
    endHour: 18,
    feePercentage: 0,
    partnerMinWithdrawal: 50,
    affiliateMinWithdrawal: 50,
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .in('setting_key', [
          'withdrawal_allowed_days',
          'withdrawal_start_hour',
          'withdrawal_end_hour',
          'withdrawal_fee_percentage',
          'partner_min_withdrawal',
          'affiliate_min_withdrawal',
        ]);

      if (error) throw error;

      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        map[row.setting_key] = row.setting_value;
      });

      setSettings({
        allowedDays: map['withdrawal_allowed_days']
          ? map['withdrawal_allowed_days'].split(',').map(Number).filter((n) => !isNaN(n))
          : [1, 2, 3, 4, 5],
        startHour: parseInt(map['withdrawal_start_hour']) || 8,
        endHour: parseInt(map['withdrawal_end_hour']) || 18,
        feePercentage: parseFloat(map['withdrawal_fee_percentage']) || 0,
        partnerMinWithdrawal: parseFloat(map['partner_min_withdrawal']) || 50,
        affiliateMinWithdrawal: parseFloat(map['affiliate_min_withdrawal']) || 50,
      });
    } catch (error) {
      console.error('Error fetching withdrawal settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isWithdrawalWindowOpen = useCallback((): { open: boolean; reason?: string } => {
    // Get current time in BRT (America/Sao_Paulo)
    const now = new Date();
    const brt = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const currentDay = brt.getDay(); // 0=Sun, 1=Mon...
    const currentHour = brt.getHours();

    if (!settings.allowedDays.includes(currentDay)) {
      const allowedDayNames = settings.allowedDays.map((d) => DAY_NAMES[d]).join(', ');
      return {
        open: false,
        reason: `Saques permitidos apenas: ${allowedDayNames}`,
      };
    }

    if (currentHour < settings.startHour || currentHour >= settings.endHour) {
      return {
        open: false,
        reason: `Saques permitidos das ${settings.startHour}h às ${settings.endHour}h (horário de Brasília)`,
      };
    }

    return { open: true };
  }, [settings]);

  const calculateFee = useCallback(
    (amount: number): { feeAmount: number; netAmount: number; feePercentage: number } => {
      const feeAmount = Math.round(amount * settings.feePercentage) / 100;
      return {
        feePercentage: settings.feePercentage,
        feeAmount,
        netAmount: Math.round((amount - feeAmount) * 100) / 100,
      };
    },
    [settings.feePercentage]
  );

  return {
    settings,
    loading,
    isWithdrawalWindowOpen,
    calculateFee,
    refetch: fetchSettings,
  };
};

export { DAY_NAMES };
