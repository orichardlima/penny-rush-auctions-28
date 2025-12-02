import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface CommissionTrend {
  date: string;
  generated: number;
  paid: number;
  pending: number;
}

interface AffiliateAnalyticsChartsProps {
  commissionTrends: CommissionTrend[];
  statusDistribution: {
    active: number;
    pending: number;
    suspended: number;
  };
}

export function AffiliateAnalyticsCharts({ commissionTrends, statusDistribution }: AffiliateAnalyticsChartsProps) {
  const pieData = [
    { name: "Ativos", value: statusDistribution.active, color: "#10b981" },
    { name: "Pendentes", value: statusDistribution.pending, color: "#f59e0b" },
    { name: "Suspensos", value: statusDistribution.suspended, color: "#ef4444" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Comissões - Últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={commissionTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
              <Legend />
              <Line type="monotone" dataKey="generated" stroke="#3b82f6" name="Gerado" strokeWidth={2} />
              <Line type="monotone" dataKey="paid" stroke="#10b981" name="Pago" strokeWidth={2} />
              <Line type="monotone" dataKey="pending" stroke="#f59e0b" name="Pendente" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status dos Afiliados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
