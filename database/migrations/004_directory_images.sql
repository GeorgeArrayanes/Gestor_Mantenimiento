ALTER TABLE maintenance_spaces
  ADD COLUMN IF NOT EXISTS image_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS image_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS image_file_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS image_file_size INTEGER;

ALTER TABLE maintenance_personnel
  ADD COLUMN IF NOT EXISTS image_storage_key TEXT,
  ADD COLUMN IF NOT EXISTS image_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS image_file_type VARCHAR(120),
  ADD COLUMN IF NOT EXISTS image_file_size INTEGER;

ALTER TABLE maintenance_spaces
  DROP CONSTRAINT IF EXISTS maintenance_spaces_image_file_size_check;
ALTER TABLE maintenance_spaces
  ADD CONSTRAINT maintenance_spaces_image_file_size_check
  CHECK (image_file_size IS NULL OR image_file_size > 0);

ALTER TABLE maintenance_personnel
  DROP CONSTRAINT IF EXISTS maintenance_personnel_image_file_size_check;
ALTER TABLE maintenance_personnel
  ADD CONSTRAINT maintenance_personnel_image_file_size_check
  CHECK (image_file_size IS NULL OR image_file_size > 0);
