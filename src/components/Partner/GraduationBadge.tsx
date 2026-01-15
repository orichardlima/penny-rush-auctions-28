import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePartnerLevels } from '@/hooks/usePartnerLevels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface GraduationBadgeProps {
  totalPoints: number;
  size?: 'sm' | 'md' | 'lg';
  showPoints?: boolean;
  className?: string;
}

const levelIcons: Record<string, string> = {
  'iniciante': '🌱',
  'bronze': '🥉',
  'prata': '🥈',
  'ouro': '🥇',
  'platina': '💫',
  'diamante': '💎'
};

export const GraduationBadge: React.FC<GraduationBadgeProps> = ({
  totalPoints,
  size = 'md',
  showPoints = true,
  className
}) => {
  const { getCurrentLevel, loading } = usePartnerLevels(totalPoints);
  
  if (loading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        <span className="w-16 h-4 bg-muted rounded" />
      </Badge>
    );
  }

  const currentLevel = getCurrentLevel();
  
  if (!currentLevel) {
    return null;
  }

  const icon = levelIcons[currentLevel.name.toLowerCase()] || '🏆';
  
  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs gap-1',
      icon: 'text-xs'
    },
    md: {
      badge: 'px-3 py-1 text-sm gap-1.5',
      icon: 'text-sm'
    },
    lg: {
      badge: 'px-4 py-1.5 text-base gap-2',
      icon: 'text-base'
    }
  };

  const sizes = sizeClasses[size];

  // Map color from level config to Tailwind classes
  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      'gray-500': { bg: 'bg-gray-500/10', text: 'text-gray-600', border: 'border-gray-500/30' },
      'orange-600': { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30' },
      'slate-400': { bg: 'bg-slate-400/10', text: 'text-slate-500', border: 'border-slate-400/30' },
      'yellow-500': { bg: 'bg-yellow-500/10', text: 'text-yellow-600', border: 'border-yellow-500/30' },
      'purple-500': { bg: 'bg-purple-500/10', text: 'text-purple-600', border: 'border-purple-500/30' },
      'cyan-400': { bg: 'bg-cyan-400/10', text: 'text-cyan-600', border: 'border-cyan-400/30' }
    };
    return colorMap[color] || colorMap['gray-500'];
  };

  const colors = getColorClasses(currentLevel.color);

  const hasReward = currentLevel.reward_type && currentLevel.reward_type !== 'none';
  const tooltipText = hasReward && currentLevel.reward_description
    ? `${currentLevel.reward_icon} Premiação: ${currentLevel.reward_description}`
    : `Sua graduação aumenta com indicações de novos parceiros. Quanto maior o nível, maiores as premiações!`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            className={cn(
              'font-semibold border cursor-help',
              colors.bg,
              colors.text,
              colors.border,
              sizes.badge,
              className
            )}
          >
            <span className={sizes.icon}>{icon}</span>
            <span>{currentLevel.display_name}</span>
            {showPoints && (
              <span className="opacity-70 font-normal">
                • {totalPoints} pts
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default GraduationBadge;
