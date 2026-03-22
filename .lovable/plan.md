

# Fix: Affiliate purchase history showing blank data due to RLS

## Problem

In `AffiliatePurchaseHistory.tsx`:
- **Line 61-65**: Queries `profiles` directly for `full_name` -- RLS blocks access to other users' profiles
- **Line 71-85**: Queries `bid_purchases` and `bid_packages` -- RLS blocks access to other users' purchases

Result: All rows show "Usuário", "Pacote", "0 lances".

## Solution

### 1. New RPC function (migration SQL)

Create a `SECURITY DEFINER` function `get_affiliate_purchase_details` that:
- Takes an `affiliate_id` UUID, page number, and page size
- Validates the caller owns this affiliate account (security check)
- Joins `affiliate_commissions` with `profiles` (for referred user name), `bid_purchases` (for bids count), and `bid_packages` (for package name)
- Returns all needed fields in one query, bypassing RLS safely
- Includes a total count for pagination

### 2. Update `AffiliatePurchaseHistory.tsx`

Replace the current N+1 query pattern (1 query per commission row) with a single RPC call to `get_affiliate_purchase_details`. This fixes both the RLS issue and the performance problem (currently makes 2-3 queries per row).

## Files changed

| File | Change |
|---|---|
| Migration SQL | New `get_affiliate_purchase_details` RPC function |
| `src/components/Affiliate/AffiliatePurchaseHistory.tsx` | Use RPC instead of direct table queries |

## Also fix: AffiliateReferralsList

The same issue affects `AffiliateReferralsList.tsx` (line 82-84) which also queries `profiles` directly for referred user names. Will update it to use the existing `get_public_profiles` RPC instead.

| File | Change |
|---|---|
| `src/components/Affiliate/AffiliateReferralsList.tsx` | Use `get_public_profiles` RPC for user names |

