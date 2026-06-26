import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  History,
  Instagram,
  Facebook,
  MessageCircle,
  Share2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WeeklyHistoryEntry } from '@/hooks/useAdCenter';

interface Props {
  weeklyHistory: WeeklyHistoryEntry[];
  loading: boolean;
  initialWeeks?: number;
  onChangeWeeks: (n: number) => void;
}

const NETWORK_ICON: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  instagram: { icon: Instagram, color: 'text-pink-500', label: 'Instagram' },
  facebook: { icon: Facebook, color: 'text-blue-600', label: 'Facebook' },
  whatsapp: { icon: MessageCircle, color: 'text-green-500', label: 'WhatsApp' },
  tiktok: { icon: Share2, color: 'text-foreground', label: 'TikTok' },
  outro: { icon: Share2, color: 'text-muted-foreground', label: 'Outro' },
};

const formatBR = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
};

const formatTime = (iso: string | null) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const WeeklyAdsHistory: React.FC<Props> = ({ weeklyHistory, loading, initialWeeks = 8, onChangeWeeks }) => {
  const [weeks, setWeeks] = useState(String(initialWeeks));

  useEffect(() => {
    onChangeWeeks(Number(weeks));
  }, [weeks, onChangeWeeks]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5" />
              Semanas Anteriores
            </CardTitle>
            <CardDescription>
              Veja seu histórico de divulgações: dias confirmados, esquecidos e em qual rede você divulgou.
            </CardDescription>
          </div>
          <Select value={weeks} onValueChange={setWeeks}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="4">Últimas 4 semanas</SelectItem>
              <SelectItem value="8">Últimas 8 semanas</SelectItem>
              <SelectItem value="12">Últimas 12 semanas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        ) : weeklyHistory.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">
            Sem histórico disponível.
          </p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {weeklyHistory.map((week) => {
              const statusBadge =
                week.status === 'META'
                  ? { label: 'Meta cumprida — 100%', className: 'bg-green-500/10 text-green-600 border-green-500/20' }
                  : week.status === 'PARCIAL'
                  ? { label: 'Parcial — 40%', className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' }
                  : { label: 'Sem divulgação — 40%', className: 'bg-red-500/10 text-red-600 border-red-500/20' };

              return (
                <AccordionItem key={week.weekStart} value={week.weekStart}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex flex-1 flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pr-2 text-left">
                      <span className="font-medium text-sm sm:text-base">
                        {formatBR(week.weekStart)} – {formatBR(week.weekEnd)}
                      </span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {week.completedDays}/{week.requiredDays} dias
                        </Badge>
                        <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
                          {statusBadge.label}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
                      {week.days.map((day) => {
                        const net = day.socialNetwork ? NETWORK_ICON[day.socialNetwork] : null;
                        const NetIcon = net?.icon;
                        return (
                          <div
                            key={day.date}
                            className={cn(
                              'rounded-lg border p-2 text-center text-xs',
                              day.completed
                                ? 'bg-green-500/10 border-green-500/30'
                                : 'bg-red-500/10 border-red-500/30'
                            )}
                          >
                            <p className="text-muted-foreground">{day.dayName}</p>
                            <p className="font-semibold text-sm">{day.dayNumber}</p>
                            <div className="mt-1 flex justify-center">
                              {day.completed ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                            {day.completed && NetIcon && (
                              <div className="mt-1 flex flex-col items-center gap-0.5">
                                <NetIcon className={cn('h-3.5 w-3.5', net!.color)} />
                                <span className="text-[10px] text-muted-foreground">
                                  {formatTime(day.confirmedAt)}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyAdsHistory;
