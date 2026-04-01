import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePartnerReferrals } from '@/hooks/usePartnerReferrals';
import { usePartnerContract } from '@/hooks/usePartnerContract';
import PartnerLevelProgress from './PartnerLevelProgress';
import ReferralNetworkTree from './ReferralNetworkTree';
import FastStartProgress from './FastStartProgress';
import SponsorActivateDialog from './SponsorActivateDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Users, 
  Copy, 
  Share2, 
  Gift,
  Clock,
  DollarSign,
  Star,
  GitBranch,
  ChevronDown,
  CheckCircle2,
  UserPlus
} from 'lucide-react';

interface PartnerReferralSectionProps {
  planName?: string;
  isDefaulting?: boolean;
}

const PartnerReferralSection: React.FC<PartnerReferralSectionProps> = ({ planName, isDefaulting = false }) => {
  const { 
    bonuses, 
    referralCode,
    contractId,
    binaryPoints,
    stats, 
    loading,
    getReferralLink,
    copyReferralLink,
    getStatusLabel,
    getStatusColor,
    getLevelLabel,
    getLevelColor
  } = usePartnerReferrals();
  
  const { plans, contract, refreshData } = usePartnerContract();
  const currentPlan = plans.find(p => p.name === planName);
  const referralBonusPercentage = currentPlan?.referral_bonus_percentage || 10;
  const [sponsorDialogOpen, setSponsorDialogOpen] = useState(false);
  const availableBalance = contract?.available_balance ?? 0;

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!referralCode) {
    return null;
  }

  const referralLink = getReferralLink();

  return (
    <div className="space-y-6">
      {/* Bônus de Início Rápido */}
      <FastStartProgress contractId={contractId} />

      {/* Graduação / Nível do Parceiro - baseado na perna menor do binário */}
      <PartnerLevelProgress 
        totalPoints={binaryPoints.weakerLegPoints} 
        planName={planName}
        leftPoints={binaryPoints.leftPoints}
        rightPoints={binaryPoints.rightPoints}
      />

      {/* Link de Indicação */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Indique Parceiros
          </CardTitle>
          <CardDescription className="flex items-center gap-2 flex-wrap">
            Ganhe bônus em <Badge variant="secondary" className="font-bold text-primary">3 níveis</Badge> de indicação! 
            Diretos: <span className="font-semibold">{referralBonusPercentage}%</span> | 
            2º Nível: <span className="font-semibold">2%</span> | 
            3º Nível: <span className="font-semibold">0.5%</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input 
              value={referralLink || ''} 
              readOnly 
              className="font-mono text-sm"
            />
            <Button variant="outline" onClick={copyReferralLink} disabled={isDefaulting} title={isDefaulting ? 'Bloqueado por pendência financeira' : undefined}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Botão Ativar Indicado com Saldo */}
          {availableBalance > 0 && contract?.status === 'ACTIVE' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="w-full">
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={() => setSponsorDialogOpen(true)}
                      disabled={contract.financial_status !== 'paid'}
                    >
                      <UserPlus className="h-4 w-4" />
                      Ativar indicado com saldo ({formatPrice(availableBalance)})
                    </Button>
                  </span>
                </TooltipTrigger>
                {contract.financial_status !== 'paid' && (
                  <TooltipContent>
                    <p>Ativação bloqueada por pendência financeira</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Seu código:</span>
            <Badge variant="outline" className="font-mono">{referralCode}</Badge>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Indicados</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 mx-auto mb-1 text-yellow-600" />
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Em validação</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Gift className="h-5 w-5 mx-auto mb-1 text-green-600" />
              <p className="text-2xl font-bold">{stats.available}</p>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <DollarSign className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-2xl font-bold">{formatPrice(stats.totalValue)}</p>
              <p className="text-xs text-muted-foreground">Total em bônus</p>
            </div>
          </div>

          {/* Estatísticas por Nível */}
          {stats.total > 0 && (
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3">📊 Por Nível de Indicação</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-xs text-muted-foreground mb-1">Diretos</p>
                  <p className="text-lg font-bold text-primary">{stats.byLevel.level1.count}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(stats.byLevel.level1.value)}</p>
                </div>
                <div className="text-center p-2 rounded-lg border border-blue-500/20 bg-blue-500/5">
                  <p className="text-xs text-muted-foreground mb-1">2º Nível</p>
                  <p className="text-lg font-bold text-blue-600">{stats.byLevel.level2.count}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(stats.byLevel.level2.value)}</p>
                </div>
                <div className="text-center p-2 rounded-lg border border-purple-500/20 bg-purple-500/5">
                  <p className="text-xs text-muted-foreground mb-1">3º Nível</p>
                  <p className="text-lg font-bold text-purple-600">{stats.byLevel.level3.count}</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(stats.byLevel.level3.value)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Tree View Toggle */}
          {stats.total > 0 && (
            <Collapsible className="mt-4 pt-4 border-t">
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Ver Árvore de Indicações
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <ReferralNetworkTree />
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>


      {/* Histórico de Indicações */}
      {bonuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Indicações</CardTitle>
            <CardDescription>Todos os bônus de indicação recebidos</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nível</TableHead>
                  <TableHead>Indicado</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Valor do Aporte</TableHead>
                  <TableHead>Bônus</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Liberação</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bonuses.map((bonus) => (
                  <TableRow key={bonus.id}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={getLevelColor(bonus.referral_level)}>
                          {getLevelLabel(bonus.referral_level)}
                        </Badge>
                        {(bonus as any).is_fast_start_bonus && (
                          <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20 text-xs">
                            🚀 Rápido
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {bonus.referred_user_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {bonus.referred_plan_name || '-'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatPrice(bonus.aporte_value)}</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatPrice(bonus.bonus_value)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-primary font-medium">
                        <Star className="h-3 w-3" />
                        +{bonus.points_earned || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(bonus.created_at)}
                    </TableCell>
                    <TableCell>
                      {bonus.status === 'PENDING' && (bonus as any).available_at
                        ? <span className="text-yellow-600 text-sm">{formatDate((bonus as any).available_at)}</span>
                        : (bonus.status === 'AVAILABLE' || bonus.status === 'PAID')
                          ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                          : <span className="text-muted-foreground">-</span>
                      }
                    </TableCell>
                    <TableCell>
                      {bonus.status === 'PENDING' ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge className={getStatusColor(bonus.status) + ' cursor-help'}>
                                {getStatusLabel(bonus.status)}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Bônus em período de carência de 7 dias. Será liberado automaticamente após a validação.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Badge className={getStatusColor(bonus.status)}>
                          {getStatusLabel(bonus.status)}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-center text-muted-foreground">
        O bônus de indicação possui um período de carência de 7 dias antes de ficar disponível.
        Este é um benefício comercial independente do seu contrato de participação.
      </p>

      {/* Dialog de ativação por saldo */}
      <SponsorActivateDialog
        open={sponsorDialogOpen}
        onOpenChange={setSponsorDialogOpen}
        plans={plans}
        availableBalance={availableBalance}
        onSuccess={refreshData}
      />
    </div>
  );
};

export default PartnerReferralSection;
