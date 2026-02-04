import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = "launch_banner_dismissed";
const EXPIRY_DAYS = 7;

export interface LaunchBannerConfig {
  isVisible: boolean;
  isLoading: boolean;
  title: string;
  subtitle: string;
  highlight: string;
  cta1: { text: string; link: string };
  cta2: { text: string; link: string };
  mobileCta: { text: string; link: string };
  expiresAt: Date | null;
}

interface BannerSettings {
  launch_banner_enabled: boolean;
  launch_banner_title: string;
  launch_banner_subtitle: string;
  launch_banner_highlight: string;
  launch_banner_cta1_text: string;
  launch_banner_cta1_link: string;
  launch_banner_cta2_text: string;
  launch_banner_cta2_link: string;
  launch_banner_mobile_cta_text: string;
  launch_banner_expires_at: string;
}

const fetchBannerSettings = async (): Promise<BannerSettings> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value, setting_type')
    .like('setting_key', 'launch_banner_%');

  if (error) throw error;

  const settings: Record<string, any> = {};
  
  data?.forEach((item) => {
    const key = item.setting_key as keyof BannerSettings;
    if (item.setting_type === 'boolean') {
      settings[key] = item.setting_value === 'true';
    } else {
      settings[key] = item.setting_value;
    }
  });

  return {
    launch_banner_enabled: settings.launch_banner_enabled ?? true,
    launch_banner_title: settings.launch_banner_title ?? '🎉 LANÇAMENTO OFICIAL!',
    launch_banner_subtitle: settings.launch_banner_subtitle ?? 'A plataforma Show de Lances está no ar!',
    launch_banner_highlight: settings.launch_banner_highlight ?? 'Cada lance custa apenas R$ 1!',
    launch_banner_cta1_text: settings.launch_banner_cta1_text ?? 'Ver Leilões',
    launch_banner_cta1_link: settings.launch_banner_cta1_link ?? '/#leiloes',
    launch_banner_cta2_text: settings.launch_banner_cta2_text ?? 'Comprar Lances',
    launch_banner_cta2_link: settings.launch_banner_cta2_link ?? '/pacotes',
    launch_banner_mobile_cta_text: settings.launch_banner_mobile_cta_text ?? 'Participar',
    launch_banner_expires_at: settings.launch_banner_expires_at ?? '',
  };
};

const checkDismissedInStorage = (): boolean => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const { timestamp } = JSON.parse(stored);
      const daysPassed = (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
      if (daysPassed >= EXPIRY_DAYS) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  return false;
};

const checkExpired = (expiresAt: string): boolean => {
  if (!expiresAt) return false;
  const expiryDate = new Date(expiresAt);
  return !isNaN(expiryDate.getTime()) && expiryDate.getTime() < Date.now();
};

export const useLaunchBanner = (): LaunchBannerConfig => {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['launch-banner-settings'],
    queryFn: fetchBannerSettings,
    staleTime: 60 * 1000, // 1 minute
    refetchOnWindowFocus: false,
  });

  const isDismissed = checkDismissedInStorage();
  const isExpired = settings ? checkExpired(settings.launch_banner_expires_at) : false;
  const isEnabled = settings?.launch_banner_enabled ?? false;

  const isVisible = !isLoading && isEnabled && !isDismissed && !isExpired;

  const expiresAt = settings?.launch_banner_expires_at 
    ? new Date(settings.launch_banner_expires_at) 
    : null;

  return {
    isVisible,
    isLoading,
    title: settings?.launch_banner_title ?? '',
    subtitle: settings?.launch_banner_subtitle ?? '',
    highlight: settings?.launch_banner_highlight ?? '',
    cta1: {
      text: settings?.launch_banner_cta1_text ?? '',
      link: settings?.launch_banner_cta1_link ?? '',
    },
    cta2: {
      text: settings?.launch_banner_cta2_text ?? '',
      link: settings?.launch_banner_cta2_link ?? '',
    },
    mobileCta: {
      text: settings?.launch_banner_mobile_cta_text ?? '',
      link: settings?.launch_banner_cta1_link ?? '', // Same link as CTA1
    },
    expiresAt: expiresAt && !isNaN(expiresAt.getTime()) ? expiresAt : null,
  };
};

export const dismissLaunchBanner = (): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
};
