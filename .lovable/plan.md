

# Fix: Unique constraint violation on partner_referral_bonuses

## Root Cause

The unique constraint `partner_referral_bonuses_referred_contract_level_key` enforces uniqueness on `(referred_contract_id, referral_level)`. However, the Fast Start Bonus system (`process_fast_start_bonus`) inserts **additional** rows into the same table with the same `referred_contract_id` and `referral_level` (always `1`), but with `is_fast_start_bonus = true`.

When a new contract is created for a user whose sponsor already qualifies for a Fast Start tier, the chain is:
1. `on_partner_contract_created_cascade` trigger fires, inserts referral bonus (level 1) -- succeeds
2. `trg_check_fast_start` trigger fires on that insert, calls `process_fast_start_bonus`
3. `process_fast_start_bonus` tries to insert ANOTHER row with the same `(referred_contract_id, 1)` but `is_fast_start_bonus = true` -- **violates the constraint**

## Fix

Modify the unique constraint to include `is_fast_start_bonus`, allowing both the original bonus and the fast start complement to coexist for the same contract+level.

### Database Migration

```sql
-- Drop the old constraint
ALTER TABLE public.partner_referral_bonuses 
  DROP CONSTRAINT IF EXISTS partner_referral_bonuses_referred_contract_level_key;

-- Create new constraint that allows both regular and fast-start bonuses
ALTER TABLE public.partner_referral_bonuses 
  ADD CONSTRAINT partner_referral_bonuses_referred_contract_level_key 
  UNIQUE (referred_contract_id, referral_level, is_fast_start_bonus);
```

Also update the `ON CONFLICT` clause in `ensure_partner_referral_bonuses` to match the new constraint:

```sql
) ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus) DO NOTHING;
```

This is applied in all 3 insert statements (levels 1, 2, 3) within the function. Since regular bonuses always have `is_fast_start_bonus = false` (default), the idempotency is preserved.

### No frontend changes needed

The error originates entirely in the database layer. The admin UI code in `AdminUserManagement.tsx` is correct.

