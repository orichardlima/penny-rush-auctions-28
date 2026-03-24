import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowUpCircle, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  ArrowRight,
  Layers
} from 'lucide-react';
import { PartnerContract, PartnerPlan, PartnerUpgradePaymentData } from '@/hooks/usePartnerContract';

interface PartnerUpgradeDialogProps {
  contract: PartnerContract;
  plans: PartnerPlan[];
  onUpgrade: (planId: string) => Promise<{ success: boolean; paymentData?: PartnerUpgradePaymentData }>;
  onUpgradeCotas?: (newCotas: number) => Promise<{ success: boolean; paymentData?: PartnerUpgradePaymentData }>;
  onPaymentData?: (data: PartnerUpgradePaymentData) => void;
  submitting: boolean;
}

const PartnerUpgradeDialog: React.FC<PartnerUpgradeDialogProps> = ({
  contract,
  plans,
  onUpgrade,
  onUpgradeCotas,
  onPaymentData,
  submitting
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PartnerPlan | null>(null);
  const [selectedCotas, setSelectedCotas] = useState<number | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');
  const [upgradeType, setUpgradeType] = useState<'plan' | 'cotas'>('plan');

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const currentPlan = plans.find(p => p.name === contract.plan_name);
  const availableUpgrades = plans.filter(p => p.aporte_value > contract.aporte_value);
  const maxCotas = currentPlan?.max_cotas || 1;
  const canUpgradeCotas = contract.cotas < maxCotas;

  const progressPercentage = (contract.total_received / contract.total_cap) * 100;
  const canUpgrade = progressPercentage < 80;

  const handleSelectPlan = (plan: PartnerPlan) => {
    setSelectedPlan(plan);
    setSelectedCotas(null);
    setUpgradeType('plan');
    setStep('confirm');
  };

  const handleSelectCotas = (cotas: number) => {
    setSelectedCotas(cotas);
    setSelectedPlan(null);
    setUpgradeType('cotas');
    setStep('confirm');
  };

  const handleConfirmUpgrade = async () => {
    let result: { success: boolean; paymentData?: PartnerUpgradePaymentData } | undefined;

    if (upgradeType === 'cotas' && selectedCotas && onUpgradeCotas) {
      result = await onUpgradeCotas(selectedCotas);
    } else if (upgradeType === 'plan' && selectedPlan) {
      result = await onUpgrade(selectedPlan.id);
    }

    if (result?.success && result.paymentData) {
      setOpen(false);
      setSelectedPlan(null);
      setSelectedCotas(null);
      setStep('select');
      if (onPaymentData) onPaymentData(result.paymentData);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedPlan(null);
      setSelectedCotas(null);
      setStep('select');
    }
  };

  const showPlanTab = availableUpgrades.length > 0;
  const showCotasTab = canUpgradeCotas && onUpgradeCotas;

  if (!showPlanTab && !showCotasTab) return null;

  const defaultTab = showCotasTab ? 'cotas' : 'plan';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
          disabled={!canUpgrade}
        >
          <ArrowUpCircle className="h-4 w-4 mr-2" />
          Fazer Upgrade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-purple-600" />
            Upgrade de Plano
          </DialogTitle>
          <DialogDescription>
            Atualize seu plano ou aumente suas cotas para potencializar seus ganhos.
          </DialogDescription>
        </DialogHeader>

        {!canUpgrade ? (
          <Alert className="border-orange-500/20 bg-orange-500/5">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-700">
              Você já atingiu mais de 80% do teto atual ({progressPercentage.toFixed(1)}%). 
              O upgrade não está disponível. Aguarde o encerramento do contrato para iniciar um novo.
            </AlertDescription>
          </Alert>
        ) : step === 'select' ? (
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${(showCotasTab ? 1 : 0) + (showPlanTab ? 1 : 0)}, 1fr)` }}>
              {showCotasTab && (
                <TabsTrigger value="cotas" className="gap-1">
                  <Layers className="h-4 w-4" />
                  Aumentar Cotas
                </TabsTrigger>
              )}
              {showPlanTab && (
                <TabsTrigger value="plan" className="gap-1">
                  <ArrowUpCircle className="h-4 w-4" />
                  Mudar Plano
                </TabsTrigger>
              )}
            </TabsList>

            {/* Cotas Tab */}
            {showCotasTab && (
              <TabsContent value="cotas" className="space-y-4 mt-4">
                <Card className="border-2 border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Cotas Atuais</p>
                        <p className="font-semibold">{contract.cotas} de {maxCotas} — {contract.plan_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(contract.aporte_value)}</p>
                        <p className="text-xs text-muted-foreground">Teto: {formatPrice(contract.total_cap)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Escolha a quantidade de cotas:</p>
                  {Array.from({ length: maxCotas - contract.cotas }, (_, i) => {
                    const newCotas = contract.cotas + i + 1;
                    const cotasDiff = newCotas - contract.cotas;
                    const unitAporte = currentPlan!.aporte_value;
                    const difference = unitAporte * cotasDiff;
                    const newTotalCap = currentPlan!.total_cap * newCotas;
                    const newWeeklyCap = currentPlan!.weekly_cap * newCotas;

                    return (
                      <Card 
                        key={newCotas}
                        className="cursor-pointer hover:border-purple-500/50 transition-colors"
                        onClick={() => handleSelectCotas(newCotas)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold">{newCotas} cotas {contract.plan_name}</p>
                              <p className="text-sm text-muted-foreground">
                                Teto: {formatPrice(newTotalCap)} | Semanal: {formatPrice(newWeeklyCap)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-green-600 font-medium">
                                +{formatPrice(difference)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                ({cotasDiff} cota{cotasDiff > 1 ? 's' : ''})
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            )}

            {/* Plan Tab */}
            {showPlanTab && (
              <TabsContent value="plan" className="space-y-4 mt-4">
                <Card className="border-2 border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Plano Atual</p>
                        <p className="font-semibold">{contract.plan_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatPrice(contract.aporte_value)}</p>
                        <p className="text-xs text-muted-foreground">Teto: {formatPrice(contract.total_cap)}</p>
                      </div>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-muted-foreground">Já recebido: </span>
                      <span className="text-green-600 font-medium">{formatPrice(contract.total_received)}</span>
                      <span className="text-muted-foreground"> ({progressPercentage.toFixed(1)}%)</span>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Escolha o novo plano:</p>
                  {availableUpgrades.map((plan) => {
                    const difference = plan.aporte_value - contract.aporte_value;
                    const newRemaining = plan.total_cap - contract.total_received;

                    return (
                      <Card 
                        key={plan.id}
                        className="cursor-pointer hover:border-purple-500/50 transition-colors"
                        onClick={() => handleSelectPlan(plan)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">{plan.display_name}</p>
                                {plan.name === 'PRO' && (
                                  <Badge className="bg-purple-500/10 text-purple-600">Mais Popular</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Teto: {formatPrice(plan.total_cap)} | Semanal: {formatPrice(plan.weekly_cap)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold">{formatPrice(plan.aporte_value)}</p>
                              <p className="text-xs text-green-600 font-medium">
                                +{formatPrice(difference)} de diferença
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                            Após upgrade: {formatPrice(newRemaining)} restantes para o novo teto
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <div className="space-y-4">
            {/* Resumo do Upgrade */}
            <Card className="bg-purple-500/5 border-purple-500/20">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">De</p>
                    {upgradeType === 'cotas' ? (
                      <>
                        <p className="font-semibold">{contract.cotas} cota{contract.cotas > 1 ? 's' : ''}</p>
                        <p className="text-sm">{contract.plan_name}</p>
                      </>
                    ) : (
                      <>
                        <p className="font-semibold">{contract.plan_name}</p>
                        <p className="text-sm">{formatPrice(contract.aporte_value)}</p>
                      </>
                    )}
                  </div>
                  <ArrowRight className="h-6 w-6 text-purple-600" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Para</p>
                    {upgradeType === 'cotas' && selectedCotas ? (
                      <>
                        <p className="font-semibold text-purple-600">{selectedCotas} cota{selectedCotas > 1 ? 's' : ''}</p>
                        <p className="text-sm">{contract.plan_name}</p>
                      </>
                    ) : selectedPlan ? (
                      <>
                        <p className="font-semibold text-purple-600">{selectedPlan.display_name}</p>
                        <p className="text-sm">{formatPrice(selectedPlan.aporte_value)}</p>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  {upgradeType === 'cotas' && selectedCotas && currentPlan && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Diferença a pagar via PIX:</span>
                        <span className="font-bold text-lg text-purple-600">
                          {formatPrice(currentPlan.aporte_value * (selectedCotas - contract.cotas))}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Novo aporte total:</span>
                        <span>{formatPrice(currentPlan.aporte_value * selectedCotas)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Novo teto total:</span>
                        <span>{formatPrice(currentPlan.total_cap * selectedCotas)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Novo limite semanal:</span>
                        <span>{formatPrice(currentPlan.weekly_cap * selectedCotas)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Novo restante até o teto:</span>
                        <span className="text-green-600">{formatPrice(currentPlan.total_cap * selectedCotas - contract.total_received)}</span>
                      </div>
                    </>
                  )}
                  {upgradeType === 'plan' && selectedPlan && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Diferença a pagar via PIX:</span>
                        <span className="font-bold text-lg text-purple-600">
                          {formatPrice(selectedPlan.aporte_value - contract.aporte_value)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Valor já recebido (preservado):</span>
                        <span className="text-green-600">{formatPrice(contract.total_received)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Novo teto total:</span>
                        <span>{formatPrice(selectedPlan.total_cap)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Novo limite semanal:</span>
                        <span>{formatPrice(selectedPlan.weekly_cap)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium border-t pt-2">
                        <span>Novo restante até o teto:</span>
                        <span className="text-green-600">{formatPrice(selectedPlan.total_cap - contract.total_received)}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Alert className="border-blue-500/20 bg-blue-500/5">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                O upgrade só será aplicado após a confirmação do pagamento PIX.
              </AlertDescription>
            </Alert>

            <Alert className="border-yellow-500/20 bg-yellow-500/5">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-700 text-sm">
                O upgrade é irreversível. Certifique-se de que deseja prosseguir.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 'confirm' && (selectedPlan || selectedCotas) && (
            <>
              <Button 
                variant="outline" 
                onClick={() => setStep('select')}
                disabled={submitting}
              >
                Voltar
              </Button>
              <Button 
                onClick={handleConfirmUpgrade}
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Gerar PIX para Upgrade
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PartnerUpgradeDialog;
