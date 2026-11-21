/**
 * Helpers centralizados de contagem de indicados.
 *
 * Regra única para todas as telas do painel do parceiro:
 * - conta PESSOAS únicas (por `referred_user_id`), não registros de bônus
 *   (um mesmo indicado pode gerar vários bônus: upgrade, Início Rápido retroativo etc.)
 * - ignora bônus com status CANCELLED
 */

export interface CountableReferralBonus {
  referred_user_id: string;
  referral_level?: number | null;
  status?: string | null;
  is_fast_start_bonus?: boolean | null;
}

export const isActiveReferralBonus = (b: CountableReferralBonus): boolean =>
  (b.status || '').toUpperCase() !== 'CANCELLED';

/** O adicional de Início Rápido pertence a um evento já existente e não gera outro cartão na rede. */
export const isReferralNetworkEvent = (b: CountableReferralBonus): boolean =>
  b.is_fast_start_bonus !== true;

/** Pessoas únicas em uma lista de bônus (já ignora CANCELLED). */
export const countUniqueReferrals = (bonuses: CountableReferralBonus[]): number =>
  new Set(bonuses.filter(isActiveReferralBonus).map(b => b.referred_user_id)).size;

/** Pessoas únicas por nível (1, 2, 3) + total geral. */
export const countByLevel = (bonuses: CountableReferralBonus[]) => {
  const active = bonuses.filter(isActiveReferralBonus);
  const atLevel = (level: number) => active.filter(b => b.referral_level === level);

  return {
    total: countUniqueReferrals(active),
    level1: countUniqueReferrals(atLevel(1)),
    level2: countUniqueReferrals(atLevel(2)),
    level3: countUniqueReferrals(atLevel(3)),
  };
};
