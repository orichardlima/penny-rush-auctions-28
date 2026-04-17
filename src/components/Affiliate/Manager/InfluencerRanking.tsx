import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, TrendingUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { InfluencerMetric } from '@/hooks/useManagerInfluencerMetrics';

interface Props {
  metrics: InfluencerMetric[];
}

const medals = ['🥇', '🥈', '🥉'];

const PodiumList = ({
  title,
  icon,
  items,
  format,
}: {
  title: string;
  icon: React.ReactNode;
  items: { name: string; code: string; value: string }[];
  format?: string;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2 text-base">
        {icon}
        {title}
      </CardTitle>
      <CardDescription>Top 3 da sua rede</CardDescription>
    </CardHeader>
    <CardContent className="space-y-2">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Sem dados ainda</p>
      ) : (
        items.map((it, idx) => (
          <div
            key={it.code + idx}
            className="flex items-center justify-between rounded-md border bg-card/50 px-3 py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl flex-shrink-0">{medals[idx]}</span>
              <div className="min-w-0">
                <div className="font-medium truncate">{it.name}</div>
                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{it.code}</code>
              </div>
            </div>
            <div className="font-semibold text-primary flex-shrink-0">{it.value}</div>
          </div>
        ))
      )}
    </CardContent>
  </Card>
);

export const InfluencerRanking = ({ metrics }: Props) => {
  const topBySales = [...metrics]
    .filter((m) => m.total_sales > 0)
    .sort((a, b) => b.total_sales - a.total_sales)
    .slice(0, 3)
    .map((m) => ({ name: m.full_name, code: m.affiliate_code, value: formatPrice(m.total_sales) }));

  const topByConversion = [...metrics]
    .filter((m) => m.total_clicks >= 10)
    .sort((a, b) => b.conversion_rate - a.conversion_rate)
    .slice(0, 3)
    .map((m) => ({
      name: m.full_name,
      code: m.affiliate_code,
      value: `${m.conversion_rate.toFixed(2)}%`,
    }));

  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <PodiumList title="Top por Vendas" icon={<Trophy className="h-4 w-4 text-primary" />} items={topBySales} />
      <PodiumList
        title="Top por Conversão"
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        items={topByConversion}
      />
    </div>
  );
};
