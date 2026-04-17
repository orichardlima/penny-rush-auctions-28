import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, MousePointerClick, UserPlus, ShoppingCart, TrendingUp, DollarSign, Crown, Target } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { ManagerAggregateStats } from '@/hooks/useManagerInfluencerMetrics';

interface Props {
  stats: ManagerAggregateStats;
}

const items = (stats: ManagerAggregateStats) => [
  { label: 'Influencers', value: `${stats.activeInfluencers}/${stats.totalInfluencers}`, icon: Users, hint: 'Ativos / Total' },
  { label: 'Cliques', value: stats.totalClicks.toLocaleString('pt-BR'), icon: MousePointerClick, hint: 'Total da rede' },
  { label: 'Cadastros', value: stats.totalSignups.toLocaleString('pt-BR'), icon: UserPlus, hint: 'Signups gerados' },
  { label: 'Compradores', value: stats.totalBuyers.toLocaleString('pt-BR'), icon: ShoppingCart, hint: 'Únicos' },
  { label: 'Conversão', value: `${stats.avgConversionRate.toFixed(2)}%`, icon: Target, hint: 'Compradores / Cliques' },
  { label: 'Volume Vendido', value: formatPrice(stats.totalSales), icon: TrendingUp, hint: 'Total da rede' },
  { label: 'Override Total', value: formatPrice(stats.totalOverride), icon: Crown, hint: 'Sua comissão extra', highlight: true },
];

export const InfluencerKPICards = ({ stats }: Props) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {items(stats).map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label} className={item.highlight ? 'border-primary/40 bg-primary/5' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{item.label}</CardTitle>
              <Icon className={`h-4 w-4 ${item.highlight ? 'text-primary' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-xl font-bold ${item.highlight ? 'text-primary' : ''}`}>{item.value}</div>
              <p className="text-[10px] text-muted-foreground mt-1">{item.hint}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
