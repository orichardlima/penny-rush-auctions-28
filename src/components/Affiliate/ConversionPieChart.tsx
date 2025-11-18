import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Target } from 'lucide-react';

interface ConversionPieChartProps {
  totalReferrals: number;
  totalConversions: number;
}

export function ConversionPieChart({ totalReferrals, totalConversions }: ConversionPieChartProps) {
  const noConversions = Math.max(0, totalReferrals - totalConversions);
  
  const data = [
    { name: 'Conversões', value: totalConversions, color: 'hsl(var(--primary))' },
    { name: 'Sem Conversão', value: noConversions, color: 'hsl(var(--muted))' },
  ];

  const conversionRate = totalReferrals > 0 
    ? ((totalConversions / totalReferrals) * 100).toFixed(1)
    : '0.0';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Taxa de Conversão
        </CardTitle>
        <CardDescription>
          Proporção de cliques que viraram compras
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center mt-4">
            <div className="text-3xl font-bold text-primary">{conversionRate}%</div>
            <p className="text-sm text-muted-foreground">Taxa de conversão total</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
