import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Target, Trash2, Search, AlertCircle, Plus, X } from 'lucide-react';
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
  const [predefinedWinnerIds, setPredefinedWinnerIds] = useState<string[]>([]);
  const [predefinedProfiles, setPredefinedProfiles] = useState<Profile[]>([]);
  const [leadingStatus, setLeadingStatus] = useState<LeadingStatus>('unknown');
  const [leadingUserId, setLeadingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
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
      .select('predefined_winner_ids, predefined_winner_id')
      .eq('id', auctionId)
      .single();

    const a: any = auction;
    const arr: string[] = Array.isArray(a?.predefined_winner_ids) ? a.predefined_winner_ids : [];
    const legacy: string | null = a?.predefined_winner_id || null;
    const ids = Array.from(new Set([...arr, ...(legacy ? [legacy] : [])]));
    setPredefinedWinnerIds(ids);

    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      setPredefinedProfiles(profs || []);

      const { data: lastBid } = await supabase
        .from('bids')
        .select('user_id')
        .eq('auction_id', auctionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastBid) {
        setLeadingStatus('no_bids');
        setLeadingUserId(null);
      } else if (ids.includes(lastBid.user_id)) {
        setLeadingStatus('target_leading');
        setLeadingUserId(lastBid.user_id);
      } else {
        setLeadingStatus('other_leading');
        setLeadingUserId(lastBid.user_id);
      }
    } else {
      setPredefinedProfiles([]);
      setLeadingStatus('unknown');
      setLeadingUserId(null);
    }
  };

  useEffect(() => {
    refreshState();
    const interval = setInterval(refreshState, 5000);
    return () => clearInterval(interval);
  }, [auctionId]);

  const filteredUsers = useMemo(() => {
    const exclude = new Set(predefinedWinnerIds);
    const base = users.filter(u => !exclude.has(u.user_id));
    if (!search.trim()) return base.slice(0, 50);
    const q = search.toLowerCase();
    return base
      .filter(u => (u.full_name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, search, predefinedWinnerIds]);

  const persistIds = async (newIds: string[], action: 'add' | 'remove' | 'clear', changedProfile?: Profile) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('auctions')
        .update({ predefined_winner_ids: newIds, predefined_winner_id: newIds[0] || null } as any)
        .eq('id', auctionId);

      if (error) throw error;

      const actionType =
        action === 'clear' ? 'clear_predefined_winner' :
        action === 'add' ? 'add_predefined_winner' : 'remove_predefined_winner';

      const description =
        action === 'clear'
          ? `Vencedores predefinidos removidos de "${auctionTitle}"`
          : action === 'add'
            ? `Vencedor predefinido adicionado a "${auctionTitle}": ${changedProfile?.full_name || changedProfile?.email}`
            : `Vencedor predefinido removido de "${auctionTitle}": ${changedProfile?.full_name || changedProfile?.email}`;

      await supabase.from('admin_audit_log').insert({
        admin_user_id: user!.id,
        admin_name: user!.email || 'Admin',
        action_type: actionType,
        target_type: 'auction',
        target_id: auctionId,
        description,
        new_values: { predefined_winner_ids: newIds } as any,
      });

      toast({ title: 'Atualizado', description });
      await refreshState();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = (targetUserId: string) => {
    if (predefinedWinnerIds.includes(targetUserId)) return;
    const profile = users.find(u => u.user_id === targetUserId);
    persistIds([...predefinedWinnerIds, targetUserId], 'add', profile);
    setSearch('');
  };

  const handleRemove = (targetUserId: string) => {
    const profile = predefinedProfiles.find(p => p.user_id === targetUserId);
    persistIds(predefinedWinnerIds.filter(id => id !== targetUserId), 'remove', profile);
  };

  const handleClearAll = () => {
    persistIds([], 'clear');
  };

  const globalStatusBadge = () => {
    switch (leadingStatus) {
      case 'target_leading':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">🟢 Um alvo lidera — bots inativos</Badge>;
      case 'other_leading':
        return <Badge className="bg-amber-600 hover:bg-amber-700 text-white">🟡 Outro lidera — bots ativos</Badge>;
      case 'no_bids':
        return <Badge variant="outline">⚪ Aguardando lances</Badge>;
      default:
        return null;
    }
  };

  const hasTargets = predefinedWinnerIds.length > 0;

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Target className="h-4 w-4" />
          Vencedores Predefinidos (opcional)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Pode escolher múltiplos alvos. Quando qualquer um deles lança e segue como último lance,
          os bots ficam inativos até o timer zerar. Vence quem segurar o último lance.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasTargets && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {predefinedWinnerIds.length} alvo(s) selecionado(s)
              </div>
              <div className="flex items-center gap-2">
                {globalStatusBadge()}
                <Button size="sm" variant="ghost" onClick={handleClearAll} disabled={saving} className="h-7 text-xs">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Limpar todos
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              {predefinedProfiles.map((p) => {
                const isLeading = leadingUserId === p.user_id;
                return (
                  <div
                    key={p.user_id}
                    className={`flex items-center justify-between gap-2 p-2 rounded-md ${isLeading ? 'bg-emerald-500/10 border border-emerald-500/40' : 'bg-muted/50'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{p.full_name || 'Sem nome'}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    {isLeading && <Badge className="bg-emerald-600 text-white text-[10px]">LIDERANDO</Badge>}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemove(p.user_id)}
                      disabled={saving}
                      className="h-7 w-7 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground p-2 bg-muted/30 rounded">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
              <span>O alvo só vence se mantiver o último lance até o timer zerar. Se outro real cobrir, bots voltam a operar.</span>
            </div>
          </div>
        )}

        {!showSearch ? (
          <Button
            variant={hasTargets ? 'outline' : 'default'}
            size="sm"
            onClick={() => setShowSearch(true)}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-1" />
            {hasTargets ? 'Adicionar outro alvo' : 'Adicionar alvo'}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuário por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 border rounded-md p-1">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-4">Nenhum usuário encontrado</div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleAdd(u.user_id)}
                    disabled={saving}
                    className="w-full text-left p-2 rounded hover:bg-muted text-sm transition-colors disabled:opacity-50"
                  >
                    <div className="font-medium truncate">{u.full_name || 'Sem nome'}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </button>
                ))
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setShowSearch(false); setSearch(''); }} className="w-full">
              Fechar busca
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
