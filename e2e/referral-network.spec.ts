import { expect, test } from '@playwright/test';
import {
  countUniqueReferrals,
  isReferralNetworkEvent,
  type CountableReferralBonus,
} from '../src/lib/referralCounts';

const activation: CountableReferralBonus = {
  referred_user_id: 'oberdan',
  referral_level: 1,
  status: 'PENDING',
  is_fast_start_bonus: false,
};

const upgrade: CountableReferralBonus = {
  ...activation,
  status: 'PENDING',
};

test('Ativação e upgrade da mesma pessoa contam uma indicação para a meta', () => {
  expect(countUniqueReferrals([activation, upgrade])).toBe(1);
});

test('Adicional de Início Rápido não cria outro cartão para o mesmo indicado', () => {
  const fastStart: CountableReferralBonus = {
    ...activation,
    is_fast_start_bonus: true,
  };

  expect([activation, upgrade, fastStart].filter(isReferralNetworkEvent)).toHaveLength(2);
  expect(isReferralNetworkEvent(fastStart)).toBe(false);
});
