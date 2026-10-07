# Verificación de Gestor Mantenimiento

## Rediseño visual — 2 de octubre de 2026

Entorno local. Verificación del código compartido tras el rediseño, sin reiniciar servicios ni modificar los datos de revisión existentes.

| Control actual | Resultado |
| --- | --- |
| `npm test` | Correcto: **133 pruebas**, 55 backend en 7 archivos y 78 frontend en 8 archivos. |
| `npm run lint` | Correcto para frontend y backend. |
| ESLint tras los últimos ajustes | Correcto para `ReportIncidentPage.jsx`, `LoginPage.jsx` e `IncidentsPage.jsx`. |
| `npm run build`, final tras el acabado CSS | Correcto: Vite 8.2.1, 1840 módulos; CSS 74,50 kB / 15,25 kB gzip; JS 332,02 kB / 100,14 kB gzip. |
| Navegador: ocho vistas | Confirmadas por el coordinador a 1440, 768 y 375 px, sin desbordamiento horizontal ni recorte de tarjetas, paneles y controles. 24 capturas creadas. |
| Navegador: controles finales | Consola sin errores/advertencias; medición de escritorio correcta y menú contraído comprobado a 1680 px. Vista expandida y tamaño del navegador restaurados. |
| PostgreSQL real y `npm audit --omit=dev` | No repetidos en esta revisión visual; resultados históricos separados abajo. |
| Typecheck | No aplica: JavaScript, sin configuración TypeScript. |

Las suites actuales se ejecutaron con la configuración de pruebas por defecto, sin `TEST_POSTGRES_URL`; no representan una nueva ejecución contra PostgreSQL real. El rediseño añade 25 pruebas frontend: 17 para `IncidentCard` y 8 para filtros de `IncidentsPage`. La prueba de cabecera del Dashboard se adapta a «Estado general del colegio» y conserva la comprobación de que no se duplique «Nueva incidencia» dentro de esa vista.

La cobertura nueva comprueba visibilidad del contacto según estado/asignación/teléfono, preferencia del teléfono actual sobre el histórico, enlaces de detalle, presentación compacta, rechazo de URLs WhatsApp inseguras, combinación de filtros y búsqueda. Estas pruebas utilizan fixtures aisladas; no crean mocks, semillas ni registros en los servicios de revisión.

### Datos y alcance del rediseño

Los paneles y catálogos siguen consultando las APIs existentes. El Dashboard carga `/dashboard`, `/incidents`, `/spaces` y `/personnel`. La lista aplica filtros de estado, prioridad, responsable, espacio y texto a los datos recibidos; los enlaces de Dashboard por responsable/espacio conservan esa selección.

Se mantienen tres estados: Pendiente, Asignada y Cerrada. No se añaden datos de disponibilidad, último acceso ni estados de entrega de WhatsApp. Las personas utilizan iniciales/siluetas. El recurso arquitectónico procede de `frontend/public/campus-maintenance.png`, aportado previamente por el usuario. Los símbolos de espacios y problemas se construyen con iconos y CSS.

Los archivos principales del rediseño y los cambios por pantalla están registrados en `VISUAL_REDESIGN.md` y `UX_UI_AUDIT.md`.

### Navegador del rediseño y capturas actuales

El coordinador revisó acceso, Dashboard, nueva incidencia, incidencias, personal, espacios, administradores y el detalle de `MT-2026-003` a 1440 px (escritorio), 768 px (tablet) y 375 px (móvil). Confirmó ausencia de desbordamiento horizontal y recorte de tarjetas, paneles, inputs y selects. En las ocho vistas de escritorio, el ancho de scroll coincide con los 1440 px y no se detectaron elementos recortados. La consola no registró errores ni advertencias después de las visitas.

El menú contraído se comprobó a 1680 px: columna lateral de 87 px, sidebar de 71 px y contenido principal de 1544,2 px; el ancho de scroll fue 1665 px, dentro del viewport. Después se restauraron el menú expandido y el tamaño habitual del navegador.

Los filtros comprobaron conexiones reales: el espacio 1 del Dashboard muestra la incidencia 1; el responsable 2 muestra la incidencia 3; buscar «Pedro» en Personal devuelve un responsable; Bloque B en Espacios devuelve Biblioteca; Administradores inactivos devuelve un estado vacío sin filas. Los diálogos de personal, espacio, administrador e incidencia se abrieron y cancelaron, con foco inicial en el input/select correspondiente y un único diálogo en el árbol de accesibilidad. No se guardaron cambios ni se enviaron mensajes.

Se conservaron las tres incidencias existentes; `MT-2026-003` mantiene Portería, Pedro y su evidencia JPEG. Los avatares muestran iniciales, sin fotografías de personas.

Se crearon 24 capturas del rediseño (2 de octubre), ocho vistas en tres tamaños:

| Vista | Escritorio | Tablet | Móvil |
| --- | --- | --- | --- |
| Acceso | [PNG](redesign-login-desktop.png) | [PNG](redesign-login-tablet.png) | [PNG](redesign-login-mobile.png) |
| Dashboard | [PNG](redesign-dashboard-desktop.png) | [PNG](redesign-dashboard-tablet.png) | [PNG](redesign-dashboard-mobile.png) |
| Nueva incidencia | [PNG](redesign-new-incident-desktop.png) | [PNG](redesign-new-incident-tablet.png) | [PNG](redesign-new-incident-mobile.png) |
| Incidencias | [PNG](redesign-incidents-desktop.png) | [PNG](redesign-incidents-tablet.png) | [PNG](redesign-incidents-mobile.png) |
| Personal | [PNG](redesign-personnel-desktop.png) | [PNG](redesign-personnel-tablet.png) | [PNG](redesign-personnel-mobile.png) |
| Espacios | [PNG](redesign-spaces-desktop.png) | [PNG](redesign-spaces-tablet.png) | [PNG](redesign-spaces-mobile.png) |
| Administradores | [PNG](redesign-admins-desktop.png) | [PNG](redesign-admins-tablet.png) | [PNG](redesign-admins-mobile.png) |
| Detalle de incidencia | [PNG](redesign-incident-detail-desktop.png) | [PNG](redesign-incident-detail-tablet.png) | [PNG](redesign-incident-detail-mobile.png) |

## V1 — resultados históricos del 1 de octubre de 2026

Los siguientes resultados corresponden a la adaptación inicial y su revisión de producto. Se conservan como evidencia histórica; no se presentan como comprobaciones nuevas del rediseño.

| Control histórico | Resultado |
| --- | --- |
| `npm test`, tras revisión de producto V1 | 108 pruebas correctas: 55 backend y 53 frontend. |
| PostgreSQL 16 local desechable, validación inicial | 51 correctas: 29 de integración sobre PostgreSQL real y 22 de utilidades/migraciones históricas. |
| `npm run build` V1 | Correcto: 1833 módulos; JS 311,77 kB / 94,27 kB gzip. |
| `npm audit --omit=dev` V1 | 0 vulnerabilidades. |

Las suites PostgreSQL históricas aplicaron 001, 002 y 003 en esquemas aleatorios independientes. Los esquemas y el contenedor de prueba se retiraron. No se conectó ni modificó una base productiva o externa. Las migraciones históricas permanecen intactas.

### Aceptación e integridad de V1

La prueba automatizada crea `MT-2026-001` en una base vacía, con Baño Bloque A, Plomería, prioridad Alta, descripción «Fuga debajo del lavamanos» y fotografía inicial. Verifica `PENDING`, asignación a Carlos Rodríguez, `ASSIGNED`, destino/texto codificado de WhatsApp, notas «Se reemplazó la llave y se ajustó la tubería.», fotografía final, confirmación, `CLOSED`, historial y métricas. Esta cobertura backend permanece dentro de las 55 pruebas actuales.

Las pruebas cubren asignación activa, desactivación de catálogos conservando datos históricos, identificadores/relaciones inválidos, rechazo de acceso anónimo y roles no administrativos, restricciones SUPER_ADMIN, revocación de acceso cuando cambia el usuario en DB, origen de mutaciones, límites concurrentes de login, cierre duplicado/concurrente, imagen final obligatoria y reversión cuando falla una carga. La evidencia se descarga con autorización y bytes comprobados; no existe un directorio público de archivos privados. La corrección del teléfono del personal afecta el destino actual de WhatsApp y conserva el teléfono histórico de la incidencia.

En el navegador V1 se recorrió el registro demo `MT-2026-003`, con asignación posterior y durante la creación, validación de cierre sin fotografía, confirmación, archivos inicial/final e historial. Se comprobó el bloqueo de edición/cierre tras cerrar y el reflejo de un cierre en Dashboard. WhatsApp abrió el enlace preparado; no se envió ningún mensaje ni se atribuyó entrega.

La revisión de producto verificó la CTA única, responsable en actividad reciente y el promedio de resolución: «—» sin datos válidos, «< 1 h» bajo una hora y hasta una décima en otros valores. Incluye la frontera 0,96 h / 1 h. La revisión local preservó tres incidencias, sus fechas, cinco eventos y la evidencia privada frente a un respaldo temporal. Es una comprobación histórica de conservación, no una mutación realizada para el rediseño.

### Navegador y capturas históricos

La V1 se inspeccionó en 1440, 768 y 375 px, incluyendo acceso, Dashboard, nueva incidencia, lista, detalle, personal, espacios y cierre. También se revisaron Administradores, navegación móvil, foco de diálogos y menú contraído a 1680 px. Las vistas entonces comprobadas no presentaban desbordamiento horizontal; una pestaña nueva del Dashboard no registró advertencias ni errores de consola.

Las siguientes capturas corresponden a esa versión histórica:

- [Dashboard de escritorio V1](dashboard-desktop.jpg)
- [Dashboard móvil V1](dashboard-mobile.jpg)
- [Dashboard de tablet V1](dashboard-tablet.jpg)
- [Incidencia cerrada V1](incident-closed-desktop.jpg)
- [Acceso de escritorio V1](login-desktop.jpg)
- [Acceso de tablet V1](login-tablet.jpg)
- [Acceso móvil V1](login-mobile.jpg)

## Límites de la verificación

No se ha realizado despliegue productivo. HTTPS, la conexión PostgreSQL definitiva y el bucket privado o disco persistente elegidos requieren comprobación en el entorno final. Supabase necesita configuración efectiva de bucket privado. La limpieza de archivos tras un error es compensatoria y puede requerir seguimiento si el proveedor está indisponible. El límite de login reside en cada proceso API; varias réplicas necesitan control compartido o en el proxy.

La vista local de revisión utiliza una base demo en memoria, cuyos cambios desaparecen al detener el servidor. La revisión visual no acredita persistencia productiva ni reemplaza una auditoría completa de accesibilidad con tecnología de asistencia.

## Roadmap — futuro, no implementado

Inventario, mantenimiento preventivo, órdenes de trabajo, costos, proveedores, WhatsApp automático, reportes y calendario de mantenimiento se mantienen en `PROJECT_BACKLOG.md`, pendientes de priorización y sin fechas comprometidas. El rediseño no agrega estos módulos.

## Git Operations

None.

STOP. Waiting for Product / Architecture Review.
