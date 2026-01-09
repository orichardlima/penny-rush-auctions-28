import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Award, Medal, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PartnerBadgeProps {
  planName: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const planConfig = {
  start: {
    label: 'Parceiro Bronze',
    shortLabel: 'Bronze',
    icon: Medal,
    gradient: 'from-amber-700 to-amber-600',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-700',
    iconColor: 'text-amber-600'
  },
  pro: {
    label: 'Parceiro Prata',
    shortLabel: 'Prata',
    icon: Award,
    gradient: 'from-slate-400 to-slate-300',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/30',
    textColor: 'text-slate-600',
    iconColor: 'text-slate-500'
  },
  elite: {
    label: 'Parceiro Ouro',
    shortLabel: 'Ouro',
    icon: Trophy,
    gradient: 'from-yellow-500 to-amber-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    textColor: 'text-yellow-600',
    iconColor: 'text-yellow-500'
  }
};

export const PartnerBadge: React.FC<PartnerBadgeProps> = ({ 
  planName, 
  size = 'md',
  showLabel = true,
  className 
}) => {
  const config = planConfig[planName as keyof typeof planConfig] || planConfig.start;
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: {
      badge: 'px-2 py-0.5 text-xs gap-1',
      icon: 'w-3 h-3'
    },
    md: {
      badge: 'px-3 py-1 text-sm gap-1.5',
      icon: 'w-4 h-4'
    },
    lg: {
      badge: 'px-4 py-1.5 text-base gap-2',
      icon: 'w-5 h-5'
    }
  };

  const sizes = sizeClasses[size];

  return (
    <Badge 
      className={cn(
        'font-semibold border',
        config.bgColor,
        config.borderColor,
        config.textColor,
        sizes.badge,
        className
      )}
    >
      <Icon className={cn(sizes.icon, config.iconColor)} />
      {showLabel && (size === 'sm' ? config.shortLabel : config.label)}
    </Badge>
  );
};

export const PartnerBadgeIcon: React.FC<{ planName: string; className?: string }> = ({ 
  planName,
  className 
}) => {
  const config = planConfig[planName as keyof typeof planConfig] || planConfig.start;
  const Icon = config.icon;
  
  return (
    <div 
      className={cn(
        'rounded-full p-2 bg-gradient-to-br',
        config.gradient,
        className
      )}
    >
      <Icon className="w-5 h-5 text-white" />
    </div>
  );
};

export default PartnerBadge;
