import { Progress } from '@/components/ui/progress';

interface PartnerProgressBarProps {
  totalReceived: number;
  totalCap: number;
  progressPercentage: number;
}

export const PartnerProgressBar = ({ 
  totalReceived, 
  totalCap, 
  progressPercentage 
}: PartnerProgressBarProps) => {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const remaining = totalCap - totalReceived;

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Progresso até o teto</span>
        <span className="font-medium text-foreground">{progressPercentage.toFixed(1)}%</span>
      </div>
      
      <Progress value={progressPercentage} className="h-3" />
      
      <div className="flex justify-between text-sm">
        <span className="text-primary font-medium">
          {formatCurrency(totalReceived)}
        </span>
        <span className="text-muted-foreground">
          / {formatCurrency(totalCap)}
        </span>
      </div>
      
      <p className="text-xs text-muted-foreground text-center">
        Falta: <span className="font-medium text-foreground">{formatCurrency(remaining)}</span> para atingir o teto
      </p>
    </div>
  );
};
