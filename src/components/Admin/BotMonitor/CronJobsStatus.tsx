import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Zap, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface CronJob {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_start: string | null;
  last_end: string | null;
  last_status: string | null;
  last_return_message: string | null;
  duration_ms: number | null;
}

export const CronJobsStatus = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-bot-monitor');
      if (error) throw error;
      setJobs(data?.jobs ?? []);
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro', description: e.message ?? 'Falha ao carregar cron jobs', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const id = setInterval(fetchJobs, 10_000);
    return () => clearInterval(id);
  }, [fetchJobs]);

  const triggerNow = async () => {
    setTriggering(true);
    try {
      const { error } = await supabase.functions.invoke('sync-timers-and-protection');
      if (error) throw error;
      toast({ title: 'Disparado', description: 'sync-timers-and-protection executado.' });
      setTimeout(fetchJobs, 1500);
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  };

  const healthy = jobs.length > 0 && jobs.every(j => j.active && (j.last_status === 'succeeded' || j.last_status === null));
  const since = (ts: string | null) => {
    if (!ts) return '—';
    const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (s < 60) return `${s}s atrás`;
    if (s < 3600) return `${Math.floor(s/60)}min atrás`;
    return `${Math.floor(s/3600)}h atrás`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Cron Jobs — sync-timers-protection</CardTitle>
          {healthy ? (
            <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="h-3 w-3 mr-1" />Saudável</Badge>
          ) : (
            <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchJobs} disabled={loading}>
            <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />Atualizar
          </Button>
          <Button size="sm" onClick={triggerNow} disabled={triggering}>
            <Zap className="h-3 w-3 mr-1" />Disparar agora
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {jobs.map(j => (
            <div key={j.jobid} className="border rounded-md p-2 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-medium truncate">{j.jobname}</span>
                {j.last_status === 'succeeded' ? (
                  <Badge variant="outline" className="text-green-600 border-green-600 text-[10px]">ok</Badge>
                ) : j.last_status ? (
                  <Badge variant="destructive" className="text-[10px]">{j.last_status}</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">—</Badge>
                )}
              </div>
              <div className="text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />{since(j.last_start)}
                {j.duration_ms != null && <span>· {j.duration_ms}ms</span>}
              </div>
            </div>
          ))}
          {jobs.length === 0 && !loading && (
            <div className="text-sm text-muted-foreground col-span-full">Nenhum cron job encontrado.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
