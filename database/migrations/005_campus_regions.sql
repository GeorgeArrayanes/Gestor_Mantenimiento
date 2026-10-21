-- Optional association: existing spaces keep NULL and are never matched by name.
ALTER TABLE maintenance_spaces ADD COLUMN IF NOT EXISTS campus_region_id VARCHAR(64);
ALTER TABLE maintenance_spaces ADD CONSTRAINT maintenance_spaces_campus_region_check
  CHECK (campus_region_id IS NULL OR campus_region_id IN (
    'administrativo','bloques-salones','preescolar','bachillerato','transicion',
    'grado-11','comedor','economato','primeros-auxilios','danzas-1','danzas-2',
    'tienda-1','gym','futbol-principal','futbol-norte','patio-central'
  ));
CREATE INDEX IF NOT EXISTS maintenance_spaces_campus_region_idx ON maintenance_spaces(campus_region_id);
