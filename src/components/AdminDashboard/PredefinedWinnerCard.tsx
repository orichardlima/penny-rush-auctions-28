import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Target, Trash2, Search, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

interface PredefinedWinnerCardProps {
  auctionId: string;
  auctionTitle: string;
}

type LeadingStatus = 'no_bids' | 'target_leading' | 'other_leading' | 'unknown';

export const PredefinedWinnerCard: React.FC<PredefinedWinnerCardProps> = ({ auctionId, auctionTitle }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<Profile[]>([]);
  const [predefinedWinnerId, setPredefinedWinnerId] = useState<string | null>(null);
  const [predefinedWinnerProfile, setPredefinedWinnerProfile] = useState<Profile | null>(null);
  const [leadingStatus, setLeadingStatus] = useState<LeadingStatus>('unknown');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Carregar usuários reais (não-bot, não-admin)
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('is_bot', false)
        .eq('is_admin', false)
        .order('full_name', { ascending: true })
        .limit(500);
      setUsers(data || []);
    })();
  }, []);

  // Carregar estado atual do leilão + status de liderança
  const refreshState = async () => {
    const { data: auction } = await supabase
      .from('auctions')
      .select('predefined_winner_id')
      .eq('id', auctionId)
      .single();

    const winnerId = (auction as any)?.predefined_winner_id || null;
    setPredefinedWinnerId(winnerId);

    if (winnerId) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .eq('user_id', winnerId)
        .single();
      setPredefinedWinnerProfile(prof || null);

      const { data: lastBid } = await supabase
        .from('bids')
        .select('user_id')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastBid) setLeadingStatus('no_bids');
      else if (lastBid.user_id === winnerId) setLeadingStatus('target_leading');
      else setLeadingStatus('other_leading');
    } else {
      setPredefinedWinnerProfile(null);
      setLeadingStatus('unknown');
    }
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 5000);
    return () => clearInterval(interval);
  }, [auctionId]);

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return users.slice(0, 50);
    const q = search.toLowerCase();
    return users
      .filter(u => (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, search]);

  const handleSave = async (targetUserId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ predefined_winner_id: targetUserId } as any)
        .eq('id', auctionId);

      if (error) throw error;

      // Audit log
      const targetProfile = users.find(u => u.user_id === targetUserId);
      await supabase.from('admin_audit_log').insert({
        admin_user_id: user!.id,
        admin_name: user!.email || 'Admin',
        action_type: 'set_predefined_winner',
        target_type: 'auction',
        target_id: auctionId,
        description: `Vencedor predefinido definido para "${auctionTitle}": ${targetProfile?.full_name || targetProfile?.email}`,
        new_values: { predefined_winner_id: targetUserId } as any,
      });

      toast({ title: 'Vencedor predefinido salvo', description: targetProfile?.full_name || targetProfile?.email || '' });
      await refreshState();
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ predefined_winner_id: null } as any)
        .eq('id', auctionId);

      if (error) throw error;

      await supabase.from('admin_audit_log').insert({
        admin_user_id: user!.id,
        admin_name: user!.email || 'Admin',
        action_type: 'clear_predefined_winner',
        target_type: 'auction',
        target_id: auctionId,
        description: `Vencedor predefinido removido de "${auctionTitle}"`,
      });

      toast({ title: 'Vencedor predefinido removido' });
      await refreshState();
    } catch (e: any) {
      toast({ title: 'Erro ao limpar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = () => {
    switch (leadingStatus) {
      case 'target_leading':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">🟢 Alvo lidera — bots inativos</Badge>;
      case 'other_leading':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">🟡 Alvo precisa cobrir — bots ativos</Badge>;
      case 'no_bids':
        return <Badge variant="outline">⚪ Aguardando alvo lançar</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Vencedor Predefinido (opcional)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Quando o alvo lança e segue como último lance, bots ficam inativos até o timer zerar.
          Outros jogadores reais podem cobrir normalmente.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {predefinedWinnerId && predefinedWinnerProfile ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2 p-3 rounded-md bg-muted/50">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{predefinedWinnerProfile.full_name || 'Sem nome'}</div>
                <div className="text-xs text-muted-foreground truncate">{predefinedWinnerProfile.email}</div>
                <div className="mt-2">{statusBadge()}</div>
              </div>
              <Button size="sm" variant="destructive" onClick={handleClear} disabled={saving}>
                <Trash2 className="h-3 w-3 mr-1" />
                Limpar
              </Button>
            </div>
            <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>O alvo só vence se mantiver o último lance até o timer zerar (15s). Se outro real cobrir, bots voltam a operar.</span>
            </div>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">Nenhum usuário encontrado</div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleSave(u.user_id)}
                    disabled={saving}
                    className="w-full text-left p-2 rounded hover:bg-muted text-sm transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium truncate">{u.full_name || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
