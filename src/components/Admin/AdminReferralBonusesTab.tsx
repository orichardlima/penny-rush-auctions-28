import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, Gift, Clock, CheckCircle, Loader2, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface BonusRow {
  id: string;
  referrer_contract_id: string;
  referred_contract_id: string;
  referred_user_id: string;
  referral_level: number;
  aporte_value: number;
  bonus_percentage: number;
  bonus_value: number;
  status: string;
  is_fast_start_bonus: boolean;
  available_at: string | null;
  paid_at: string | null;
  created_at: string;
  referrer_name?: string;
  referred_name?: string;
}

const AdminReferralBonusesTab: React.FC = () => {
  const [bonuses, setBonuses] = useState<BonusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBonuses();
  }, []);

  const fetchBonuses = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partner_referral_bonuses')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) {
        setBonuses([]);
        setLoading(false);
        return;
      }

      // Get unique user IDs from contracts
      const contractIds = [
        ...new Set([
          ...data.map(b => b.referrer_contract_id),
          ...data.map(b => b.referred_contract_id),
        ])
      ];

      // Fetch contracts to get user_ids
      const { data: contracts } = await supabase
        .from('partner_contracts')
        .select('id, user_id')
        .in('id', contractIds);

      const contractUserMap = new Map(contracts?.map(c => [c.id, c.user_id]) || []);
      const userIds = [...new Set([...contractUserMap.values()])];

      // Fetch names via RPC
      const { data: profiles } = await supabase.rpc('get_public_profiles', { user_ids: userIds });
      const nameMap = new Map(profiles?.map((p: any) => [p.user_id, p.full_name]) || []);

      const enriched: BonusRow[] = data.map(b => ({
        ...b,
        referrer_name: nameMap.get(contractUserMap.get(b.referrer_contract_id) || '') || 'N/A',
        referred_name: nameMap.get(contractUserMap.get(b.referred_contract_id) || '') || 'N/A',
      }));

      setBonuses(enriched);
    } catch (err) {
      console.error('Error fetching bonuses:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return bonuses.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !b.referrer_name?.toLowerCase().includes(s) &&
          !b.referred_name?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });
  }, [bonuses, statusFilter, search]);

  const stats = useMemo(() => {
    const total = bonuses.length;
    const totalValue = bonuses.reduce((s, b) => s + b.bonus_value, 0);
    const pending = bonuses.filter(b => b.status === 'PENDING');
    const available = bonuses.filter(b => b.status === 'AVAILABLE');
    return {
      total,
      totalValue,
      pendingCount: pending.length,
      pendingValue: pending.reduce((s, b) => s + b.bonus_value, 0),
      availableCount: available.length,
      availableValue: available.reduce((s, b) => s + b.bonus_value, 0),
    };
  }, [bonuses]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case 'AVAILABLE':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Disponível</Badge>;
      case 'PAID':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><DollarSign className="h-3 w-3 mr-1" />Pago</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Bônus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">R$ {stats.totalValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-4 w-4 text-yellow-500" /> Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pendingCount}</div>
            <p className="text-xs text-muted-foreground">R$ {stats.pendingValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-500" /> Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.availableCount}</div>
            <p className="text-xs text-muted-foreground">R$ {stats.availableValue.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Gift className="h-4 w-4 text-primary" /> Valor Médio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {stats.total > 0 ? (stats.totalValue / stats.total).toFixed(2) : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">por bônus</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Buscar por nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="PENDING">Pendente</SelectItem>
            <SelectItem value="AVAILABLE">Disponível</SelectItem>
            <SelectItem value="PAID">Pago</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Referenciador</TableHead>
                <TableHead>Indicado</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Aporte</TableHead>
                <TableHead>%</TableHead>
                <TableHead>Valor Bônus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fast Start</TableHead>
                <TableHead>Liberação</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    Nenhum bônus encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.referrer_name}</TableCell>
                    <TableCell>{b.referred_name}</TableCell>
                    <TableCell>{b.referral_level}</TableCell>
                    <TableCell>R$ {b.aporte_value.toFixed(2)}</TableCell>
                    <TableCell>{b.bonus_percentage}%</TableCell>
                    <TableCell className="font-semibold">R$ {b.bonus_value.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(b.status)}</TableCell>
                    <TableCell>
                      {b.is_fast_start_bonus && (
                        <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                          <Zap className="h-3 w-3 mr-1" />FS
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.available_at ? format(new Date(b.available_at), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(b.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReferralBonusesTab;
