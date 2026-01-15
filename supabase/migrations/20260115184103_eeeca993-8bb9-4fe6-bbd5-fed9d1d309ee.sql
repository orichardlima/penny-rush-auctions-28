-- Add reward columns to partner_levels table
ALTER TABLE partner_levels 
ADD COLUMN IF NOT EXISTS reward_type TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reward_description TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reward_value NUMERIC(10,2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS reward_icon TEXT DEFAULT '🎁';

-- Add comment for documentation
COMMENT ON COLUMN partner_levels.reward_type IS 'Type of reward: cash, travel, vehicle, experience, gift, none';
COMMENT ON COLUMN partner_levels.reward_description IS 'Human-readable description of the reward';
COMMENT ON COLUMN partner_levels.reward_value IS 'Estimated monetary value of the reward for internal tracking';
COMMENT ON COLUMN partner_levels.reward_icon IS 'Emoji icon representing the reward';