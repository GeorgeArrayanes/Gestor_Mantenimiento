# Gestor Mantenimiento

Aplicación para el Jefe de Mantenimiento y administradores del Gimnasio Los Arrayanes. El personal es un catálogo de responsables sin usuarios ni contraseñas. Las asignaciones de incidencias se comunican mediante una apertura manual de WhatsApp.

## Arquitectura y alcance

- `frontend/`: React, React Router, Vite y CSS; identidad verde petróleo y menta.
- `backend/`: Express, PostgreSQL, JWT en cookie httpOnly y bcrypt; autorización en servidor.
- `database/`: migraciones SQL versionadas. La V1 usa tablas de mantenimiento independientes.

Módulos: Dashboard, Nueva incidencia, Incidencias, Personal, Espacios y Administradores. Sólo SUPER_ADMIN gestiona las cuentas administrativas. ADMIN opera incidencias y catálogos. No existen accesos del personal, inventario, órdenes de trabajo independientes, programación ni mensajería automática.

## Inicio local

Requiere Node.js 22 o superior y PostgreSQL 15/16 para datos persistentes.

```powershell
npm ci
Copy-Item .env.example .env
# Configure POSTGRES_PASSWORD, DATABASE_URL, JWT_SECRET y SUPER_ADMIN_PASSWORD en .env.
docker compose up -d
npm run db:migrate
npm run db:bootstrap-super-admin
npm run dev
```

Frontend: http://localhost:5173. API: http://localhost:4000/api. Use una **base dedicada a Mantenimiento**, nunca la conexión de la aplicación original. Docker utiliza la base `mantenimiento` y un volumen propio. No se ha ejecutado ninguna migración sobre servicios externos.

Para la demostración temporal, configure `DEV_MEMORY_DB=true` y ejecute `npm run dev`. Se cargan catálogos de ejemplo en una base aislada en memoria; sus cambios desaparecen al detener el servidor. No habilite esta opción en producción. Las cuentas `admin@mantenimiento.test` y `superadmin@mantenimiento.test` usan `Mantenimiento2026!` **sólo en esa demostración**; si establece `SUPER_ADMIN_EMAIL`, ese correo sustituye al superadministrador demo. Las cuentas persistentes requieren contraseña por variable de entorno y no usan ese respaldo.

## Flujo de incidencias

1. Registre espacio activo, tipo, prioridad, descripción y evidencia inicial opcional.
2. Sin responsable queda `PENDING`. Con personal activo queda `ASSIGNED`.
3. Asigne o cambie al responsable desde el detalle; se conserva el historial.
4. Pulse **Notificar por WhatsApp**. Revise el texto y envíelo manualmente en WhatsApp.
5. Registre notas de solución, al menos una imagen final y confirme **Cerrar incidencia**.
6. Queda `CLOSED`; no se permiten nuevos cambios ni cierres duplicados.

Códigos `MT-año-secuencia` se generan en el servidor. El dashboard calcula pendientes, asignadas, cierres del mes y tiempo de solución desde los registros reales. Las fechas se presentan en `America/Bogota`. Personal y espacios se desactivan, conservando sus referencias históricas.

## WhatsApp

`backend/src/utils/maintenance.js` normaliza el teléfono, genera el mensaje con datos de la incidencia y construye `https://wa.me/<teléfono>?text=<mensaje codificado>`. Números locales colombianos usan +57; un código internacional existente se conserva. Los formatos inválidos reciben un error comprensible. Abrir el enlace no acredita un envío: no se muestra estado de entrega y no se usa ninguna API de WhatsApp.

## Base de datos

Consulte `database/MIGRATION_PLAN.md` antes del despliegue. `001_init.sql` y `002_super_admin.sql` se conservan como historial original. `003_maintenance.sql` añade el dominio nuevo sin renombrar ni eliminar tablas históricas, sin convertir registros de transporte ni promover usuarios. El ejecutor registra las migraciones aplicadas y las ejecuta en transacciones. No use `db:push`.

