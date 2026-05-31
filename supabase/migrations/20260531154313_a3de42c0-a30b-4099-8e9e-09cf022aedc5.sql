UPDATE public.system_settings
SET setting_value = 'c793d66c-06c5-4fdf-9c2c-0baedd2694f6',
    updated_at = now()
WHERE setting_key = 'super_admin_user_id';