

## Plan: Add editable referral code field to PartnerDashboard

### Problem
Users who access the partner page without a referral link (`?ref=CODE`) have no way to manually enter a sponsor's referral code, resulting in them being registered without a sponsor.

### Solution
Add an input field for "Codigo de Indicação" in the plan selection view (when `!contract`), between the header text and the plan cards. The manually entered code takes priority over localStorage when selecting a plan.

### Changes

**File: `src/components/Partner/PartnerDashboard.tsx`**

1. Add state `manualReferralCode` (string)
2. Pre-fill it with `getPartnerReferralCodeFromUrlOrStorage()` on mount (so if there's already a code from URL/storage, it shows)
3. Add an input field with label "Código de Indicação (opcional)" between the header and plan cards, with a helper text explaining its purpose
4. When selecting a plan (line ~410), use `manualReferralCode` if filled, otherwise fall back to `getPartnerReferralCodeFromUrlOrStorage()`
5. Same logic for the auto-select via `preselectedPlanId` (line ~163)

### UI
- Simple `Input` + `Label` inside a small card/alert, positioned above the plan grid
- Shows a check icon if code is pre-filled from URL, editable either way
- Non-intrusive: optional field, does not block plan selection

