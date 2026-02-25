
-- 1. Enable Realtime for fury_vault_qualifications
ALTER PUBLICATION supabase_realtime ADD TABLE fury_vault_qualifications;

-- 2. Add qualified_count column to fury_vault_instances
ALTER TABLE fury_vault_instances
  ADD COLUMN IF NOT EXISTS qualified_count integer NOT NULL DEFAULT 0;

-- 3. Sync existing data
UPDATE fury_vault_instances fi
SET qualified_count = (
  SELECT count(*)
  FROM fury_vault_qualifications fq
  WHERE fq.vault_instance_id = fi.id AND fq.is_qualified = true
);

-- 4. Create trigger function to maintain qualified_count
CREATE OR REPLACE FUNCTION update_vault_qualified_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_qualified = true THEN
      UPDATE fury_vault_instances
      SET qualified_count = qualified_count + 1
      WHERE id = NEW.vault_instance_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.is_qualified = false AND NEW.is_qualified = true THEN
      UPDATE fury_vault_instances
      SET qualified_count = qualified_count + 1
      WHERE id = NEW.vault_instance_id;
    ELSIF OLD.is_qualified = true AND NEW.is_qualified = false THEN
      UPDATE fury_vault_instances
      SET qualified_count = qualified_count - 1
      WHERE id = NEW.vault_instance_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.is_qualified = true THEN
      UPDATE fury_vault_instances
      SET qualified_count = qualified_count - 1
      WHERE id = OLD.vault_instance_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Create trigger
DROP TRIGGER IF EXISTS trg_update_vault_qualified_count ON fury_vault_qualifications;
CREATE TRIGGER trg_update_vault_qualified_count
  AFTER INSERT OR UPDATE OF is_qualified OR DELETE
  ON fury_vault_qualifications
  FOR EACH ROW
  EXECUTE FUNCTION update_vault_qualified_count();
