# RutaSegura

RutaSegura es un MVP funcional para gestionar buses escolares, conductores, daños, reparaciones, evidencias, validaciones e historial. Tiene tres perfiles protegidos: **SUPER_ADMIN**, **ADMIN** y **CONDUCTOR**.

## Arquitectura

```text
frontend/   React + Vite + React Router + CSS
backend/    Node.js + Express + JWT + bcrypt + API REST
database/   migración SQL reproducible para PostgreSQL/Supabase
```

El frontend nunca decide por sí solo si una acción está autorizada. La API vuelve a comprobar rol, conductor responsable, bus asignado y transición de estado. Las evidencias se almacenan en Supabase Storage (o en `backend/uploads` durante desarrollo local) y PostgreSQL conserva únicamente la referencia del archivo.

## Funcionalidades terminadas

- Inicio y cierre de sesión mediante cookie JWT `httpOnly`; contraseñas bcrypt.
- Dashboard administrativo con métricas calculadas desde la base de datos.
- Portal responsive del conductor con sus novedades y su bus asignado.
- CRUD de buses y conductores, asignación de conductor y estados operativos.
- Registro separado de daños preexistentes por bus.
- Creación, búsqueda y filtros de novedades.
- Carga acumulativa de JPG, JPEG, PNG, WEBP y PDF (máximo configurable, 5 MB por defecto).
- Flujo controlado: `REPORTADO → EN_PROCESO → PENDIENTE_VALIDACION → RESUELTO`.
- Rechazo obligatorio con motivo y ciclo `REQUIERE_CORRECCION → EN_PROCESO → PENDIENTE_VALIDACION`.
- Historial inmutable y múltiples evidencias clasificadas como reporte, solución o corrección.
- Notificaciones internas con contador de no leídas.
- Adaptador preparado para WhatsApp sin simular envíos.
- Mensajes de error comprensibles, estados de carga y confirmaciones para aprobar/rechazar.

## Requisitos

- Node.js 22 o superior.
- PostgreSQL 15/16, una base Supabase, o Docker para el entorno local persistente.

## Instalación rápida

```bash
npm install
cp .env.example .env
docker compose up -d
npm run db:migrate
npm run db:seed
npm run dev
```

En Windows PowerShell, copie el entorno con `Copy-Item .env.example .env`.

Abra `http://localhost:5173`. La API se ejecuta en `http://localhost:4000`.

### Demostración sin PostgreSQL instalado

Para una demostración efímera, defina `DEV_MEMORY_DB=true` en `.env` y ejecute `npm run dev`. Se usa PostgreSQL compatible en memoria y se carga el seed al iniciar. Los cambios duran mientras el proceso del backend continúe activo. Para el producto real utilice PostgreSQL/Supabase.

## PostgreSQL y Supabase

1. Cree un proyecto Supabase o una base PostgreSQL vacía.
2. Copie su conexión en `DATABASE_URL`. Para Supabase, use la URL del pooler o la conexión directa adecuada al entorno.
3. Active `DATABASE_SSL=true` cuando el proveedor lo requiera.
4. Defina `SUPER_ADMIN_PASSWORD` con al menos 12 caracteres.
5. Ejecute `npm run db:migrate` y luego `npm run db:seed`.

Para una base ya desplegada, cree únicamente la cuenta maestra sin insertar datos de demostración:

```bash
npm run db:migrate
# Configure SUPER_ADMIN_PASSWORD en el entorno antes del siguiente comando.
npm run db:bootstrap-super-admin
```

El bootstrap usa `Admin@gla.edu.co` por defecto, es idempotente y no promueve cuentas existentes automáticamente. La contraseña debe tener al menos 12 caracteres y nunca debe guardarse en el repositorio.

La migración [001_init.sql](database/migrations/001_init.sql) crea:

- `users`
- `buses`
- `preexisting_damages`
- `incidents`
- `evidences`
- `incident_history`
- `notifications`
- claves foráneas, restricciones únicas, checks e índices.

### Supabase Storage

1. Cree un bucket **privado** llamado `rutasegura-evidencias` (o cambie `SUPABASE_STORAGE_BUCKET`).
2. Configure `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` sólo en el backend.
3. Nunca exponga la service role key en variables `VITE_*`.

El backend genera nombres aleatorios, valida MIME/tamaño y entrega URLs firmadas de una hora. Sin credenciales Supabase, desarrollo guarda archivos en `backend/uploads`.

