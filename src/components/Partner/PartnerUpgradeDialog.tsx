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
import { 
  ArrowUpCircle, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { PartnerContract, PartnerPlan } from '@/hooks/usePartnerContract';

interface PartnerUpgradeDialogProps {
  contract: PartnerContract;
  plans: PartnerPlan[];
  onUpgrade: (planId: string) => Promise<{ success: boolean; differenceToPay?: number }>;
  submitting: boolean;
}

const PartnerUpgradeDialog: React.FC<PartnerUpgradeDialogProps> = ({
  contract,
  plans,
  onUpgrade,
  submitting
}) => {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PartnerPlan | null>(null);
  const [step, setStep] = useState<'select' | 'confirm'>('select');

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Planos disponíveis para upgrade (apenas superiores)
  const availableUpgrades = plans.filter(p => p.aporte_value > contract.aporte_value);

  // Calcular progresso atual
  const progressPercentage = (contract.total_received / contract.total_cap) * 100;
  const canUpgrade = progressPercentage < 80;

  const handleSelectPlan = (plan: PartnerPlan) => {
    setSelectedPlan(plan);
    setStep('confirm');
  };

  const handleConfirmUpgrade = async () => {
    if (!selectedPlan) return;
    
    const result = await onUpgrade(selectedPlan.id);
    
    if (result.success) {
      setOpen(false);
      setSelectedPlan(null);
      setStep('select');
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setSelectedPlan(null);
      setStep('select');
    }
  };

  if (availableUpgrades.length === 0) {
    return null; // Não mostrar se já está no plano máximo
  }

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
            Atualize seu plano para aumentar seus limites e potencial de ganhos.
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
          <div className="space-y-4">
            {/* Plano Atual */}
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

            {/* Planos Disponíveis para Upgrade */}
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
          </div>
        ) : selectedPlan && (
          <div className="space-y-4">
            {/* Resumo do Upgrade */}
            <Card className="bg-purple-500/5 border-purple-500/20">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">De</p>
                    <p className="font-semibold">{contract.plan_name}</p>
                    <p className="text-sm">{formatPrice(contract.aporte_value)}</p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-purple-600" />
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">Para</p>
                    <p className="font-semibold text-purple-600">{selectedPlan.display_name}</p>
                    <p className="text-sm">{formatPrice(selectedPlan.aporte_value)}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Diferença a pagar:</span>
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
                </div>
              </CardContent>
            </Card>

            <Alert className="border-blue-500/20 bg-blue-500/5">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-700">
                Seu histórico de recebimentos será preservado. O valor já recebido continua contabilizado no novo teto.
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
          {step === 'confirm' && selectedPlan && (
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
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Confirmar Upgrade
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
