import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function MagenQueueAlert() {
  const [stale, setStale] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase.rpc as any)('magenpay_queue_health');
      if (alive && data) setStale(Number(data.stale_count) || 0);
    };
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  if (!stale) return null;
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Verificação de PIX Magen atrasada</AlertTitle>
      <AlertDescription>
        {stale} cobrança(s) pendente(s) sem verificação há mais de 10 minutos. Confira o agendador externo da recuperação.
      </AlertDescription>
    </Alert>
  );
}
