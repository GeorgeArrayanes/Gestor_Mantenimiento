CREATE TABLE IF NOT EXISTS maintenance_personnel (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  specialty VARCHAR(120) NOT NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS maintenance_spaces (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  zone VARCHAR(120) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name,zone)
);
CREATE TABLE IF NOT EXISTS maintenance_incidents (
  id SERIAL PRIMARY KEY,
  code VARCHAR(40) UNIQUE,
  space_id INTEGER NOT NULL REFERENCES maintenance_spaces(id),
  space_name_snapshot VARCHAR(120) NOT NULL,
  space_zone_snapshot VARCHAR(120) NOT NULL,
  problem_type VARCHAR(40) NOT NULL CHECK (problem_type IN ('ELECTRICIDAD','PLOMERIA','CARPINTERIA','PINTURA','INFRAESTRUCTURA','ILUMINACION','MOBILIARIO','EQUIPOS','CERRAJERIA','OTRO')),
  priority VARCHAR(10) NOT NULL CHECK (priority IN ('BAJA','MEDIA','ALTA')),
  description TEXT NOT NULL,
  assigned_person_id INTEGER REFERENCES maintenance_personnel(id),
  assigned_person_name_snapshot VARCHAR(120),
  assigned_person_phone_snapshot VARCHAR(40),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ASSIGNED','CLOSED')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  resolution_notes TEXT,
  CHECK ((status='PENDING' AND assigned_person_id IS NULL AND assigned_at IS NULL) OR (status IN ('ASSIGNED','CLOSED') AND assigned_person_id IS NOT NULL AND assigned_at IS NOT NULL)),
  CHECK ((status='CLOSED' AND closed_at IS NOT NULL AND resolution_notes IS NOT NULL) OR (status<>'CLOSED' AND closed_at IS NULL AND resolution_notes IS NULL))
);
CREATE TABLE IF NOT EXISTS maintenance_evidences (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES maintenance_incidents(id),
  storage_key TEXT NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120) NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size>0),
  category VARCHAR(10) NOT NULL CHECK (category IN ('INITIAL','FINAL')),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS maintenance_history (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES maintenance_incidents(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(40) NOT NULL,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_maintenance_incidents_status_date ON maintenance_incidents(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_incidents_person ON maintenance_incidents(assigned_person_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_incidents_space ON maintenance_incidents(space_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_incidents_closed ON maintenance_incidents(closed_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_evidences_incident ON maintenance_evidences(incident_id,category);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_incident ON maintenance_history(incident_id,created_at);
