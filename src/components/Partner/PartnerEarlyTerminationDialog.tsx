import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { usePartnerEarlyTermination } from '@/hooks/usePartnerEarlyTermination';
import type { PartnerContract } from '@/hooks/usePartnerContract';
import { 
  XCircle, 
  AlertTriangle, 
  CreditCard, 
  Coins,
  DollarSign,
  Clock
} from 'lucide-react';

interface PartnerEarlyTerminationDialogProps {
  contract: PartnerContract;
  onSuccess?: () => void;
}

const PartnerEarlyTerminationDialog = ({ contract, onSuccess }: PartnerEarlyTerminationDialogProps) => {
  const { 
    pendingRequest,
    submitting,
    calculateLiquidationProposal,
    requestTermination,
    cancelRequest,
    getStatusLabel,
    getLiquidationTypeLabel
  } = usePartnerEarlyTermination();

  const [liquidationType, setLiquidationType] = useState<'CREDITS' | 'BIDS' | 'PARTIAL_REFUND'>('CREDITS');
  const [isOpen, setIsOpen] = useState(false);

  const proposal = calculateLiquidationProposal(contract);

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleSubmit = async () => {
    const result = await requestTermination(contract, liquidationType);
    if (result.success) {
      setIsOpen(false);
      onSuccess?.();
    }
  };

  const handleCancelRequest = async () => {
    if (pendingRequest) {
      await cancelRequest(pendingRequest.id);
    }
  };

  // Se já tem solicitação pendente, mostrar status
  if (pendingRequest) {
    return (
      <div className="p-4 border rounded-lg bg-yellow-500/5 border-yellow-500/20">
        <div className="flex items-start gap-3">
          <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-yellow-700">Solicitação de Encerramento Pendente</p>
            <p className="text-sm text-muted-foreground mt-1">
              Sua solicitação de encerramento está sendo analisada.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p><strong>Tipo:</strong> {getLiquidationTypeLabel(pendingRequest.liquidation_type)}</p>
              <p><strong>Valor proposto:</strong> {formatPrice(pendingRequest.proposed_value)}</p>
              <p><strong>Status:</strong> <Badge variant="outline">{getStatusLabel(pendingRequest.status)}</Badge></p>
            </div>
            {pendingRequest.status === 'PENDING' && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={handleCancelRequest}
                disabled={submitting}
              >
                Cancelar Solicitação
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-orange-600 border-orange-500/30 hover:bg-orange-500/10">
          <XCircle className="h-4 w-4 mr-2" />
          Solicitar Encerramento Antecipado
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-600" />
            Encerramento Antecipado
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 mt-4">
              <Alert className="border-yellow-500/20 bg-yellow-500/5">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-700">
                  O encerramento antecipado é uma <strong>liquidação condicionada</strong>, sujeita 
                  à liquidez da plataforma. <strong>Não representa devolução garantida do aporte</strong>.
                </AlertDescription>
              </Alert>

              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium">Proposta de liquidação:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Teto restante:</span>
                  <span>{formatPrice(proposal.remainingCap)}</span>
                  <span className="text-muted-foreground">Deságio:</span>
                  <span className="text-orange-600">{proposal.discountPercentage}%</span>
                  <span className="text-muted-foreground">Valor proposto:</span>
                  <span className="font-medium text-green-600">{formatPrice(proposal.proposedValue)}</span>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Escolha a forma de liquidação:</Label>
                <RadioGroup 
                  value={liquidationType} 
                  onValueChange={(v) => setLiquidationType(v as typeof liquidationType)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="CREDITS" id="credits" />
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="credits" className="cursor-pointer flex-1">
                      <span className="font-medium">Créditos na plataforma</span>
                      <p className="text-xs text-muted-foreground">{formatPrice(proposal.creditsEquivalent)} em créditos</p>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="BIDS" id="bids" />
                    <Coins className="h-4 w-4 text-purple-600" />
                    <Label htmlFor="bids" className="cursor-pointer flex-1">
                      <span className="font-medium">Conversão em lances</span>
                      <p className="text-xs text-muted-foreground">{proposal.bidsEquivalent} lances</p>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/30 cursor-pointer">
                    <RadioGroupItem value="PARTIAL_REFUND" id="refund" />
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <Label htmlFor="refund" className="cursor-pointer flex-1">
                      <span className="font-medium">Reembolso parcial</span>
                      <p className="text-xs text-muted-foreground">Sujeito à aprovação e liquidez</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <p className="text-xs text-muted-foreground text-center pt-2">
                Ao confirmar, você entende que esta é uma liquidação condicionada e que 
                o contrato será encerrado permanentemente após o processamento.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {submitting ? 'Enviando...' : 'Confirmar Solicitação'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default PartnerEarlyTerminationDialog;