Las tablas históricas de transporte no tienen endpoints ni pantallas activas. Las cuentas heredadas no administrativas no pueden iniciar sesión en esta aplicación. Los administradores reutilizan la infraestructura original y las contraseñas existentes.

## Evidencias y seguridad

- JPEG, PNG, WEBP y PDF, hasta 5 archivos por operación y 5 MB por archivo por defecto.
- El servidor comprueba tamaño, MIME y firma del contenido; no confía en el nombre del archivo.
- Descarga autenticada mediante `/api/evidences/:id/download`; el almacenamiento local no es público.
- Nombres aleatorios de almacenamiento; rutas internas y credenciales no se envían al cliente.
- Supabase debe configurarse con un bucket privado; su clave service role permanece exclusivamente en servidor.
- Las mutaciones validan administrador activo, relaciones, estado y catálogo; las operaciones críticas usan bloqueo de filas y transacción.
- Un fallo de carga revierte la operación en la base de datos e intenta eliminar los archivos nuevos ya almacenados. Si el proveedor de almacenamiento falla también al eliminarlos, su limpieza requiere seguimiento operativo.
- Todas las consultas de dominio parametrizan sus valores.

## Configuración y despliegue

Configure `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` aleatorio de al menos 32 caracteres, `FRONTEND_URL` exacto y `SUPER_ADMIN_PASSWORD` de al menos 12 caracteres para el bootstrap. Use HTTPS. Configure `DATABASE_SSL` según el proveedor.

Para Supabase configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET=mantenimiento-evidencias` con un bucket privado. Sin Supabase, el servicio necesita un disco persistente para los archivos locales. No use el seed de demostración con datos reales.

El frontend utiliza `/api` por defecto. El hosting debe reenviar `/api` al backend y servir `index.html` para la navegación React. Para API en otro origen, configure `VITE_API_URL` al compilar y `FRONTEND_URL` en el servidor. La sesión mantiene el respaldo Bearer existente en sessionStorage cuando el navegador bloquea cookies entre sitios.

## Verificación

```powershell
npm run lint
npm test
npm run build
npm audit
```

El proyecto es JavaScript; no dispone de una compilación TypeScript. ESLint revisa referencias y sintaxis; Vite compila el frontend. Tras los ajustes de producto se verificaron 108 pruebas: 55 de backend y 53 de frontend. La validación inicial también pasó el backend contra PostgreSQL 16 desechable: 29 pruebas de integración usaron PostgreSQL real y 22 comprobaron utilidades o compatibilidad de migraciones.

Para repetir la integración PostgreSQL, configure `TEST_POSTGRES_URL` con una base exclusiva de pruebas y ejecute `npm run test -w backend`. Cada suite crea un esquema aleatorio, aplica las tres migraciones y elimina únicamente su esquema al terminar. Sin esa variable se usa la base aislada en memoria.

Se inspeccionó la aplicación en navegador a 1440, 768 y 375 píxeles, incluyendo creación, asignación, WhatsApp, cierre confirmado con evidencias y catálogos. Los resultados y capturas están en `output/review/VERIFICATION.md`.

La verificación local no sustituye una validación de despliegue con HTTPS y el bucket/disco elegidos. Ejecute ese control en staging antes de incorporar información real.

## Roadmap de producto

El backlog futuro conserva inventario, mantenimiento preventivo, órdenes de trabajo, costos, proveedores, WhatsApp automático, reportes y calendario de mantenimiento. Son candidatos para versiones posteriores, pendientes de priorización; no están implementados en esta V1. Consulte `PROJECT_BACKLOG.md`.

La arquitectura separa catálogos, incidencias, historial, almacenamiento y preparación de mensajes para permitir ese crecimiento.

No se han realizado operaciones de Git. La revisión de Producto/Arquitectura precede a cualquier despliegue.
