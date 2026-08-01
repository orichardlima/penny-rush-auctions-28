import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Megaphone, Send, History } from 'lucide-react';

interface Communication {
  id: string;
  title: string;
  message: string;
  link: string | null;
  audience: string;
  recipients_count: number;
  read_count: number;
  created_at: string;
}

const AUDIENCE_LABEL: Record<string, string> = {
  active_partners: 'Parceiros ativos',
  all_partners: 'Todos os parceiros',
};

export default function ExpansionCommunicationPanel() {
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Communication[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [link, setLink] = useState('/minha-parceria?tab=expansion');
  const [audience, setAudience] = useState('active_partners');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('expansion_admin_communications', { _limit: 50 });
    if (error) {
      toast.error('Erro ao carregar comunicados: ' + error.message);
    } else {
      setHistory((data as unknown as Communication[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Informe título e mensagem.');
      return;
    }
    setSending(true);
    const { data, error } = await supabase.rpc('expansion_admin_broadcast', {
      _title: title.trim(),
      _message: message.trim(),
      _link: link.trim() || null,
      _audience: audience,
    });
    setSending(false);
    if (error) {
      toast.error('Erro ao enviar: ' + error.message);
      return;
    }
    const recipients = (data as { recipients?: number } | null)?.recipients ?? 0;
    toast.success(`Comunicado enviado para ${recipients} parceiro(s).`);
    setTitle('');
    setMessage('');
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Megaphone className="h-4 w-4" /> Comunicado oficial
          </CardTitle>
          <CardDescription>
            Envia uma notificação para os parceiros do Programa de Expansão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ajuste no teto semanal" />
            </div>
            <div className="space-y-1">
              <Label>Público-alvo</Label>
              <Select value={audience} onValueChange={setAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active_partners">Parceiros ativos</SelectItem>
                  <SelectItem value="all_partners">Todos os parceiros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Mensagem</Label>
            <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Escreva o comunicado..." />
          </div>
          <div className="space-y-1">
            <Label>Link (opcional)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/minha-parceria?tab=expansion" />
          </div>
          <Button onClick={handleSend} disabled={sending} className="gap-2">
            <Send className="h-4 w-4" /> {sending ? 'Enviando...' : 'Enviar comunicado'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Histórico de comunicados
          </CardTitle>
          <CardDescription>Últimos 50 envios, com alcance e leitura.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum comunicado enviado até agora.</p>
          ) : (
            history.map((c) => (
              <div key={c.id} className="rounded-lg border p-3 space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{c.title}</span>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{AUDIENCE_LABEL[c.audience] || c.audience}</Badge>
                    <Badge variant="secondary">{c.recipients_count} destinatários</Badge>
                    <Badge variant="secondary">{c.read_count} leram</Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{c.message}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleString('pt-BR')}
                  {c.link ? ` • ${c.link}` : ''}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
