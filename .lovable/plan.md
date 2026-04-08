

# Fix: ON CONFLICT constraint mismatch in referral bonus trigger

## Problem

The `ensure_partner_referral_bonuses` function uses `ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus)` but the unique constraint was updated to include `source_event` as a 4th column: `(referred_contract_id, referral_level, is_fast_start_bonus, source_event)`.

PostgreSQL requires the ON CONFLICT columns to exactly match a unique index. Since they don't match, the INSERT fails.

## Fix

**1 migration file** that replaces the `ensure_partner_referral_bonuses` function, updating all 3 ON CONFLICT clauses (levels 1, 2, 3) to include `source_event`:

```sql
ON CONFLICT (referred_contract_id, referral_level, is_fast_start_bonus, source_event) DO NOTHING;
```

The INSERT statements also need to explicitly set `source_event = 'activation'` (the default) so the conflict match works correctly.

No frontend changes needed.

