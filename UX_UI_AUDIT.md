# Gestor Mantenimiento — auditoría y decisiones V1

Se reutilizan React/Vite, shell administrativo, formularios, modal con manejo de foco, cookie JWT, bcrypt, PostgreSQL y almacenamiento. Se sustituyen la operación de transporte, las pantallas y los endpoints públicos de ese dominio.

La dirección visual proviene de la referencia suministrada: panel arquitectónico en el acceso, verde petróleo, menta, blanco cálido y jerarquía legible. La imagen actual del login es el archivo aportado por el usuario en `frontend/dist/campus-maintenance.png`. Se conserva una copia idéntica en `frontend/public/campus-maintenance.png`, la fuente del recurso, para que Vite la incluya en cada compilación. Sustituye a la imagen generada inicialmente.

La navegación se reduce a Dashboard, Nueva incidencia, Incidencias, Personal, Espacios y Administradores (este último requiere SUPER_ADMIN). No se añaden módulos fuera del alcance solicitado. Se omiten controles visuales que insinuaban funciones inexistentes, como recuperación automática de contraseña o notificaciones no implementadas.

La V1 requiere una imagen final y confirmación para cerrar. No se reabren incidencias cerradas. La aplicación prepara WhatsApp; el administrador decide y envía. El personal no utiliza la plataforma.

La revisión de producto deja un único botón «Nueva incidencia» en la cabecera del dashboard. Las incidencias recientes incluyen su responsable. El tiempo promedio de solución muestra «—» sin cierres válidos, «< 1 h» para un promedio menor de una hora y horas con una décima para los demás valores; el servidor conserva la precisión del promedio. Los textos visibles utilizan «incidencia» para el registro de mantenimiento.

El esquema nuevo preserva las migraciones y cuentas existentes; las evidencias se descargan con autorización. El despliegue debe probarse con los servicios reales elegidos antes de utilizar datos del colegio.
