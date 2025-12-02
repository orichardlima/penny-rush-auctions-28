import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { formatPrice } from "@/lib/utils";
import { Percent, Target, TrendingUp } from "lucide-react";

interface EditCommissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  affiliate: {
    id: string;
    profiles?: { full_name: string | null };
    commission_type: string;
    commission_rate: number;
    cpa_value_per_conversion: number;
    cpa_conversions_target: number;
  };
  currentGoal?: {
    current_conversions: number;
    conversions_target: number;
    value_per_conversion: number;
  };
  onSave: (data: {
    commission_type: string;
    commission_rate?: number;
    cpa_value_per_conversion?: number;
    cpa_conversions_target?: number;
  }) => Promise<void>;
}

export function EditCommissionModal({ 
  open, 
  onOpenChange, 
  affiliate,
  currentGoal,
  onSave 
}: EditCommissionModalProps) {
  const [commissionType, setCommissionType] = useState(affiliate?.commission_type || 'percentage');
  const [percentageRate, setPercentageRate] = useState(affiliate?.commission_rate?.toString() || '10');
  const [cpaValue, setCpaValue] = useState(affiliate?.cpa_value_per_conversion?.toString() || '5');
  const [cpaTarget, setCpaTarget] = useState(affiliate?.cpa_conversions_target?.toString() || '50');
  const [saving, setSaving] = useState(false);

  if (!affiliate) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (commissionType === 'percentage') {
        await onSave({
          commission_type: 'percentage',
          commission_rate: parseFloat(percentageRate),
        });
      } else {
        await onSave({
          commission_type: 'cpa',
          cpa_value_per_conversion: parseFloat(cpaValue),
          cpa_conversions_target: parseInt(cpaTarget),
        });
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving commission:', error);
    } finally {
      setSaving(false);
    }
  };

  const cpaValueNum = parseFloat(cpaValue) || 0;
  const cpaTargetNum = parseInt(cpaTarget) || 0;
  const totalReward = cpaValueNum * cpaTargetNum;

  const currentProgress = currentGoal 
    ? (currentGoal.current_conversions / currentGoal.conversions_target) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            ✏️ Editar Comissão - {affiliate.profiles?.full_name || 'Afiliado'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Tipo de Comissão */}
          <div className="space-y-3">
            <Label>Tipo de Comissão</Label>
            <RadioGroup value={commissionType} onValueChange={setCommissionType}>
              <div className="flex items-start space-x-3 border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <RadioGroupItem value="percentage" id="percentage" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="percentage" className="text-base font-medium cursor-pointer flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Porcentagem sobre compras
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    O afiliado ganha uma porcentagem do valor de cada compra realizada por seus indicados
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <RadioGroupItem value="cpa" id="cpa" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="cpa" className="text-base font-medium cursor-pointer flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    CPA - Custo por Aquisição (Meta de Depositantes)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    O afiliado ganha um valor fixo ao atingir uma meta de depositantes (usuários que fizeram primeira compra)
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Configurações de Porcentagem */}
          {commissionType === 'percentage' && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
              <Label htmlFor="percentage-rate" className="flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Taxa de Comissão (%)
              </Label>
              <Input
                id="percentage-rate"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={percentageRate}
                onChange={(e) => setPercentageRate(e.target.value)}
                placeholder="Ex: 10"
              />
              <p className="text-xs text-muted-foreground">
                Comissão = Valor da compra × Taxa
              </p>
            </div>
          )}

          {/* Configurações de CPA */}
          {commissionType === 'cpa' && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cpa-value" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Valor por Depositante (R$)
                  </Label>
                  <Input
                    id="cpa-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cpaValue}
                    onChange={(e) => setCpaValue(e.target.value)}
                    placeholder="Ex: 5.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpa-target" className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Meta de Depositantes
                  </Label>
                  <Input
                    id="cpa-target"
                    type="number"
                    min="1"
                    value={cpaTarget}
                    onChange={(e) => setCpaTarget(e.target.value)}
                    placeholder="Ex: 50"
                  />
                </div>
              </div>

              {/* Cálculo da recompensa */}
              <div className="bg-primary/10 rounded-lg p-3 border border-primary/20">
                <p className="text-sm font-medium mb-1">Recompensa ao bater a meta:</p>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(totalReward)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatPrice(cpaValueNum)} × {cpaTargetNum} depositantes
                </p>
              </div>

              {/* Progresso atual */}
              {currentGoal && (
                <div className="space-y-2">
                  <Label className="text-sm">Progresso Atual</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {currentGoal.current_conversions} / {currentGoal.conversions_target} depositantes
                      </span>
                      <span className="font-medium">{currentProgress.toFixed(1)}%</span>
                    </div>
                    <Progress value={currentProgress} className="h-2" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Aviso */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              ⚠️ Ao mudar o tipo de comissão, o histórico de comissões anteriores será mantido.
              {commissionType === 'cpa' && ' Uma nova meta CPA será criada automaticamente.'}
            </p>
          </div>
        </div>

        {/* Ações */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}