import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Clock, Target, TrendingUp, Calendar, User, Settings, UserCheck, Link2, Phone, MapPin, IdCard } from 'lucide-react';
import { formatCPF, formatPhone } from '@/utils/validators';
import { useUserAnalytics } from '@/hooks/useUserAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { AdminUserActions } from '@/components/AdminUserManagement';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface UserProfileCardProps {
  userId: string;
  userName: string;
  userEmail?: string;
  userBalance?: number;
  onUserUpdated?: () => void;
}

const UserProfileCard: React.FC<UserProfileCardProps> = ({
  userId,
  userName,
  userEmail,
  userBalance,
  onUserUpdated
}) => {
  const { analytics, loading, error } = useUserAnalytics(userId);
  const { profile } = useAuth();
  const isAdmin = profile?.is_admin;

  const { data: partnerContract } = useQuery({
    queryKey: ['user-partner-contract', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('partner_contracts')
        .select('plan_name, is_demo, cotas, status')
        .eq('user_id', userId)
        .eq('status', 'ACTIVE')
        .maybeSingle();
      return data;
    },
  });

  const { data: referralInfo } = useQuery({
    queryKey: ['user-referral-info', userId],
    queryFn: async () => {
      // 1. Check affiliate_referrals for who referred this user
      const { data: affRef } = await supabase
        .from('affiliate_referrals')
        .select('affiliate_id, created_at')
        .eq('referred_user_id', userId)
        .not('referred_user_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let affiliateReferrer: { name: string; code: string; date: string } | null = null;

      if (affRef) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('affiliate_code, user_id')
          .eq('id', affRef.affiliate_id)
          .single();

        if (affiliate) {
          const { data: refProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', affiliate.user_id)
            .single();

          affiliateReferrer = {
            name: refProfile?.full_name || 'Desconhecido',
            code: affiliate.affiliate_code,
            date: affRef.created_at,
          };
        }
      }

      // 2. Check partner_contracts for sponsor
      const { data: partnerContract } = await supabase
        .from('partner_contracts')
        .select('referred_by_user_id, created_at')
        .eq('user_id', userId)
        .not('referred_by_user_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      let partnerReferrer: { name: string; date: string; pending?: boolean; signupLink?: boolean } | null = null;

      if (partnerContract?.referred_by_user_id) {
        const { data: sponsorProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('user_id', partnerContract.referred_by_user_id)
          .single();

        partnerReferrer = {
          name: sponsorProfile?.full_name || 'Desconhecido',
          date: partnerContract.created_at,
        };
      }

      // 3. Fallback: check partner_payment_intents for pending partner referrals
      if (!affiliateReferrer && !partnerReferrer) {
        const { data: paymentIntent } = await supabase
          .from('partner_payment_intents')
          .select('referred_by_user_id, referral_code, created_at')
          .eq('user_id', userId)
          .not('referred_by_user_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (paymentIntent?.referred_by_user_id) {
          const { data: intentProfile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', paymentIntent.referred_by_user_id)
            .single();

          partnerReferrer = {
            name: intentProfile?.full_name || 'Desconhecido',
            date: paymentIntent.created_at,
            pending: true,
          };
        }
      }

      // 4. Fallback: check profiles.referred_by_partner_code (saved at signup)
      if (!affiliateReferrer && !partnerReferrer) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('referred_by_partner_code')
          .eq('user_id', userId)
          .maybeSingle();

        if (userProfile?.referred_by_partner_code) {
          // Find active contract with that referral code
          const { data: sponsorContracts } = await supabase
            .rpc('get_contract_by_referral_code', { code: userProfile.referred_by_partner_code });
          const sponsorContract = sponsorContracts?.[0] || null;

          if (sponsorContract) {
            const { data: sponsorProfiles } = await supabase
              .rpc('get_public_profiles', { user_ids: [sponsorContract.user_id] });
            const sponsorProfile = sponsorProfiles?.[0] || null;

            partnerReferrer = {
              name: sponsorProfile?.full_name || 'Desconhecido',
              date: new Date().toISOString(),
              pending: false,
              signupLink: true,
            };
          }
        }
      }

      return { affiliateReferrer, partnerReferrer };
    },
    enabled: !!isAdmin,
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="animate-pulse p-6">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-muted rounded-full" />
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !analytics) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-destructive">Erro ao carregar dados do usuário</p>
        </CardContent>
      </Card>
    );
  }

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'VIP': return 'bg-purple-100 text-purple-800';
      case 'Premium': return 'bg-yellow-100 text-yellow-800';
      case 'Ativo': return 'bg-green-100 text-green-800';
      case 'Parceiro': return 'bg-emerald-100 text-emerald-800';
      case 'Casual': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const winRate = analytics.auctions_participated > 0 
    ? (analytics.auctions_won / analytics.auctions_participated * 100) 
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {userName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <CardTitle className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {userName}
              </div>
              {isAdmin && onUserUpdated && analytics && (
                <AdminUserActions 
                  user={{
                    user_id: userId,
                    full_name: userName,
                    email: userEmail || '',
                    bids_balance: userBalance || 0, // Use actual balance from props
                    is_blocked: false, // This would need to come from a separate query
                    block_reason: undefined
                  }}
                  onUserUpdated={onUserUpdated}
                />
              )}
            </CardTitle>
            <CardDescription>{userEmail}</CardDescription>
            <div className="flex gap-2 mt-2">
              <Badge className={getClassificationColor(analytics.user_classification)}>
                {analytics.user_classification}
              </Badge>
              {partnerContract && (
                <>
                  <Badge className="bg-blue-100 text-blue-800">{partnerContract.plan_name}</Badge>
                  {partnerContract.is_demo && (
                    <Badge className="bg-orange-100 text-orange-800">Demo</Badge>
                  )}
                  {partnerContract.cotas > 1 && (
                    <Badge className="bg-indigo-100 text-indigo-800">{partnerContract.cotas} Cotas</Badge>
                  )}
                </>
              )}
              {analytics.is_bot && (
                <Badge variant="secondary">Bot</Badge>
              )}
            </div>
            {/* Indicado por */}
            {isAdmin && referralInfo && (
              <div className="mt-3 p-2 bg-muted/50 rounded-md">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-1">
                  <UserCheck className="h-3 w-3" />
                  Indicado por
                </p>
                {referralInfo.affiliateReferrer ? (
                  <div className="text-sm">
                    <span className="font-medium">{referralInfo.affiliateReferrer.name}</span>
                    <span className="text-muted-foreground ml-1 text-xs">
                      (<Link2 className="h-3 w-3 inline" /> {referralInfo.affiliateReferrer.code})
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">
                      em {new Date(referralInfo.affiliateReferrer.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ) : referralInfo.partnerReferrer ? (
                  <div className="text-sm">
                    <span className="font-medium">{referralInfo.partnerReferrer.name}</span>
                    <span className="text-muted-foreground text-xs ml-1">
                      ({referralInfo.partnerReferrer.signupLink ? 'Cadastro via link de parceiro' : referralInfo.partnerReferrer.pending ? 'Parceria pendente de pagamento' : 'Patrocinador parceria'}) em {new Date(referralInfo.partnerReferrer.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Cadastro direto (sem indicação)</p>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Saldo Atual - Destaque especial */}
        {userBalance !== undefined && (
          <div className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-full">
                  <Settings className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-900">Saldo Atual de Lances</p>
                  <p className="text-2xl font-bold text-emerald-700">R$ {userBalance.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Métricas principais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-primary/5 rounded-lg">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium">Total Gasto</p>
            <p className="text-lg font-bold text-primary">R$ {analytics.total_spent.toFixed(2)}</p>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <Target className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-sm font-medium">Total Lances</p>
            <p className="text-lg font-bold text-blue-600">{analytics.total_bids}</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <Trophy className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-sm font-medium">Leilões Ganhos</p>
            <p className="text-lg font-bold text-green-600">{analytics.auctions_won}</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-sm font-medium">Taxa de Vitória</p>
            <p className="text-lg font-bold text-purple-600">{winRate.toFixed(1)}%</p>
          </div>
        </div>

        {/* Estatísticas detalhadas */}
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Estatísticas Detalhadas
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Leilões Participados:</span>
                <span className="font-medium">{analytics.auctions_participated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Médio por Lance:</span>
                <span className="font-medium">R$ {analytics.avg_bid_cost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Horário Favorito:</span>
                <span className="font-medium">{analytics.favorite_time_slot}</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primeira Atividade:</span>
                <span className="font-medium">
                  {analytics.first_activity 
                    ? new Date(analytics.first_activity).toLocaleDateString('pt-BR')
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última Atividade:</span>
                <span className="font-medium">
                  {analytics.last_activity 
                    ? new Date(analytics.last_activity).toLocaleDateString('pt-BR')
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Eficiência:</span>
                <span className="font-medium">
                  {analytics.total_bids > 0 
                    ? `${(analytics.total_spent / analytics.total_bids).toFixed(2)} R$/lance`
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Análise comportamental */}
        {analytics.user_classification !== 'Inativo' && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <h5 className="font-medium mb-2">Análise Comportamental</h5>
            <p className="text-sm text-muted-foreground">
              {analytics.user_classification === 'VIP' && 
                "Usuário premium com alto valor de gastos. Estratégias personalizadas recomendadas."
              }
              {analytics.user_classification === 'Premium' && 
                "Usuário com gastos significativos. Potencial para upgrades VIP."
              }
              {analytics.user_classification === 'Ativo' && 
                "Usuário engajado com boa frequência de lances. Oportunidade de aumentar gastos."
              }
              {analytics.user_classification === 'Parceiro' && 
                "Parceiro ativo com contrato vigente. Acompanhar rendimentos e indicações."
              }
              {analytics.user_classification === 'Casual' && 
                "Usuário ocasional. Estratégias de engajamento podem aumentar atividade."
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserProfileCard;