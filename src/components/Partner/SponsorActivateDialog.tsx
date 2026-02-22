import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PartnerPlan } from '@/hooks/usePartnerContract';
import { DollarSign, UserPlus, Loader2 } from 'lucide-react';

interface SponsorActivateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plans: PartnerPlan[];
  availableBalance: number;
  onSuccess: () => void;
}

const SponsorActivateDialog: React.FC<SponsorActivateDialogProps> = ({
  open,
  onOpenChange,
  plans,
  availableBalance,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const hasSufficientBalance = selectedPlan ? availableBalance >= selectedPlan.aporte_value : false;

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handleSubmit = async () => {
    if (!email.trim() || !selectedPlanId) {
      toast({ variant: 'destructive', title: 'Preencha todos os campos' });
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sponsor-activate-partner', {
        body: { referredEmail: email.trim(), planId: selectedPlanId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: '✅ Parceiro ativado!',
        description: data.message,
      });

      setEmail('');
      setSelectedPlanId('');
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao ativar parceiro',
        description: err.message || 'Tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setEmail('');
      setSelectedPlanId('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Ativar Indicado com Saldo
          </DialogTitle>
          <DialogDescription>
            Use seu saldo disponível para ativar o plano de um parceiro indicado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Saldo atual */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <span className="text-sm text-muted-foreground">Seu saldo disponível:</span>
            <Badge variant="secondary" className="text-base font-bold">
              <DollarSign className="h-4 w-4 mr-1" />
              {formatPrice(availableBalance)}
            </Badge>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email do indicado</label>
            <Input
              type="email"
              placeholder="parceiro@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Seletor de plano */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Plano</label>
            <Select value={selectedPlanId} onValueChange={setSelectedPlanId} disabled={submitting}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {plans.map((plan) => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.display_name} - {formatPrice(plan.aporte_value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Resumo */}
          {selectedPlan && (
            <div className="border rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor do plano:</span>
                <span className="font-medium">{formatPrice(selectedPlan.aporte_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo após ativação:</span>
                <span className={`font-medium ${hasSufficientBalance ? 'text-green-600' : 'text-destructive'}`}>
                  {hasSufficientBalance
                    ? formatPrice(availableBalance - selectedPlan.aporte_value)
                    : 'Saldo insuficiente'}
                </span>
              </div>
              {selectedPlan.bonus_bids > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bônus de lances:</span>
                  <span className="font-medium text-primary">{selectedPlan.bonus_bids} lances</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !email.trim() || !selectedPlanId || !hasSufficientBalance}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Confirmar Ativação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SponsorActivateDialog;
