# Plan de migración — Gestor Mantenimiento V1

La copia conserva la infraestructura de autenticación `users`, sus contraseñas y los roles `ADMIN` / `SUPER_ADMIN`. Los registros de personal de mantenimiento no son usuarios. Los conductores históricos siguen existiendo en la base, pero esta aplicación rechaza su autenticación y acceso.

Las migraciones históricas `001_init.sql` y `002_super_admin.sql` permanecen intactas. La migración aditiva `003_maintenance.sql` crea espacios, personal, incidencias, evidencias e historial de mantenimiento en tablas independientes. No renombra, elimina ni convierte los registros de transporte y no reutiliza sus evidencias o estados. Las claves foráneas evitan borrar referencias históricas; los catálogos se desactivan.

Antes de ejecutar: verificar que `DATABASE_URL` corresponde a una base independiente de Mantenimiento, realizar respaldo y revisar permisos/almacenamiento privado. Aplicar mediante `npm run db:migrate --workspace backend` (nunca `db:push`). Una base nueva aplica 001, 002 y 003; una copia existente aplica únicamente las migraciones pendientes. El registro `private.schema_migrations` y un bloqueo asesor serializan la ejecución. Ninguna migración ni semilla se ejecuta automáticamente contra PostgreSQL al iniciar el servidor.

Los administradores existentes se conservan. El alta inicial de un superadministrador requiere correo y contraseña por variables de entorno. La semilla de demostración está explícitamente restringida a prueba, memoria o `ALLOW_DEMO_SEED=true`, y está prohibida en producción. El modo memoria es efímero y exclusivo de desarrollo/pruebas.

El almacenamiento anterior se conserva sin exposición pública. Las evidencias nuevas usan claves privadas y se descargan a través de una ruta autenticada. No se ha conectado ni modificado una base productiva o externa durante esta adaptación. La verificación usó una instancia local desechable de PostgreSQL 16, que se retiró al finalizar las pruebas.

La reversión operativa consiste en restaurar el respaldo y la versión anterior; no se incluye una migración destructiva inversa que elimine evidencias o historial.
