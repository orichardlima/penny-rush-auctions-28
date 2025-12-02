import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, UserPlus, ShoppingCart, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ReferralItem {
  id: string;
  created_at: string;
  referred_user_id: string | null;
  converted: boolean;
  user_name: string | null;
  commission_amount: number | null;
}

interface AffiliateReferralsListProps {
  affiliateId: string;
}

type FilterType = 'all' | 'clicks' | 'signups' | 'buyers';

export function AffiliateReferralsList({ affiliateId }: AffiliateReferralsListProps) {
  const [referrals, setReferrals] = useState<ReferralItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 10;

  useEffect(() => {
    fetchReferrals();
  }, [affiliateId, filter, page]);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      // Build query based on filter
      let query = supabase
        .from('affiliate_referrals')
        .select(`
          id,
          created_at,
          referred_user_id,
          converted
        `, { count: 'exact' })
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filter === 'clicks') {
        query = query.is('referred_user_id', null);
      } else if (filter === 'signups') {
        query = query.not('referred_user_id', 'is', null).eq('converted', false);
      } else if (filter === 'buyers') {
        query = query.eq('converted', true);
      }

      // Pagination
      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data: referralsData, error, count } = await query;

      if (error) throw error;

      setTotalCount(count || 0);

      // Fetch user names and commissions for referrals with user_id
      const referralsWithDetails: ReferralItem[] = await Promise.all(
        (referralsData || []).map(async (ref) => {
          let userName: string | null = null;
          let commissionAmount: number | null = null;

          if (ref.referred_user_id) {
            // Get user name
            const { data: profileData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('user_id', ref.referred_user_id)
              .single();

            userName = profileData?.full_name || 'Usuário';

            // Get commission if converted
            if (ref.converted) {
              const { data: commissionData } = await supabase
                .from('affiliate_commissions')
                .select('commission_amount')
                .eq('affiliate_id', affiliateId)
                .eq('referred_user_id', ref.referred_user_id)
                .single();

              commissionAmount = commissionData?.commission_amount || null;
            }
          }

          return {
            ...ref,
            user_name: userName,
            commission_amount: commissionAmount,
          };
        })
      );

      setReferrals(referralsWithDetails);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (item: ReferralItem) => {
    if (item.converted) {
      return (
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
          <ShoppingCart className="w-3 h-3 mr-1" />
          Comprou
        </Badge>
      );
    }
    if (item.referred_user_id) {
      return (
        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
          <UserPlus className="w-3 h-3 mr-1" />
          Cadastrou
        </Badge>
      );
    }
    return (
      <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">
        <Eye className="w-3 h-3 mr-1" />
        Clique
      </Badge>
    );
  };

  const totalPages = Math.ceil(totalCount / perPage);

  const stats = {
    clicks: referrals.filter(r => !r.referred_user_id).length,
    signups: referrals.filter(r => r.referred_user_id && !r.converted).length,
    buyers: referrals.filter(r => r.converted).length,
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Seus Indicados
            </CardTitle>
            <CardDescription>
              Acompanhe todos que clicaram no seu link
            </CardDescription>
          </div>
          <Select value={filter} onValueChange={(v) => { setFilter(v as FilterType); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar por..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({totalCount})</SelectItem>
              <SelectItem value="clicks">Apenas Cliques</SelectItem>
              <SelectItem value="signups">Cadastrados</SelectItem>
              <SelectItem value="buyers">Compradores</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referrals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum indicado encontrado</p>
            <p className="text-sm mt-1">Compartilhe seu link para começar a receber indicados!</p>
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.user_name || (
                          <span className="text-muted-foreground italic">Visitante</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.commission_amount ? (
                          <span className="text-emerald-600 font-semibold">
                            {formatPrice(item.commission_amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Mostrando {((page - 1) * perPage) + 1} a {Math.min(page * perPage, totalCount)} de {totalCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
