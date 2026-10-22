-- Add individual selection without moving or guessing existing space links.
-- The old shared region remains valid for records created before this revision.
ALTER TABLE maintenance_spaces DROP CONSTRAINT maintenance_spaces_campus_region_check;
ALTER TABLE maintenance_spaces ADD CONSTRAINT maintenance_spaces_campus_region_check
  CHECK (campus_region_id IS NULL OR campus_region_id IN (
    'administrativo','bloques-salones',
    'bloque-1','bloque-2','bloque-3','bloque-4','bloque-atravesado',
    'preescolar','bachillerato','transicion',
    'grado-11','comedor','economato','primeros-auxilios','danzas-1','danzas-2',
    'tienda-1','gym','futbol-principal','futbol-norte','patio-central'
  ));

-- Two buildings may both contain "Salón 101 / Piso 1". NULL remains one shared
-- namespace, so unassigned spaces keep the same uniqueness as before.
ALTER TABLE maintenance_spaces DROP CONSTRAINT maintenance_spaces_name_zone_key;
CREATE UNIQUE INDEX maintenance_spaces_name_zone_campus_region_idx
  ON maintenance_spaces(name,zone,COALESCE(campus_region_id,''));
