import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useExpansionCareer } from '@/hooks/useExpansionCareer';
import { AlertCircle } from 'lucide-react';

export type ExpansionRank = 'NONE' | 'BRONZE' | 'PRATA' | 'OURO' | 'PLATINA' | 'DIAMANTE';

const RANK_META: Record<ExpansionRank, { label: string; icon: string; classes: string }> = {
  NONE: { label: 'Sem graduação', icon: '•', classes: 'bg-muted text-muted-foreground border-border' },
  BRONZE: { label: 'Bronze', icon: '🥉', classes: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  PRATA: { label: 'Prata', icon: '🥈', classes: 'bg-slate-400/10 text-slate-500 border-slate-400/30' },
  OURO: { label: 'Ouro', icon: '🥇', classes: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
  PLATINA: { label: 'Platina', icon: '💫', classes: 'bg-purple-500/10 text-purple-600 border-purple-500/30' },
  DIAMANTE: { label: 'Diamante', icon: '💎', classes: 'bg-cyan-400/10 text-cyan-600 border-cyan-400/30' },
};

const SIZES = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-3 py-1 text-sm gap-1.5',
  lg: 'px-4 py-1.5 text-base gap-2',
};

interface PartnerCareerRankBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Exibe a graduação do próprio parceiro consumindo o hook oficial.
 */
export const PartnerCareerRankBadge: React.FC<PartnerCareerRankBadgeProps> = ({
  size = 'md',
  className,
}) => {
  const { career, loading, error } = useExpansionCareer();

  if (loading) {
    return (
      <Badge variant="outline" className={cn('animate-pulse', className, SIZES[size])}>
        <span className="w-20 h-4 bg-muted rounded" />
      </Badge>
    );
  }

  if (error || !career) {
    return (
      <Badge variant="destructive" className={cn('gap-1', className, SIZES[size])}>
        <AlertCircle className="h-3 w-3" />
        <span>Indisponível</span>
      </Badge>
    );
  }

  const current = (career.rank_key || 'NONE') as ExpansionRank;
  const meta = RANK_META[current] ?? RANK_META.NONE;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('font-semibold border cursor-help', meta.classes, SIZES[size], className)}>
            <span>{meta.icon}</span>
            <span>{career.rank_label || meta.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">Sua Graduação oficial no Programa de Expansão</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default PartnerCareerRankBadge;
