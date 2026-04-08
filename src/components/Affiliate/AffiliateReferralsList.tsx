import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, UserPlus, ShoppingCart, ChevronLeft, ChevronRight, Users, Copy, MessageCircle, Mail, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface ReferralItem {
  id: string;
  created_at: string;
  referred_user_id: string | null;
  converted: boolean;
  user_name: string | null;
  commission_amount: number | null;
  email: string | null;
  phone: string | null;
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
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const perPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    fetchReferrals();
  }, [affiliateId, filter, page]);

  const fetchReferrals = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('affiliate_referrals')
        .select(`id, created_at, referred_user_id, converted`, { count: 'exact' })
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (filter === 'clicks') {
        query = query.is('referred_user_id', null);
      } else if (filter === 'signups') {
        query = query.not('referred_user_id', 'is', null).eq('converted', false);
      } else if (filter === 'buyers') {
        query = query.eq('converted', true);
      }

      const from = (page - 1) * perPage;
      const to = from + perPage - 1;
      query = query.range(from, to);

      const { data: referralsData, error, count } = await query;
      if (error) throw error;

      setTotalCount(count || 0);

      const userIds = (referralsData || [])
        .filter(r => r.referred_user_id)
        .map(r => r.referred_user_id!);

      // Fetch contacts via secure RPC
      let contactsMap: Record<string, { full_name: string; email: string | null; phone: string | null }> = {};
      if (userIds.length > 0) {
        const { data: contactData } = await supabase
          .rpc('get_affiliate_referral_contacts', {
            _affiliate_id: affiliateId,
            _user_ids: userIds
          });
        if (contactData) {
          for (const c of contactData) {
            contactsMap[c.user_id] = {
              full_name: c.full_name || 'Usuário',
              email: c.email || null,
              phone: c.phone || null
            };
          }
        }
      }

      // Fetch commissions for converted referrals
      const convertedUserIds = (referralsData || [])
        .filter(r => r.converted && r.referred_user_id)
        .map(r => r.referred_user_id!);

      let commissionsMap: Record<string, number> = {};
      if (convertedUserIds.length > 0) {
        const { data: commissionData } = await supabase
          .from('affiliate_commissions')
          .select('referred_user_id, commission_amount')
          .eq('affiliate_id', affiliateId)
          .in('referred_user_id', convertedUserIds);
        if (commissionData) {
          for (const c of commissionData) {
            commissionsMap[c.referred_user_id] = c.commission_amount;
          }
        }
      }

      const referralsWithDetails: ReferralItem[] = (referralsData || []).map((ref) => {
        const contact = ref.referred_user_id ? contactsMap[ref.referred_user_id] : null;
        return {
          ...ref,
          user_name: contact?.full_name || (ref.referred_user_id ? 'Usuário' : null),
          email: contact?.email || null,
          phone: contact?.phone || null,
          commission_amount: ref.referred_user_id ? (commissionsMap[ref.referred_user_id] || null) : null,
        };
      });

      setReferrals(referralsWithDetails);
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!`, description: text });
  };

  const openWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    const number = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${number}`, '_blank');
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                    <TableHead className="hidden md:table-cell">Contato</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="md:hidden w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((item) => {
                    const isExpanded = expandedRows.has(item.id);
                    return (
                      <>
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.user_name || (
                              <span className="text-muted-foreground italic">Visitante</span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(item)}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            {item.referred_user_id ? (
                              <div className="flex items-center gap-1">
                                {item.email && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    title={item.email}
                                    onClick={() => copyToClipboard(item.email!, 'Email')}
                                  >
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                )}
                                {item.phone && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title={item.phone}
                                      onClick={() => copyToClipboard(item.phone!, 'Telefone')}
                                    >
                                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      title="WhatsApp"
                                      onClick={() => openWhatsApp(item.phone!)}
                                    >
                                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                                    </Button>
                                  </>
                                )}
                                {!item.email && !item.phone && (
                                  <span className="text-xs text-muted-foreground">Sem contato</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground">
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
                          <TableCell className="md:hidden">
                            {item.referred_user_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleRow(item.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Mobile expanded row */}
                        {isExpanded && item.referred_user_id && (
                          <TableRow key={`${item.id}-details`} className="md:hidden bg-muted/30">
                            <TableCell colSpan={5} className="py-2 px-4">
                              <div className="flex flex-col gap-1.5 text-sm">
                                <span className="text-muted-foreground text-xs">
                                  {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {item.email && (
                                  <div className="flex items-center gap-2">
                                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="truncate flex-1 text-xs">{item.email}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.email!, 'Email')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                {item.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs">{item.phone}</span>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(item.phone!, 'Telefone')}>
                                      <Copy className="h-3 w-3" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openWhatsApp(item.phone!)}>
                                      <MessageCircle className="h-3 w-3 text-emerald-600" />
                                    </Button>
                                  </div>
                                )}
                                {!item.email && !item.phone && (
                                  <span className="text-xs text-muted-foreground">Sem dados de contato</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

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
