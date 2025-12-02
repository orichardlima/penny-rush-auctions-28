import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MousePointer, UserPlus, ShoppingCart, ArrowDown } from 'lucide-react';

interface ConversionFunnelProps {
  clicks: number;
  signups: number;
  buyers: number;
}

export const ConversionFunnel = ({ clicks, signups, buyers }: ConversionFunnelProps) => {
  // Calculate conversion rates
  const clickToSignupRate = clicks > 0 ? ((signups / clicks) * 100).toFixed(1) : '0.0';
  const signupToBuyerRate = signups > 0 ? ((buyers / signups) * 100).toFixed(1) : '0.0';
  const overallRate = clicks > 0 ? ((buyers / clicks) * 100).toFixed(1) : '0.0';

  const stages = [
    {
      label: 'Cliques',
      value: clicks,
      icon: MousePointer,
      color: 'from-purple-500/20 to-purple-500/5',
      borderColor: 'border-purple-500/30',
      iconColor: 'text-purple-500',
      textColor: 'text-purple-600',
      width: 'w-full',
    },
    {
      label: 'Cadastros',
      value: signups,
      icon: UserPlus,
      color: 'from-blue-500/20 to-blue-500/5',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-500',
      textColor: 'text-blue-600',
      width: 'w-[85%]',
      rate: clickToSignupRate,
      rateLabel: 'dos cliques',
    },
    {
      label: 'Compradores',
      value: buyers,
      icon: ShoppingCart,
      color: 'from-green-500/20 to-green-500/5',
      borderColor: 'border-green-500/30',
      iconColor: 'text-green-500',
      textColor: 'text-green-600',
      width: 'w-[70%]',
      rate: signupToBuyerRate,
      rateLabel: 'dos cadastros',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Funil de Conversão</span>
          <span className="text-sm font-normal text-muted-foreground">
            (Taxa geral: {overallRate}%)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {stages.map((stage, index) => (
          <div key={stage.label} className="flex flex-col items-center">
            {/* Arrow between stages */}
            {index > 0 && (
              <div className="flex items-center gap-2 py-1 text-muted-foreground">
                <ArrowDown className="h-4 w-4" />
                <span className="text-xs">
                  {stage.rate}% {stage.rateLabel}
                </span>
              </div>
            )}
            
            {/* Stage bar */}
            <div className={`${stage.width} transition-all duration-300`}>
              <div
                className={`bg-gradient-to-r ${stage.color} border ${stage.borderColor} rounded-lg p-4 flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <stage.icon className={`h-5 w-5 ${stage.iconColor}`} />
                  <span className="font-medium">{stage.label}</span>
                </div>
                <span className={`text-2xl font-bold ${stage.textColor}`}>
                  {stage.value}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Summary */}
        <div className="mt-6 pt-4 border-t">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground">Clique → Cadastro</p>
              <p className="text-lg font-semibold text-blue-600">{clickToSignupRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cadastro → Compra</p>
              <p className="text-lg font-semibold text-green-600">{signupToBuyerRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conversão Total</p>
              <p className="text-lg font-semibold text-primary">{overallRate}%</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
