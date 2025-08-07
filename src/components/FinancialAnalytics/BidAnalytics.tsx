import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, ResponsiveContainer, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Users, Bot, Activity, TrendingUp } from 'lucide-react';

interface BidAnalyticsProps {
  totalBids: number;
  userBids: number;
  botBids: number;
  auctionData?: Array<{
    title: string;
    user_bids_count: number;
    bot_bids_count: number;
    total_bids_count: number;
  }>;
}

const COLORS = {
  user: 'hsl(var(--primary))',
  bot: 'hsl(var(--secondary))',
};

const chartConfig = {
  user_bids: {
    label: "Lances de Usuários",
    color: "hsl(var(--primary))",
  },
  bot_bids: {
    label: "Lances de Bots",
    color: "hsl(var(--secondary))",
  },
};

export const BidAnalytics: React.FC<BidAnalyticsProps> = ({ 
  totalBids, 
  userBids, 
  botBids,
  auctionData = []
}) => {
  const pieData = [
    { name: 'Usuários', value: userBids, color: COLORS.user },
    { name: 'Bots', value: botBids, color: COLORS.bot },
  ];

  const userPercentage = totalBids > 0 ? (userBids / totalBids) * 100 : 0;
  const botPercentage = totalBids > 0 ? (botBids / totalBids) * 100 : 0;

  // Prepare bar chart data (top 10 auctions by total bids)
  const barData = auctionData
    .slice(0, 10)
    .map(auction => ({
      name: auction.title.length > 15 ? auction.title.substring(0, 15) + '...' : auction.title,
      user_bids: auction.user_bids_count,
      bot_bids: auction.bot_bids_count,
      total: auction.total_bids_count
    }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Distribuição de Lances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center">
            <div className="flex-1">
              <ChartContainer config={chartConfig} className="h-[250px]">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const percentage = totalBids > 0 ? (data.value / totalBids * 100).toFixed(1) : '0';
                        return (
                          <div className="bg-background border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold">{data.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {data.value} lances ({percentage}%)
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ChartContainer>
            </div>
            <div className="flex flex-col gap-4 ml-4">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.user }}></div>
                <div>
                  <div className="font-semibold flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    Usuários
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {userBids} ({userPercentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLORS.bot }}></div>
                <div>
                  <div className="font-semibold flex items-center gap-1">
                    <Bot className="h-4 w-4" />
                    Bots
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {botBids} ({botPercentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Lances por Leilão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={10}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <ChartTooltip 
                content={
                  <ChartTooltipContent 
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'user_bids' ? 'Usuários' : 'Bots'
                    ]}
                  />
                }
              />
              <Bar 
                dataKey="user_bids" 
                stackId="a" 
                fill="var(--color-user_bids)"
                radius={[0, 0, 4, 4]}
              />
              <Bar 
                dataKey="bot_bids" 
                stackId="a" 
                fill="var(--color-bot_bids)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};