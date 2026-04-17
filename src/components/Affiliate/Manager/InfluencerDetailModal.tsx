import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';
import { MousePointerClick, UserPlus, ShoppingCart, Target, DollarSign, Crown, Percent } from 'lucide-react';
import type { InfluencerMetric } from '@/hooks/useManagerInfluencerMetrics';

interface Props {
  influencer: InfluencerMetric | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FunnelStep = ({
  icon: Icon,
  label,
  value,
  pct,
  color = 'bg-primary',
}: {
  icon: any;
  label: string;
  value: number | string;
  pct: number;
  color?: string;
}) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-bold">{value}</span>
    </div>
    <div className="h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  </div>
);

export const InfluencerDetailModal = ({ influencer, open, onOpenChange }: Props) => {
  if (!influencer) return null;

  const clicks = influencer.total_clicks;
  const signups = influencer.total_signups;
  const buyers = influencer.unique_buyers;

  const signupRate = clicks > 0 ? (signups / clicks) * 100 : 0;
  const buyerRate = clicks > 0 ? (buyers / clicks) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {influencer.full_name}
            <Badge variant={influencer.status === 'active' ? 'default' : 'secondary'}>
              {influencer.status}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Código: <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{influencer.affiliate_code}</code>
            {influencer.email && <> • {influencer.email}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Funil */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Funil de Conversão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FunnelStep icon={MousePointerClick} label="Cliques" value={clicks} pct={100} color="bg-blue-500" />
              <FunnelStep
                icon={UserPlus}
                label={`Cadastros (${signupRate.toFixed(1)}%)`}
                value={signups}
                pct={signupRate}
                color="bg-violet-500"
              />
              <FunnelStep
                icon={ShoppingCart}
                label={`Compradores (${buyerRate.toFixed(1)}%)`}
                value={buyers}
                pct={buyerRate}
                color="bg-primary"
              />
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Taxa de conversão final</span>
                </div>
                <span className="text-lg font-bold text-primary">{influencer.conversion_rate.toFixed(2)}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Financeiro */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground">Volume Vendido</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{formatPrice(influencer.total_sales)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground">Comissão do Influencer</CardTitle>
                <Percent className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">{formatPrice(influencer.total_commission)}</div>
              </CardContent>
            </Card>
            <Card className="border-primary/40 bg-primary/5">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs text-muted-foreground">Seu Override ({influencer.override_rate}%)</CardTitle>
                <Crown className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold text-primary">{formatPrice(influencer.total_override)}</div>
              </CardContent>
            </Card>
          </div>

          {influencer.recruited_at && (
            <p className="text-xs text-muted-foreground text-center">
              Recrutado em {new Date(influencer.recruited_at).toLocaleDateString('pt-BR')}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
