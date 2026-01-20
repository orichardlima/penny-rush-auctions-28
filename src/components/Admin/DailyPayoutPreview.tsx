import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { useDailyPayoutPreview } from '@/hooks/useDailyPayoutPreview';
import { 
  Calculator, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle2,
  Eye,
  Loader2,
  PieChart
} from 'lucide-react';

interface DailyPayoutPreviewProps {
  selectedWeek: string;
}

const DailyPayoutPreview: React.FC<DailyPayoutPreviewProps> = ({ selectedWeek }) => {
  const { 
    loading, 
    dailyConfigs, 
    contractPreviews, 
    totals, 
    totalsByPlan,
    hasConfigs,
    calculationBase 
  } = useDailyPayoutPreview(selectedWeek);

  const [expandedContracts, setExpandedContracts] = useState<Set<string>>(new Set());

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const toggleContract = (contractId: string) => {
    setExpandedContracts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contractId)) {
        newSet.delete(contractId);
      } else {
        newSet.add(contractId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando Preview...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasConfigs) {
    return (
      <Card className="border-yellow-500/30 bg-yellow-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-5 w-5" />
            Sem Configurações
          </CardTitle>
          <CardDescription>
            Não há configurações de faturamento diário para esta semana. 
            Configure as porcentagens na aba "Configurar Faturamento Diário" antes de processar.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo das Configurações Diárias */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Configurações da Semana
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {dailyConfigs.map((config) => (
              <div 
                key={config.date}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  config.percentage > 0 ? 'bg-muted' : 'bg-muted/30 opacity-60'
                }`}
              >
                <span className="font-medium">{formatDate(config.date)}</span>
                <Badge 
                  variant="secondary" 
                  className={config.percentage > 0 
                    ? "bg-green-500/10 text-green-700 border-green-500/30"
                    : "bg-gray-500/10 text-gray-500 border-gray-500/30"
                  }
                >
                  {config.percentage}%
                </Badge>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Total %</p>
              <p className="text-lg font-bold text-primary">{totals.totalPercentage.toFixed(2)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Contratos</p>
              <p className="text-lg font-bold">{totals.eligibleContracts}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Base</p>
              <p className="text-sm font-medium capitalize">
                {calculationBase === 'aporte' ? 'Aporte' : 'Limite Semanal'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Com Limite</p>
              <p className="text-lg font-bold text-yellow-600">{totals.contractsWithCap}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview por Contrato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Preview por Contrato
          </CardTitle>
          <CardDescription>
            Valores calculados em tempo real baseados nas configurações diárias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[30px]"></TableHead>
                  <TableHead>Parceiro</TableHead>
                  <TableHead className="hidden sm:table-cell">Plano</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Base</TableHead>
                  <TableHead className="text-right">Calculado</TableHead>
                  <TableHead className="text-right">Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractPreviews.map((preview) => (
                  <React.Fragment key={preview.contractId}>
                    <TableRow 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => toggleContract(preview.contractId)}
                    >
                      <TableCell className="p-2">
                        {expandedContracts.has(preview.contractId) ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{preview.userName}</p>
                          <p className="text-xs text-muted-foreground">{preview.userEmail}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Badge variant="outline">{preview.planName}</Badge>
                          {preview.proRataApplied && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30"
                            >
                              {preview.eligibleDays}/7
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {formatPrice(preview.aporteValue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatPrice(preview.calculatedAmount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={`font-medium ${preview.totalCapApplied ? 'text-yellow-600' : 'text-green-600'}`}>
                            {formatPrice(preview.finalAmount)}
                          </span>
                          {preview.proRataApplied && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1 py-0 bg-blue-500/10 text-blue-600 border-blue-500/30"
                            >
                              Pro Rata
                            </Badge>
                          )}
                          {(preview.weeklyCapApplied || preview.totalCapApplied) && (
                            <Badge 
                              variant="outline" 
                              className="text-[10px] px-1 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/30"
                            >
                              {preview.totalCapApplied ? 'TETO' : 'CAP'}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    
                    {/* Detalhes expandidos */}
                    {expandedContracts.has(preview.contractId) && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-muted/30 p-0">
                          <div className="p-3 space-y-2">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div className="p-2 bg-background rounded border">
                                <p className="text-muted-foreground">Aporte</p>
                                <p className="font-medium">{formatPrice(preview.aporteValue)}</p>
                              </div>
                              <div className="p-2 bg-background rounded border">
                                <p className="text-muted-foreground">Cap Semanal</p>
                                <p className="font-medium">{formatPrice(preview.weeklyCap)}</p>
                              </div>
                              <div className="p-2 bg-background rounded border">
                                <p className="text-muted-foreground">Teto Total</p>
                                <p className="font-medium">{formatPrice(preview.totalCap)}</p>
                              </div>
                              <div className="p-2 bg-background rounded border">
                                <p className="text-muted-foreground">Restante</p>
                                <p className="font-medium text-primary">{formatPrice(preview.remainingCap)}</p>
                              </div>
                              {preview.proRataApplied && (
                                <div className="p-2 bg-blue-500/10 rounded border border-blue-500/20 col-span-2 sm:col-span-4">
                                  <p className="text-blue-600 text-xs font-medium">
                                    📅 Pro Rata: Cadastrado em {preview.eligibleFrom} • Recebe {preview.eligibleDays} de 7 dias
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            <div className="mt-2">
                              <p className="text-xs font-medium mb-1">Detalhamento Diário:</p>
                              <div className="flex flex-wrap gap-1">
                                {preview.dailyBreakdown.map((day) => (
                                  <div 
                                    key={day.date}
                                    className={`text-xs px-2 py-1 rounded border ${
                                      day.skipped 
                                        ? 'bg-muted/30 text-muted-foreground line-through opacity-60' 
                                        : 'bg-background'
                                    }`}
                                  >
                                    <span className="text-muted-foreground">{formatDate(day.date)}:</span>
                                    {day.skipped ? (
                                      <span className="ml-1 text-muted-foreground">N/A</span>
                                    ) : (
                                      <>
                                        <span className="ml-1 font-medium">{formatPrice(day.dayValue)}</span>
                                        <span className="ml-1 text-muted-foreground">({day.percentage}%)</span>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {contractPreviews.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum contrato elegível para esta semana
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo por Plano */}
      {contractPreviews.length > 0 && totalsByPlan.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              Resumo por Plano
            </CardTitle>
            <CardDescription>Total consolidado a pagar por tipo de plano</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {totalsByPlan.map((planData) => (
                <div 
                  key={planData.planName}
                  className="p-4 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{planData.planName}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {planData.count} contrato{planData.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    {formatPrice(planData.final)}
                  </p>
                  {planData.calculated !== planData.final && (
                    <p className="text-xs text-muted-foreground line-through">
                      {formatPrice(planData.calculated)}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {planData.proRataCount > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/30">
                        {planData.proRataCount} pro rata
                      </Badge>
                    )}
                    {planData.cappedCount > 0 && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
                        {planData.cappedCount} com limite
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Totais */}
      {contractPreviews.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold">Total a Distribuir</p>
                <p className="text-xs text-muted-foreground">
                  {totals.eligibleContracts} contrato{totals.eligibleContracts !== 1 ? 's' : ''} elegível{totals.eligibleContracts !== 1 ? 'is' : ''}
                  {totals.contractsWithProRata > 0 && (
                    <span className="text-blue-600"> • {totals.contractsWithProRata} Pro Rata</span>
                  )}
                  {totals.contractsWithCap > 0 && ` • ${totals.contractsWithCap} com limite aplicado`}
                </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-primary">{formatPrice(totals.totalFinal)}</p>
                {totals.totalCalculated !== totals.totalFinal && (
                  <p className="text-xs text-muted-foreground line-through">
                    {formatPrice(totals.totalCalculated)}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyPayoutPreview;
