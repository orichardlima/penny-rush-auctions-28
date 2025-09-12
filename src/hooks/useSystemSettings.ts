import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SystemSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  setting_type: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export const useSystemSettings = () => {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('setting_key');

      if (error) throw error;
      setSettings(data || []);
    } catch (error) {
      console.error('Error fetching system settings:', error);
      toast({
        variant: "destructive",
        title: "Erro ao carregar configurações",
        description: "Não foi possível carregar as configurações do sistema."
      });
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (settingKey: string, newValue: string) => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('system_settings')
        .update({ setting_value: newValue })
        .eq('setting_key', settingKey);

      if (error) throw error;

      // Update local state
      setSettings(prev => prev.map(setting => 
        setting.setting_key === settingKey 
          ? { ...setting, setting_value: newValue, updated_at: new Date().toISOString() }
          : setting
      ));

      toast({
        title: "Configuração atualizada",
        description: "A configuração foi salva com sucesso."
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: "Não foi possível salvar a configuração."
      });
    } finally {
      setUpdating(false);
    }
  };

  const getSetting = (key: string): SystemSetting | undefined => {
    return settings.find(setting => setting.setting_key === key);
  };

  const getSettingValue = (key: string, defaultValue: any = null): any => {
    const setting = getSetting(key);
    if (!setting) return defaultValue;

    switch (setting.setting_type) {
      case 'boolean':
        return setting.setting_value === 'true';
      case 'number':
        return parseInt(setting.setting_value) || 0;
      default:
        return setting.setting_value;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return {
    settings,
    loading,
    updating,
    fetchSettings,
    updateSetting,
    getSetting,
    getSettingValue
  };
};