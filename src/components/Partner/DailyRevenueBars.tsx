import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DailyRevenueDay {
  date: Date;
  dayName: string;
  dayNumber: number;
  partnerShare: number;
  grossRevenue: number;
  percentage: number;
  isPast: boolean;
  isToday: boolean;
  isBeforeContract: boolean;
  isClosed: boolean;
}

interface DailyRevenueBarsProps {
  days: DailyRevenueDay[];
  closingHour: number;
  maxDailyValue: number;
  isAnimating: boolean;
  formatPrice: (value: number) => string;
}

const DailyRevenueBars: React.FC<DailyRevenueBarsProps> = ({
  days,
  closingHour,
  maxDailyValue,
  isAnimating,
  formatPrice
}) => {
  // State to force re-render for real-time updates
  const [, setTick] = useState(0);

  // Update every minute for real-time progress
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(prev => prev + 1);
    }, 60 * 1000); // 1 minute

    return () => clearInterval(interval);
  }, []);

  // Calculate current day progress (0 to 1)
  const dayProgress = useMemo(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    // Progress as decimal (0 to 1), considering minutes for precision
    return Math.min((currentHour + currentMinutes / 60) / closingHour, 1);
  }, [closingHour, setTick]); // setTick dependency forces recalculation

  const dayProgressPercent = dayProgress * 100;

  return (
    <div className="space-y-2">
      {days.map((day, index) => {
        const isProRataDay = day.isBeforeContract && day.isClosed;
        const showValue = day.isClosed && !isProRataDay;
        const isTodayPending = day.isToday && !day.isClosed && !isProRataDay;
        
        // Calculate proportional value for today (growing with time)
        const displayValue = isTodayPending && day.partnerShare > 0
          ? day.partnerShare * dayProgress
          : day.partnerShare;

        // Bar width calculation
        const getBarWidth = () => {
          if (isProRataDay) return '100%';
          if (isTodayPending) return `${dayProgressPercent}%`;
          if (!day.isClosed) return '0%';
          // Closed days: proportional to max value
          if (maxDailyValue > 0) {
            return `${Math.max((day.partnerShare / maxDailyValue) * 100, day.partnerShare > 0 ? 5 : 0)}%`;
          }
          return '0%';
        };

        const getAnimatedBarWidth = () => {
          if (maxDailyValue > 0) {
            return `${Math.max((day.partnerShare / maxDailyValue) * 100, day.partnerShare > 0 ? 5 : 0)}%`;
          }
          return '0%';
        };
        
        return (
          <div key={day.date.toISOString()} className="flex items-center gap-2">
            <span className={cn(
              "w-14 text-xs font-medium shrink-0",
              day.isToday && "text-primary font-bold",
              isProRataDay && "text-muted-foreground/60"
            )}>
              {day.dayName} {day.dayNumber}
            </span>
            
            {/* Container da barra */}
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden relative">
              {/* Barra com animação */}
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  // Dia Pro Rata (antes do contrato): padrão listrado
                  isProRataDay && "bg-[repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(0,0,0,0.08)_3px,rgba(0,0,0,0.08)_6px)] bg-muted-foreground/20",
                  // Dia atual fechado: verde com pulse suave
                  !isProRataDay && day.isToday && day.isClosed && day.partnerShare > 0 && "bg-gradient-to-r from-green-500 to-green-400 animate-pulse-soft",
                  // Dia atual aguardando fechamento: azul com pulse suave (DESTAQUE)
                  isTodayPending && "bg-gradient-to-r from-blue-400 to-blue-300 animate-pulse-soft",
                  // Dias passados fechados: rosa/vermelho
                  !isProRataDay && day.isPast && day.isClosed && day.partnerShare > 0 && "bg-gradient-to-r from-primary to-primary/70",
                  // Dias futuros ou sem valor
                  !isProRataDay && !day.isToday && (!day.isClosed || day.partnerShare === 0) && "bg-muted-foreground/20",
                  !isProRataDay && isAnimating && day.isClosed && "animate-bar-grow"
                )}
                style={
                  isProRataDay 
                    ? { width: '100%' } 
                    : !day.isClosed 
                      ? { width: isTodayPending ? `${dayProgressPercent}%` : '0%' }
                      : { 
                          '--bar-width': getAnimatedBarWidth(),
                          width: isAnimating ? undefined : getBarWidth(),
                          animationDelay: `${index * 100}ms`
                        } as React.CSSProperties
                }
              />
              
              {/* Badge Pro Rata DENTRO da barra */}
              {isProRataDay && (
                <Badge 
                  variant="outline" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] h-3.5 px-1 bg-amber-50 border-amber-400/50 text-amber-700 font-semibold"
                >
                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                  Pré-contrato
                </Badge>
              )}
              
              {/* Badge Hoje DENTRO da barra */}
              {day.isToday && !isProRataDay && day.isClosed && (
                <Badge 
                  variant="outline" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] h-3.5 px-1 bg-white/90 border-green-500/50 text-green-700 font-semibold"
                >
                  Hoje
                </Badge>
              )}
              
              {/* Badge Aguardando (dia de hoje não fechado) - mostra progresso */}
              {isTodayPending && (
                <Badge 
                  variant="outline" 
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] h-3.5 px-1 bg-white/90 border-blue-400/50 text-blue-700 font-semibold"
                >
                  <Clock className="h-2.5 w-2.5 mr-0.5" />
                  {Math.round(dayProgressPercent)}% • às {closingHour}h
                </Badge>
              )}
            </div>
            
            {/* Valor e Porcentagem */}
            <span className={cn(
              "w-16 md:w-28 text-[10px] md:text-xs text-right shrink-0 tabular-nums",
              day.isToday && !isProRataDay && "text-primary font-bold",
              (!day.isPast && !day.isToday) && "text-muted-foreground",
              isProRataDay && "text-muted-foreground/50"
            )}>
              {isProRataDay ? (
                <span className="text-amber-600">—</span>
              ) : showValue ? (
                <>
                  {day.percentage > 0 && (
                    <span className="hidden md:inline text-muted-foreground mr-1">
                      {day.percentage.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%
                    </span>
                  )}
                  {formatPrice(day.partnerShare)}
                </>
              ) : isTodayPending && day.partnerShare > 0 ? (
                // Mostrar valor proporcional crescendo
                <span className="text-blue-600 font-semibold tabular-nums">
                  {formatPrice(displayValue)}
                </span>
              ) : '-'}
            </span>
            
          </div>
        );
      })}
    </div>
  );
};

export default DailyRevenueBars;