## Variables de entorno

| Variable | Propósito |
| --- | --- |
| `PORT` | Puerto de Express, por defecto 4000. |
| `DATABASE_URL` | Conexión PostgreSQL. |
| `DATABASE_SSL` | `true` para proveedores con SSL. |
| `JWT_SECRET` | Secreto aleatorio de al menos 32 caracteres. |
| `JWT_EXPIRES_IN` | Duración del JWT. |
| `FRONTEND_URL` | Origen permitido por CORS. |
| `MAX_FILE_SIZE_MB` | Límite por archivo. |
| `SUPABASE_URL` | URL del proyecto Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privada del backend. |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado de evidencias. |
| `SUPER_ADMIN_EMAIL` | Correo de la cuenta maestra; por defecto `Admin@gla.edu.co`. |
| `SUPER_ADMIN_PASSWORD` | Contraseña inicial, obligatoria para crear la cuenta en una base persistente. |
| `DEV_MEMORY_DB` | Base efímera sólo para demo/pruebas. |
| `VITE_API_URL` | URL pública de la API para el frontend. |

## Cuentas de desarrollo

Todas usan la contraseña: `RutaSegura2026!`

| Rol | Usuario |
| --- | --- |
| Administrador | `admin@rutasegura.test` |
| Conductor Bus 04 | `carlos@rutasegura.test` |
| Conductor Bus 12 | `roberto@rutasegura.test` |

Son credenciales exclusivas del seed de desarrollo. Cámbielas o elimínelas antes de usar datos reales.

En una base persistente, la cuenta `SUPER_ADMIN` usa exclusivamente la contraseña configurada en el entorno. Sólo la demostración efímera con `DEV_MEMORY_DB=true` utiliza la contraseña común de desarrollo. Esta cuenta es la única que puede listar, crear o editar administradores.

## Comandos

```bash
npm run dev          # frontend y backend
npm run build        # compilación de producción del frontend
npm test             # pruebas de reglas críticas y UI
npm run db:migrate   # aplica el esquema
npm run db:seed      # carga datos de desarrollo de forma idempotente
npm run db:bootstrap-super-admin # crea únicamente la cuenta maestra
```

## API principal

- `/api/auth`: login, sesión y logout.
- `/api/dashboard`: métricas administrativas.
- `/api/users`: administración de conductores/usuarios.
- `/api/buses`: flota y daños preexistentes.
- `/api/incidents`: novedades, evidencia y transiciones.
- `/api/notifications`: bandeja interna y lectura.

## Pruebas

La suite de integración recorre autenticación, autorización administrativa, aislamiento entre conductores, creación de novedad, evidencia, inicio, envío, rechazo con motivo, corrección, reenvío, aprobación, bloqueo de transiciones y conservación de historial/evidencias. Usa una base PostgreSQL compatible aislada por ejecución.

## Despliegue

1. Despliegue `backend/` en un servicio Node (Render, Railway, Fly.io, Cloud Run u otro) con las variables privadas.
2. Ejecute la migración y `db:bootstrap-super-admin`; use el seed completo sólo si requiere datos demo.
3. Compile `frontend/` con `VITE_API_URL=https://su-api.example.com/api` y publique `frontend/dist` en un host estático.
4. Configure `FRONTEND_URL` con el origen exacto del frontend y HTTPS en ambos servicios.
5. Para cookies entre dominios distintos, adapte `sameSite`/`secure` y use dominios propios del mismo sitio cuando sea posible.

## Integración futura de WhatsApp

La abstracción está en `backend/src/services/external-notifications.js`. Implemente allí un proveedor con WhatsApp Business Cloud API y credenciales de entorno. La lógica central ya llama al servicio al asignar una novedad, pero el adaptador actual devuelve `delivered: false`; no finge que un mensaje fue enviado. Las notificaciones internas mantienen todo el flujo operativo aun sin WhatsApp.

## Decisiones y límites reales

- La entrega no incluye credenciales reales de PostgreSQL, Supabase ni WhatsApp.
- No se envían mensajes externos; sólo quedan preparados mediante un adaptador.
- El seed trae tres buses, dos conductores, un administrador y novedades iniciales.
- La alternativa en memoria es sólo una comodidad de desarrollo; producción debe usar PostgreSQL.
