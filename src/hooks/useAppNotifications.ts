import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  metadata: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

export const useAppNotifications = (limit = 20) => {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); return; }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications' as any)
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      setItems((data as any) || []);
    } catch (e) {
      console.error('[useAppNotifications] load', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => { load(); }, [load]);

  // realtime
  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, load]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const markAsRead = useCallback(async (id: string) => {
    await supabase
      .from('notifications' as any)
      .update({ read_at: new Date().toISOString() })
      .eq('id', id);
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await supabase
      .from('notifications' as any)
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null);
    setItems((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: new Date().toISOString() }));
  }, [user?.id]);

  return { items, loading, unreadCount, markAsRead, markAllRead, reload: load };
};
