
-- Fix inconsistent bonuses for Paulo Mota (generated while overdue but with wrong status)

-- 1. Tiago upgrade bonus: AVAILABLE -> SUSPENDED
UPDATE partner_referral_bonuses
SET status = 'SUSPENDED',
    available_at = NULL,
    suspended_expires_at = NOW() + INTERVAL '3 days'
WHERE id = '161bbb9e-ab91-4536-9831-77c3e69fe226';

-- 2. Henrique L2 bonus: PENDING -> SUSPENDED
UPDATE partner_referral_bonuses
SET status = 'SUSPENDED',
    available_at = NULL,
    suspended_expires_at = NOW() + INTERVAL '3 days'
WHERE id = 'b8d00dac-0270-4cab-9c04-61fa189d5e33';
