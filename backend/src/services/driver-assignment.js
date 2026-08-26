function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  throw error;
}

export async function assertActiveDriver(db, driverId, { lock = false } = {}) {
  if (driverId == null) return null;

  const { rows } = await db.query(
    `SELECT id, name, role, status FROM users WHERE id=$1${lock ? ' FOR UPDATE' : ''}`,
    [driverId]
  );
  const driver = rows[0];
  if (!driver || driver.role !== 'CONDUCTOR' || driver.status !== 'ACTIVO') {
    conflict('El conductor asignado debe existir, tener rol CONDUCTOR y estar activo.');
  }
  return driver;
}

export async function assertBusDriverCanChange(db, busId, currentDriverId, nextDriverId) {
  if ((currentDriverId ?? null) === (nextDriverId ?? null)) return;

  const openIncidents = await db.query(
    "SELECT 1 FROM incidents WHERE bus_id=$1 AND status<>'RESUELTO' LIMIT 1",
    [busId]
  );
  if (openIncidents.rowCount) {
    conflict('No puedes cambiar el conductor mientras el bus tenga novedades abiertas.');
  }
}

export async function assertDriverCanBeInactivated(db, driverId) {
  const openIncidents = await db.query(
    "SELECT 1 FROM incidents WHERE responsible_driver_id=$1 AND status<>'RESUELTO' LIMIT 1",
    [driverId]
  );
  if (openIncidents.rowCount) {
    conflict('No puedes inactivar al conductor mientras tenga novedades abiertas.');
  }

  const assignedBus = await db.query('SELECT 1 FROM buses WHERE driver_id=$1 LIMIT 1', [driverId]);
  if (assignedBus.rowCount) {
    conflict('Retira o reasigna el bus del conductor antes de inactivarlo.');
  }
}
