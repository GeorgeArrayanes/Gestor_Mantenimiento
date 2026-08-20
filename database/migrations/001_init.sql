CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  identification VARCHAR(40) UNIQUE,
  username VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30),
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'CONDUCTOR')),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS buses (
  id SERIAL PRIMARY KEY,
  reference VARCHAR(40) NOT NULL,
  plate VARCHAR(20) NOT NULL UNIQUE,
  brand VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  route VARCHAR(160),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  current_status VARCHAR(30) NOT NULL DEFAULT 'OPERATIVO' CHECK (current_status IN ('OPERATIVO', 'CON_NOVEDADES', 'EN_MANTENIMIENTO', 'FUERA_DE_SERVICIO')),
  driver_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preexisting_damages (
  id SERIAL PRIMARY KEY,
  bus_id INTEGER NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  file_url TEXT,
  damage_date DATE NOT NULL,
  registered_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  bus_id INTEGER NOT NULL REFERENCES buses(id),
  reported_by INTEGER NOT NULL REFERENCES users(id),
  responsible_driver_id INTEGER REFERENCES users(id),
  damage_type VARCHAR(40) NOT NULL CHECK (damage_type IN ('CARROCERIA','LLANTAS','LUCES_ELECTRICO','MOTOR','FRENOS','INTERIOR','VIDRIOS','PUERTAS','OTRO')),
  other_damage_type VARCHAR(120),
  description TEXT NOT NULL,
  urgency VARCHAR(10) NOT NULL CHECK (urgency IN ('BAJA','MEDIA','ALTA')),
  status VARCHAR(30) NOT NULL DEFAULT 'REPORTADO' CHECK (status IN ('REPORTADO','EN_PROCESO','PENDIENTE_VALIDACION','REQUIERE_CORRECCION','RESUELTO')),
  reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attention_started_at TIMESTAMPTZ,
  last_solution_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (damage_type = 'OTRO' OR other_damage_type IS NULL)
);

CREATE TABLE IF NOT EXISTS evidences (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(120) NOT NULL,
  category VARCHAR(20) NOT NULL CHECK (category IN ('REPORTE','SOLUCION','CORRECCION')),
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_history (
  id SERIAL PRIMARY KEY,
  incident_id INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  event_type VARCHAR(60) NOT NULL,
  previous_status VARCHAR(30),
  new_status VARCHAR(30),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type VARCHAR(40) NOT NULL,
  reference_url VARCHAR(255),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_bus ON incidents(bus_id);
CREATE INDEX IF NOT EXISTS idx_incidents_driver ON incidents(responsible_driver_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON incidents(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidences_incident ON evidences(incident_id);
CREATE INDEX IF NOT EXISTS idx_history_incident ON incident_history(incident_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
