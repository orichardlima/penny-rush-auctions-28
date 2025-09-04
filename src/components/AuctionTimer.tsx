import React, { useState, useEffect } from 'react';
import { Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AuctionTimerProps {
  initialTimeLeft: number;
  isActive: boolean;
  onTimerEnd?: () => void;
  className?: string;
}

export const AuctionTimer = ({ 
  initialTimeLeft, 
  isActive, 
  onTimerEnd,
  className 
}: AuctionTimerProps) => {
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft);
  const [isBlinking, setIsBlinking] = useState(false);

  // Sincronizar com o valor inicial quando muda
  useEffect(() => {
    setTimeLeft(initialTimeLeft);
  }, [initialTimeLeft]);

  // Countdown local (para fluidez visual entre updates do server)
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft(prevTime => {
        const newTime = Math.max(prevTime - 1, 0);
        
        // Trigger callback when timer ends
        if (newTime === 0 && onTimerEnd) {
          onTimerEnd();
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, timeLeft, onTimerEnd]);

  // Efeito de piscar quando timer crítico (≤ 5 segundos)
  useEffect(() => {
    if (timeLeft <= 5 && timeLeft > 0 && isActive) {
      setIsBlinking(true);
      const blinkInterval = setInterval(() => {
        setIsBlinking(prev => !prev);
      }, 500);
      return () => clearInterval(blinkInterval);
    } else {
      setIsBlinking(false);
    }
  }, [timeLeft, isActive]);

  // Determinar cor e estilo baseado no tempo restante
  const getTimerVariant = () => {
    if (!isActive) return 'secondary';
    if (timeLeft <= 3) return 'destructive';
    if (timeLeft <= 5) return 'default';
    if (timeLeft <= 10) return 'secondary';
    return 'default';
  };

  const getTimerText = () => {
    if (!isActive) return 'Inativo';
    if (timeLeft <= 0) return 'Finalizado';
    return `${timeLeft}s`;
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Ícone do timer */}
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200",
        isActive && timeLeft > 0 ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400",
        timeLeft <= 5 && isActive && "bg-red-100 text-red-600",
        isBlinking && "animate-pulse"
      )}>
        {timeLeft <= 5 && isActive ? (
          <Zap className="w-4 h-4" />
        ) : (
          <Clock className="w-4 h-4" />
        )}
      </div>

      {/* Badge com tempo restante */}
      <Badge 
        variant={getTimerVariant()}
        className={cn(
          "text-sm font-mono font-bold min-w-[60px] justify-center transition-all duration-200",
          timeLeft <= 5 && isActive && "animate-pulse",
          timeLeft <= 3 && isActive && "bg-red-500 text-white border-red-500",
          !isActive && "bg-gray-200 text-gray-500"
        )}
      >
        {getTimerText()}
      </Badge>

      {/* Status visual adicional para timer crítico */}
      {timeLeft <= 5 && isActive && timeLeft > 0 && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-semibold text-red-600",
          isBlinking && "animate-pulse"
        )}>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
          CRÍTICO
        </div>
      )}

      {/* Finalizado */}
      {timeLeft <= 0 && (
        <div className="text-xs font-semibold text-gray-500">
          ⏰ Tempo esgotado
        </div>
      )}
    </div>
  );
};