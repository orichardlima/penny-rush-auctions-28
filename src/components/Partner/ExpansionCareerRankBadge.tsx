import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

/**
 * Selo oficial da graduacao do Programa de Expansao (Etapa B).
 * NAO reutiliza GraduationBadge legado nem partner_levels.
 * Le exclusivamente public.expansion_partner_ranks.
 */

export type ExpansionRank = 'NONE' | 'BRONZE' | 'PRATA' | 'OURO' | 'PLATINA' | 'DIAMANTE';

interface ExpansionCareerRankBadgeProps {
  userId?: string;
  size?: 'sm' | 'md' | 'lg';
  showHistoric?: boolean;
  className?: string;
}

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

interface RankRow {
  current_rank: ExpansionRank;
  highest_rank_ever: ExpansionRank;
  current_rank_since: string | null;
}

export const ExpansionCareerRankBadge: React.FC<ExpansionCareerRankBadgeProps> = ({
  userId,
  size = 'md',
  showHistoric = true,
  className,
}) => {
  const { user } = useAuth();
  const targetId = userId ?? user?.id;
  const [row, setRow] = useState<RankRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!targetId) { setLoading(false); return; }
      const { data } = await (supabase as any)
        .from('expansion_partner_ranks')
        .select('current_rank, highest_rank_ever, current_rank_since')
        .eq('user_id', targetId)
        .maybeSingle();
      if (!cancelled) {
        setRow((data as RankRow) ?? {
          current_rank: 'NONE',
          highest_rank_ever: 'NONE',
          current_rank_since: null,
        });
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [targetId]);

  if (loading) {
    return (
      <Badge variant="outline" className={cn('animate-pulse', className)}>
        <span className="w-20 h-4 bg-muted rounded" />
      </Badge>
    );
  }

  const current = (row?.current_rank ?? 'NONE') as ExpansionRank;
  const highest = (row?.highest_rank_ever ?? 'NONE') as ExpansionRank;
  const meta = RANK_META[current] ?? RANK_META.NONE;

  const since = row?.current_rank_since
    ? new Date(row.current_rank_since).toLocaleDateString('pt-BR')
    : null;

  const tooltip = [
    `Graduação atual: ${meta.label}`,
    highest !== 'NONE' ? `Maior graduação histórica: ${RANK_META[highest].label}` : null,
    since ? `Desde ${since}` : null,
  ].filter(Boolean).join(' • ');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className={cn('font-semibold border cursor-help', meta.classes, SIZES[size], className)}>
            <span>{meta.icon}</span>
            <span>{meta.label}</span>
            {showHistoric && highest !== 'NONE' && highest !== current && (
              <span className="opacity-70 font-normal">• máx. {RANK_META[highest].label}</span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ExpansionCareerRankBadge;
