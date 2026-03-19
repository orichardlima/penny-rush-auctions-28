SET LOCAL app.allow_sensitive_profile_update = 'true';

UPDATE profiles 
SET bids_balance = bids_balance + 50,
    updated_at = now()
WHERE user_id = '6684eb32-8e9b-4539-9792-db3bbbc5f1e8'
  AND bids_balance = 0;