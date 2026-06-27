import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type DownloadCategory = 'contrato' | 'apresentacao' | 'kit_divulgacao' | 'regulamento' | 'outros';

export interface PlatformDownload {
  id: string;
  title: string;
  description: string | null;
  category: DownloadCategory;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  display_order: number;
  is_active: boolean;
  download_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const CATEGORY_LABELS: Record<DownloadCategory, string> = {
  contrato: 'Contratos',
  apresentacao: 'Apresentações',
  kit_divulgacao: 'Kit de Divulgação',
  regulamento: 'Regulamentos',
  outros: 'Outros',
};

export function usePlatformDownloads(includeInactive = false) {
  const [items, setItems] = useState<PlatformDownload[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('platform_downloads').select('*').order('category').order('display_order').order('created_at', { ascending: false });
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (!error && data) setItems(data as PlatformDownload[]);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { fetch(); }, [fetch]);

  return { items, loading, refresh: fetch };
}

export async function getSignedDownloadUrl(path: string, fileName: string) {
  const { data, error } = await supabase.storage
    .from('platform-downloads')
    .createSignedUrl(path, 300, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}
