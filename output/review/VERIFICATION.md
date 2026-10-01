# Verificación de Gestor Mantenimiento V1

Fecha: 1 de octubre de 2026. Entorno local de desarrollo y pruebas aisladas.

## Controles ejecutados

| Control | Resultado |
| --- | --- |
| `npm run lint` | Correcto, incluida la revisión final de login y CSS. |
| `npm test` | 108 pruebas correctas tras la revisión de producto: 55 backend y 53 frontend. |
| Backend con PostgreSQL 16 local desechable, validación inicial | 51 correctas: 29 de integración sobre PostgreSQL real y 22 de utilidades/migraciones históricas. |
| `npm run build` | Correcto tras los ajustes: Vite compila 1833 módulos; JS 311,77 kB, 94,27 kB gzip. |
| `npm audit --omit=dev` | 0 vulnerabilidades. |
| Typecheck | No aplica: el proyecto utiliza JavaScript, sin configuración TypeScript. |

Las suites PostgreSQL aplicaron 001, 002 y 003 en esquemas aleatorios independientes. Los esquemas y el contenedor de prueba se retiraron. No se conectó ni modificó una base productiva o externa. Las migraciones históricas permanecen intactas.

## Flujo de aceptación

La prueba automatizada crea `MT-2026-001` en una base vacía, con Baño Bloque A, Plomería, prioridad Alta, descripción «Fuga debajo del lavamanos» y fotografía inicial. Verifica `PENDING`, asignación a Carlos Rodríguez, `ASSIGNED`, teléfono y texto codificado de WhatsApp, notas «Se reemplazó la llave y se ajustó la tubería.», fotografía final, confirmación, `CLOSED`, historial y métricas.

En la validación inicial de navegador se ejecutó el mismo recorrido operativo. El entorno demo ya contenía dos incidencias, por lo que el registro de revisión recibió `MT-2026-003`. Se comprobaron asignación posterior y durante la creación, validación de cierre sin fotografía, confirmación explícita, archivos inicial/final, historial y ausencia de acciones de edición/cierre sobre el registro cerrado. El dashboard reflejó un cierre. Tras la revisión de producto, el promedio muestra «—» sin datos válidos, «< 1 h» por debajo de una hora y horas con hasta una décima para los demás valores; el API conserva la precisión del promedio.

La acción WhatsApp prepara un enlace `https://wa.me/573002223344?text=…`. Se verificaron destino, nombre, código, ubicación, descripción, prioridad y conservación de caracteres Unicode en la respuesta del servidor. Se abrió WhatsApp para comprobar el lanzamiento; no se envió ningún mensaje ni se atribuyó un estado de entrega.

## Integridad y autorización

Las pruebas cubren asignación activa, desactivación de catálogos con datos históricos conservados, relaciones e identificadores inválidos, rechazo de acceso anónimo o de roles no administrativos, restricciones SUPER_ADMIN, revocación de acceso cuando cambia el usuario en DB, origen de mutaciones, límites concurrentes de login, cierre duplicado/concurrente, evidencia final obligatoria y reversión de operaciones cuando falla una carga.

La descarga de evidencia se comprobó mediante respuesta autenticada y bytes del archivo, además de la acción de descarga en la interfaz. Los archivos privados no se exponen como directorio público.

## Revisión visual

Se inspeccionaron login, dashboard, formulario de creación, lista, detalle, personal, espacios y cierre en 1440, 768 y 375 píxeles. También se revisaron administradores en escritorio y móvil, navegación móvil, foco de diálogos y menú contraído a 1680 píxeles. La lista usa tarjetas cuando corresponde; formularios y diálogos se adaptan. Se corrigieron el fondo del menú móvil, textos de filtros, espacio del mensaje de bienvenida y ancho del menú contraído. Las vistas comprobadas no presentan desbordamiento horizontal.

Una pestaña nueva del dashboard final no registra advertencias ni errores de consola. Se restauró el tamaño normal del navegador tras las pruebas.

Tras la revisión de producto se verificaron el botón único de la cabecera, las siete columnas con Responsable en escritorio y las tarjetas con responsable en tablet/móvil. Sin incidencias cerradas, el dashboard muestra «—». Las pruebas nuevas cubren el promedio de 0,96 h, la frontera de 1 h y datos inválidos. El login utiliza la nueva imagen aportada, con el escudo GLAB visible y sin desbordamiento en los tres tamaños. Al recargar el API de demostración se conservaron las tres incidencias existentes, sus fechas, cinco eventos y la evidencia privada, comparando los datos y los bytes con el respaldo temporal.

Capturas locales:

- [Dashboard de escritorio](dashboard-desktop.jpg)
- [Dashboard móvil](dashboard-mobile.jpg)
- [Dashboard de tablet](dashboard-tablet.jpg)
- [Incidencia cerrada](incident-closed-desktop.jpg)
- [Login de escritorio](login-desktop.jpg)
- [Login de tablet](login-tablet.jpg)
- [Login móvil](login-mobile.jpg)

## Límites reales y despliegue

El despliegue productivo no se ha realizado. Antes de usar datos reales deben validarse HTTPS, la conexión PostgreSQL definitiva y el bucket privado o disco persistente elegidos. Supabase requiere configuración efectiva de bucket privado. La limpieza de archivos tras un error es compensatoria y puede requerir seguimiento si el proveedor está indisponible. El límite de login reside en cada proceso API; un despliegue con varias réplicas necesita control compartido o en el proxy.

La vista de revisión usa una base en memoria con datos demo; sus cambios desaparecen al detener el servidor. La imagen actual del login es la suministrada por el usuario en `frontend/dist/campus-maintenance.png`; se copió sin alterar su contenido a `frontend/public/campus-maintenance.png` para conservarla en las siguientes compilaciones.

## Roadmap de producto — futuro, no implementado

Inventario, mantenimiento preventivo, órdenes de trabajo, costos, proveedores, WhatsApp automático, reportes y calendario de mantenimiento. Estos candidatos se mantienen en `PROJECT_BACKLOG.md`, pendientes de priorización y sin fechas comprometidas.

## Git Operations

None.

STOP. Waiting for Product / Architecture Review.
