# Gestor Mantenimiento

Aplicación para el Jefe de Mantenimiento y administradores del Gimnasio Los Arrayanes. El personal es un catálogo de responsables sin usuarios ni contraseñas. Las asignaciones de incidencias se comunican mediante una apertura manual de WhatsApp.

## Arquitectura y alcance

- `frontend/`: React, React Router, Vite y CSS; identidad verde petróleo y menta.
- `backend/`: Express, PostgreSQL, JWT en cookie httpOnly y bcrypt; autorización en servidor.
- `database/`: migraciones SQL versionadas. La V1 usa tablas de mantenimiento independientes.

Módulos: Dashboard, Nueva incidencia, Incidencias, reportes, Personal, Espacios y Administradores. Sólo SUPER_ADMIN gestiona las cuentas administrativas. ADMIN opera incidencias y catálogos. No existen accesos del personal, inventario, órdenes de trabajo independientes, programación ni mensajería automática.

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

Códigos `MT-año-secuencia` se generan en el servidor. El dashboard calcula incidencias sin asignar, asignadas, cierres del mes y tiempo de solución desde los registros reales. Las fechas se presentan en `America/Bogota`. Las incidencias se pueden eliminar con confirmación y sus evidencias se retiran del almacenamiento. La vista de incidencias exporta reportes diarios, mensuales o anuales en PDF y Excel. Personal y espacios se desactivan, conservando sus referencias históricas.

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

Las evidencias de imagen se muestran en una galería privada con visor, navegación y acciones de archivo. Los PDF mantienen una tarjeta de documento. Las incidencias cerradas con fotografías iniciales y finales muestran Antes/Después, adaptable a móvil. El listado utiliza la primera imagen inicial real como miniatura y un símbolo de categoría cuando no existe fotografía; no se añaden imágenes ni personas ficticias. El cliente obtiene los archivos mediante peticiones autenticadas y URL Blob temporales. El único cambio del backend añade metadata segura de esa primera imagen al listado; no cambia el esquema, las cargas ni el ciclo de incidencias.

## Configuración y despliegue

Configure `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` aleatorio de al menos 32 caracteres, `FRONTEND_URL` exacto y `SUPER_ADMIN_PASSWORD` de al menos 12 caracteres para el bootstrap. Use HTTPS. Configure `DATABASE_SSL` según el proveedor.

Para Supabase configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_STORAGE_BUCKET=mantenimiento-evidencias` con un bucket privado. Sin Supabase, el servicio necesita un disco persistente para los archivos locales. No use el seed de demostración con datos reales.

El frontend utiliza `/api` por defecto. El hosting debe reenviar `/api` al backend y servir `index.html` para la navegación React. Para API en otro origen, configure `VITE_API_URL` al compilar y `FRONTEND_URL` en el servidor. La sesión mantiene el respaldo Bearer existente en sessionStorage cuando el navegador bloquea cookies entre sitios.

### Render + Supabase

El archivo `render.yaml` prepara dos servicios gratuitos: `gestor-mantenimiento-arrayanes` para el frontend estático y `gestor-mantenimiento-arrayanes-api` para Express. El backend aplica las migraciones pendientes, verifica el bucket privado y crea la cuenta principal antes de iniciar. Render genera `JWT_SECRET`; durante el primer despliegue solicita `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPER_ADMIN_PASSWORD` sin guardarlos en el repositorio. En producción, `KEEP_ALIVE_URL` consulta el endpoint de salud cada siete minutos para mantener activa la instancia sin tocar datos del aplicativo.

Use en `DATABASE_URL` la conexión **Session pooler** de Supabase, puerto 5432, con la contraseña codificada para URL. Esta modalidad funciona desde redes IPv4 y conserva el estado de sesión que requiere el bloqueo de migraciones. Cree el proyecto Supabase en una región cercana a los usuarios; el bucket `mantenimiento-evidencias` se crea privado desde el backend. La cuenta inicial usa `Admin@gla.edu.co` y una contraseña de producción de al menos 12 caracteres.

Los nombres de servicio determinan estas direcciones esperadas:

- Frontend: `https://gestor-mantenimiento-arrayanes.onrender.com`
- API: `https://gestor-mantenimiento-arrayanes-api.onrender.com/api`

Si Render ajusta alguno de los nombres por disponibilidad, actualice `FRONTEND_URL` en la API y `VITE_API_URL` en el sitio estático, y vuelva a desplegar ambos. El servicio gratuito de API se suspende tras un periodo sin tráfico y su primera apertura puede tardar cerca de un minuto; Supabase también puede pausar proyectos gratuitos por inactividad.

## Verificación

```powershell
npm run lint
npm test
npm run build
npm audit
```

El proyecto es JavaScript; no dispone de una compilación TypeScript. La verificación final del refinamiento del 2 de octubre de 2026 pasó 133 pruebas: 55 de backend y 78 de frontend, con base y evidencias en memoria y conexiones externas deshabilitadas. ESLint y la compilación final también pasaron. Vite procesó 1840 módulos; CSS 91,06 kB / 18,27 kB gzip y JavaScript 334,17 kB / 100,52 kB gzip. La validación inicial del 1 de octubre pasó el backend contra PostgreSQL 16 desechable: 29 pruebas de integración usaron PostgreSQL real y 22 comprobaron utilidades o compatibilidad de migraciones. Esa ejecución PostgreSQL no se repitió para este refinamiento visual.

La iteración posterior de evidencias y tarjetas pasó **180 pruebas: 59 de backend y 121 de frontend**, el 2 de octubre. La revisión de navegador cubrió imágenes, PDF como documento, ausencia/fallo de evidencia, visor y Antes/Después a 1440, 768 y 375 px; el listado también se comprobó a 1600 px. Un recorrido aislado verificó creación, asignación, preparación manual de WhatsApp, solución con evidencia final y cierre, conservando los registros de la instancia principal. ESLint y la compilación se repitieron correctamente al cerrar el 7 de octubre: 1845 módulos, CSS 100,66 kB / 20,05 kB gzip y JavaScript 346,53 kB / 103,71 kB gzip. Consulte [EVIDENCE_EXPERIENCE.md](EVIDENCE_EXPERIENCE.md) para los cambios, capturas y los límites de inspección del lector PDF y de la descarga en el navegador. Los datos y servidores temporales de esa comprobación fueron retirados.

Para repetir la integración PostgreSQL, configure `TEST_POSTGRES_URL` con una base exclusiva de pruebas y ejecute `npm run test -w backend`. Cada suite crea un esquema aleatorio, aplica las tres migraciones y elimina únicamente su esquema al terminar. Sin esa variable se usa la base aislada en memoria.

El coordinador inspeccionó acceso, Dashboard, nueva incidencia, lista, personal, espacios, administradores y detalle a 1440, 768 y 375 píxeles, sin desbordamiento horizontal. Comprobó login/logout, filtros, menú móvil, foco/Escape y apertura/cancelación de formularios de edición sin guardar cambios; la consola no registró errores ni advertencias. Esa revisión de navegador conservó los registros existentes y no realizó un recorrido completo de mutaciones. El recorrido operativo nuevo de creación, asignación, filtros, evidencias privadas, preparación de WhatsApp, solución/cierre y CRUD con permisos se verificó mediante HTTP contra una instancia aislada en memoria. No se abrió WhatsApp ni se envió ningún mensaje en ese recorrido. Consulte los informes actuales de [verificación funcional](output/review/refinement-functional-verification.md) y [verificación de navegador](output/review/refinement-browser-verification.md). Los controles históricos de PostgreSQL y V1 se conservan separados en [VERIFICATION.md](output/review/VERIFICATION.md); los cambios por pantalla están en [VISUAL_REDESIGN.md](VISUAL_REDESIGN.md).

La verificación local no sustituye una validación de despliegue con HTTPS y el bucket/disco elegidos. Ejecute ese control en staging antes de incorporar información real.

## Roadmap de producto

El backlog futuro conserva inventario, mantenimiento preventivo, órdenes de trabajo, costos, proveedores, WhatsApp automático y calendario de mantenimiento. Son candidatos para versiones posteriores, pendientes de priorización; no están implementados en esta V1. Consulte `PROJECT_BACKLOG.md`.

La arquitectura separa catálogos, incidencias, historial, almacenamiento y preparación de mensajes para permitir ese crecimiento.

No se han realizado operaciones de Git. La revisión de Producto/Arquitectura precede a cualquier despliegue.
