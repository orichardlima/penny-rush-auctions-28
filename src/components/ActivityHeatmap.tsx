import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, Clock } from 'lucide-react';
import { useActivityHeatmap } from '@/hooks/useActivityHeatmap';

const ActivityHeatmap: React.FC = () => {
  const { activityData, loading, error } = useActivityHeatmap();

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Processar dados para o heatmap
  const getActivityForCell = (hour: number, day: number) => {
    return activityData.find(d => d.hour_of_day === hour && d.day_of_week === day);
  };

  const maxBidCount = Math.max(...activityData.map(d => d.bid_count), 1);

  const getIntensityClass = (bidCount: number) => {
    const intensity = bidCount / maxBidCount;
    if (intensity > 0.8) return 'bg-green-600 text-white';
    if (intensity > 0.6) return 'bg-green-500';
    if (intensity > 0.4) return 'bg-green-400';
    if (intensity > 0.2) return 'bg-green-300';
    if (intensity > 0) return 'bg-green-100';
    return 'bg-gray-50';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Mapa de Calor de Atividade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-96 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Erro</CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Encontrar horários de pico
  const peakActivity = activityData.reduce((max, current) => 
    current.bid_count > max.bid_count ? current : max, 
    { bid_count: 0, hour_of_day: 0, day_of_week: 0, user_count: 0, revenue: 0 }
  );

  const totalRevenue = activityData.reduce((sum, d) => sum + d.revenue, 0);
  const totalBids = activityData.reduce((sum, d) => sum + d.bid_count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Mapa de Calor de Atividade
        </CardTitle>
        <CardDescription>
          Padrões de atividade dos usuários por dia da semana e horário (últimos 30 dias)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estatísticas resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-primary/5 rounded-lg">
            <Clock className="h-5 w-5 mx-auto mb-2 text-primary" />
            <p className="text-sm font-medium">Horário de Pico</p>
            <p className="text-lg font-bold text-primary">
              {daysOfWeek[peakActivity.day_of_week]} às {peakActivity.hour_of_day}h
            </p>
            <p className="text-xs text-muted-foreground">
              {peakActivity.bid_count} lances
            </p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-sm font-medium text-green-600">Receita Total</p>
            <p className="text-lg font-bold text-green-600">R$ {totalRevenue.toFixed(2)}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium text-blue-600">Total de Lances</p>
            <p className="text-lg font-bold text-blue-600">{totalBids}</p>
          </div>
        </div>

        {/* Heatmap */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Cabeçalho dos dias */}
            <div className="grid grid-cols-25 gap-1 mb-2">
              <div className="text-xs font-medium text-center p-2"></div>
              {daysOfWeek.map((day) => (
                <div key={day} className="text-xs font-medium text-center p-2 col-span-3">
                  {day}
                </div>
              ))}
            </div>

            {/* Grid do heatmap */}
            <div className="space-y-1">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-25 gap-1">
                  {/* Rótulo da hora */}
                  <div className="text-xs text-right p-2 font-medium">
                    {hour.toString().padStart(2, '0')}h
                  </div>
                  
                  {/* Células para cada dia da semana */}
                  {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                    const activity = getActivityForCell(hour, day);
                    const bidCount = activity?.bid_count || 0;
                    const revenue = activity?.revenue || 0;
                    
                    return (
                      <div
                        key={`${hour}-${day}`}
                        className={`
                          col-span-3 h-8 rounded text-xs flex items-center justify-center cursor-pointer
                          transition-all hover:scale-105 hover:shadow-md
                          ${getIntensityClass(bidCount)}
                        `}
                        title={`${daysOfWeek[day]} ${hour}h: ${bidCount} lances, R$ ${revenue.toFixed(2)}`}
                      >
                        {bidCount > 0 && (
                          <span className="font-medium text-xs">
                            {bidCount}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span>Menos atividade</span>
            <div className="flex gap-1">
              {['bg-gray-50', 'bg-green-100', 'bg-green-300', 'bg-green-500', 'bg-green-600'].map((color, i) => (
                <div key={i} className={`w-3 h-3 rounded ${color}`} />
              ))}
            </div>
            <span>Mais atividade</span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Dados dos últimos 30 dias • Somente usuários reais
          </div>
        </div>

        {/* Insights */}
        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Insights de Atividade</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-medium text-primary">Padrões Identificados:</p>
              <ul className="text-muted-foreground space-y-1 mt-1">
                <li>• Pico de atividade: {daysOfWeek[peakActivity.day_of_week]} às {peakActivity.hour_of_day}h</li>
                <li>• Média de {(totalBids / activityData.length || 0).toFixed(1)} lances por período</li>
                <li>• Receita média: R$ {(totalRevenue / activityData.length || 0).toFixed(2)} por período</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-green-600">Recomendações:</p>
              <ul className="text-muted-foreground space-y-1 mt-1">
                <li>• Programe leilões especiais nos horários de pico</li>
                <li>• Use notificações push nos períodos de alta atividade</li>
                <li>• Considere promoções em horários de baixa atividade</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityHeatmap;