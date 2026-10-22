# Mapa del colegio · Etapa A

Actualización del 21 de octubre: la selección individual de los bloques y los reportes desde edificios están implementados. Ver `docs/INDEPENDENT-CAMPUS-BLOCKS.md` para la entrega vigente, compatibilidad de los espacios anteriores y comprobaciones. La información de Etapa A que sigue es histórica.

Actualización del 19 de octubre: una solicitud posterior autoriza crear y seleccionar espacios internos por edificio, además de optimizar el aplicativo y las fotos. Esa implementación está documentada en `docs/CAMPUS-SPACES-AND-PERFORMANCE.md`. El resto de esta nota conserva el registro histórico de la Etapa A.

## Alcance aprobado

El usuario aprobó convertir la quinta entrega visual en un prototipo interactivo dentro del gestor y **detenerse para revisión al terminar la Etapa A**. Se conserva el escenario aprobado y la cámara ortográfica. Esta etapa comprende render, regiones de interacción obtenidas de Blender, zoom, arrastre, hover, selección y panel con datos ficticios identificados de forma visible.

No comprende consultas del mapa a espacios o incidencias reales, asociaciones persistidas, navegación del mapa a formularios o casos reales, nuevas tablas, migraciones, cambios de endpoints ni despliegue. Los estados de ejemplo utilizan únicamente `PENDING`, `ASSIGNED` y `CLOSED`. La autenticación existente puede seguir consultando la sesión: es distinta de una integración de datos del mapa.

## Recursos existentes inspeccionados

- Fuentes de escena: `build_scene.py`, `refine_scene.py`, `campus_geometry.py`, `corrected_zones.py` y `layout.json` en esta carpeta.
- Escena nativa: `output/arrayanes-campus.blend`.
- Render principal aprobado: `output/overview.png`, 3200 × 2200, iteración 5 según `output/render-manifest.json`.
- Manifiestos y comprobaciones conservadas: `render-manifest.json`, `delivery-verification.json`, `camera-comparison.json`, `camera-validation.json`, `scene-validation.json` y `geometry-review.json` en `output/`.
- El registro de la quinta entrega informa cámara general idéntica a la original, seis renders y apertura del archivo nativo. Es evidencia de la entrega visual previa, **no una prueba de interacción de React**.

La exportación de máscaras debe abrir la escena guardada, utilizar su cámara general y la resolución del render original, y resolver la visibilidad con la geometría de la escena. No debe cambiar la arquitectura ni modificar el generador aprobado para dibujar regiones a mano. El navegador recibe imágenes optimizadas y trazados SVG, no el `.blend`.

## Arquitectura del aplicativo

Inspección de los archivos reales del repositorio:

| Área | Ubicación y comportamiento |
| --- | --- |
| Entrada | `frontend/src/main.jsx`: `BrowserRouter`, `AuthProvider` y `ErrorBoundary` global. |
| Rutas | `frontend/src/App.jsx`: rutas hijas de `Protected`, que permite `ADMIN` y `SUPER_ADMIN`. Administradores tiene una restricción adicional de superadministrador. |
| Navegación | `frontend/src/components/AppLayout.jsx`: las listas `operation` y `management` alimentan el mismo menú en escritorio y móvil; el nombre de sección se deriva de ellas. |
| Sesión | `frontend/src/context/AuthContext.jsx`: `GET /auth/me`, inicio/cierre de sesión y suscripción a errores 401 del cliente HTTP. |
| HTTP | `frontend/src/api.js`: base `VITE_API_URL` o `/api`, cookies y token opcional en `sessionStorage`, cancelación mediante señales, mensajes de error y manejo de 401. |
| Roles | `frontend/src/utils/roles.js` y `backend/src/utils/roles.js`: administración y superadministración; el segundo hereda acceso administrativo. |
| Estilos | `frontend/src/maintenance-theme.css`, `editorial-theme.css` y hojas por módulo. Conviene aislar el mapa con clases `campus-*`. |
| Desarrollo | `frontend/vite.config.js`: proxy local de `/api` a `http://localhost:4000`; pruebas Vitest con entorno Node. |

Cambios mínimos de entrada: importar el módulo del mapa mediante `lazy`, envolver su ruta en `Suspense`, agregar `/mapa` dentro de `Protected` y agregar su nombre a `pageNames` para título/foco. Incorporar “Mapa del colegio” a la lista de navegación reutiliza el menú, su comportamiento móvil y la sección del encabezado sin duplicarlos. El mapa no requiere permisos nuevos.

Las páginas y lógica existentes de espacios, incidencias, personal, reportes y autenticación deben mantenerse. No es necesario modificar sus componentes para la Etapa A.

## Contratos existentes para una futura Etapa B

Esta sección documenta lectura del código; **no autoriza ejecutar estas operaciones ni conectarlas durante A**.

| Contrato | Forma real observada |
| --- | --- |
| `GET /api/spaces` | Devuelve `{ spaces }`; acepta `active=true` o `active=false`. Ordena por zona y nombre. Cada registro incluye `id`, `name`, `zone`, `active` y, cuando existe, una URL autenticada de imagen. |
| `GET /api/incidents` | Devuelve `{ incidents }`; acepta `status`, `priority`, `assigned_person_id`, `space_id`, `date_from`, `date_to`, `search` y `order`. No expone paginación. Incluye datos conservados de ubicación/responsable y una evidencia inicial cuando existe. |
| `GET /api/incidents/:id` | Devuelve `{ incident, evidences, history }`. |
| Estados | `backend/src/utils/maintenance.js`: `PENDING`, `ASSIGNED`, `CLOSED`. Abiertas = pendientes + asignadas. |
| Acceso | Rutas montadas bajo `authenticate` y `requireRole('ADMIN')`; `SUPER_ADMIN` también cumple este permiso. |

Fuentes: `backend/src/routes/spaces.js`, `routes/incidents.js`, `services/incident-service.js`, `app.js` y middleware de autenticación. Los módulos React existentes consultan catálogos en paralelo y manejan cancelación; ese patrón puede reutilizarse después de la aprobación de B.

No hay un identificador de región del mapa en `maintenance_spaces` ni una tabla de asociaciones en las migraciones inspeccionadas. El esquema actual de espacios utiliza nombre/zona, y las incidencias apuntan a `space_id`. Para B debe presentarse una propuesta explícita `regionId -> spaceIds[]`, manteniendo agrupados los cuatro bloques y sin deducir vínculos silenciosos por parecido de nombres. Una configuración revisable podría bastar antes de considerar una migración. A no necesita ninguna de esas asociaciones.

En B sería posible consultar una vez el catálogo de espacios y una vez el listado de incidencias y agrupar en memoria para evitar una solicitud por edificio. El volumen de datos y la ausencia de paginación deben revisarse cuando se autorice esa fase.

## Dependencias comprobadas por lectura

- `react-zoom-pan-pinch` resuelve en el `node_modules` del workspace como versión **4.2.0**; declara compatibilidad peer con React y ReactDOM mediante `*`. La resolución no sustituye la prueba de compilación y de interacción.
- `sharp`, `pngjs`, `playwright`, `@playwright/test` y `jsdom` no resolvían mediante `require.resolve` durante esta auditoría.
- El Python 3.11 incluido en Blender tiene `numpy` disponible y **no tiene Pillow (`PIL`)** según `importlib.util.find_spec`.
- Las pruebas actuales utilizan Vitest, `react-dom/server` y lógica pura en Node; no necesitan instalar un entorno DOM para ampliarlas.

La implementación añade únicamente `react-zoom-pan-pinch@4.2.0`. No instala otro motor 3D, herramientas de navegador ni paquetes de imagen.

## Recursos interactivos derivados y reproducción

La implementación leída utiliza `frontend/src/pages/CampusMapPage.jsx`, `campus-map.css` y `campus-map-demo.js`. `/mapa` ya se registra mediante carga diferida en `App.jsx` y aparece en la lista existente de `AppLayout.jsx`. El módulo consulta únicamente `regions.json` y las imágenes del campus; no importa el cliente HTTP ni consulta `/spaces` o `/incidents`. El panel tiene identificadores `DEMO-*` y avisos de demostración visibles. Las zonas sin ejemplos muestran un estado vacío.

Los originales `output/overview.png` y `output/arrayanes-campus.blend` se conservan. La generación adicional se divide en dos pasos:

1. `interactive/export_ids.py` abre la escena nativa y no la vuelve a guardar. Verifica la cámara ortográfica frente a `output/camera-validation.json`, clasifica los objetos por identificador semántico y renderiza `interactive/output/semantic-ids.png` a 3200 × 2200. La escena completa participa en la profundidad: un objeto no seleccionable también oculta superficies posteriores. `mask-source.json` conserva cámara, asignaciones y hashes de origen.
2. `interactive/build_assets.py` convierte ese raster de IDs en contornos SVG, conserva islas y huecos con `fill-rule="evenodd"`, simplifica con tolerancia de 0,5 píxeles y descarta contornos menores de 3 píxeles cuadrados. Escribe `frontend/public/campus-map/regions.json` y las tres versiones WebP. También genera `interactive/output/regions.svg`, `mask-overlay.jpg`, `semantic-labels.npy` y `asset-validation.json` para revisión.

**Convención del vidrio:** en el pase semántico, el material de vidrio se sustituye por una superficie opaca de identificación. La cubierta acristalada frontal pertenece al edificio y se puede seleccionar; no se selecciona otro objeto a través de ella. Esta convención solo afecta a las máscaras. El render aprobado conserva sus transparencias y materiales originales.

Para regenerar únicamente los derivados, desde la raíz del repositorio en PowerShell:

```powershell
$blenderExe = 'C:\Users\ADMIN\AppData\Local\Programs\BlenderPortable\blender-4.5.9-windows-x64\blender.exe'
$assetPython = 'C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
& $blenderExe --background --factory-startup --python-exit-code 1 --python prototypes/campus-map/interactive/export_ids.py
& $assetPython prototypes/campus-map/interactive/build_assets.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python prototypes/campus-map/interactive/validate_rays.py
```

Después de guardar las capturas de revisión, `& $assetPython prototypes/campus-map/interactive/verify_delivery.py` comprueba los cinco generadores/parámetros frente al manifiesto aprobado, los originales, las imágenes derivadas y los informes geométricos. Escribe `interactive/output/delivery-verification.json` sin editar las fuentes.

El segundo paso utiliza el Python ya incluido en el runtime local de Codex: se comprobaron **Pillow 12.3.0 y numpy 2.3.5**, sin instalar paquetes. Ese runtime es distinto del Python de Blender, que no tiene Pillow. En otro equipo se debe proporcionar un Python con Pillow y numpy disponibles; no ejecutar el segundo paso con el Python de Blender sin prepararlo.

| Recurso servido al navegador | Dimensiones | Bytes |
| --- | --- | ---: |
| `campus-1600.webp` | 1600 × 1100 | 151304 |
| `campus-2400.webp` | 2400 × 1650 | 281474 |
| `campus-3200.webp` | 3200 × 2200 | 423074 |
| `regions.json` | Coordenadas base 3200 × 2200 | 138558 |

Las variantes usan WebP a calidad 88; `<picture>` y `srcSet` permiten seleccionar resolución. El SVG y la imagen comparten el contenedor transformado y el `viewBox` 3200 × 2200. La escala de interacción es de 1 a 3,8. No se carga ningún modelo 3D en React.

`regions.json` declara `width`, `height`, `sourceIteration`, `coordinateSystem`, `sourceRenderSha256`, `sourceBlendSha256` y `regions`. Cada región contiene `id`, `label`, `kind`, `sourceRegions`, `path`, `bounds` y `center`. Los identificadores corresponden al escenario, **no a claves de la base de datos**:

| ID estable | Región/es de referencia |
| --- | --- |
| `administrativo` | `4:37` |
| `bloques-salones` | `4:15`, `4:17`, `4:19`, `4:21`, `4:23`; incluye el bloque atravesado |
| `preescolar` | `4:33` |
| `bachillerato` | `4:25` |
| `transicion` | `4:27` |
| `grado-11` | `4:45` |
| `comedor` | `4:13` |
| `economato` | `4:41` |
| `primeros-auxilios` | `4:29` |
| `danzas-1` | `4:55` |
| `danzas-2` | `4:69` |
| `tienda-1` | `4:35` |
| `gym` | `4:47`; exterior |
| `futbol-principal` | `4:9`; exterior |
| `futbol-norte` | `4:43`; exterior |
| `patio-central` | `4:6`; exterior |

La comprobación por lectura y hash efectuada en esta auditoría encontró 16 regiones y confirmó que los WebP coinciden con `asset-validation.json`, y que los hashes de `.blend` y PNG aprobados siguen siendo los de origen. El informe del vectorizador registra un IoU mínimo de **0,99944** al comparar los contornos con su raster semántico. Esta cifra mide la vectorización; no sustituye la revisión visual de alineación y oclusión en el navegador.

## Revisión local autenticada sin producción

El backend ya dispone de `createMemoryPool()` en `backend/src/db.js`, que crea una base `pg-mem` con las migraciones del repositorio. Las pruebas existentes usan `createApp(pool)` y una semilla local. No hace falta conectarse a PostgreSQL/Supabase para comprobar la ruta protegida y la navegación.

Para una sesión de revisión manual se recomienda un launcher **exclusivamente local y temporal** que:

1. Cree explícitamente `createMemoryPool()` y la aplicación con `createApp(pool)`, sin llamar a `getPool()` ni a los scripts de migración.
2. Fije configuración de prueba antes de sembrar: entorno no productivo, origen local exacto de Vite y JWT efímero; vacíe configuración de Supabase, base remota, cuenta principal del entorno y keep-alive. Use un directorio temporal para cualquier carga local.
3. Siembre únicamente la memoria; use cuentas de demostración o credenciales efímeras locales, sin imprimir tokens ni secretos del entorno.
4. Escuche solo en `127.0.0.1` y cierre el pool al detenerse. Configure el proxy de Vite hacia ese servidor local aislado.
5. Use un origen local consistente (`localhost` o `127.0.0.1`) y haga que coincida con `config.frontendUrl`, porque existe validación de origen para operaciones mutables.

No debe arrancarse a ciegas el servidor habitual con el `.env` actual: `config.js` lo carga automáticamente, y `server.js` obtiene el pool por configuración e inicia keep-alive. Las pruebas también admiten `TEST_POSTGRES_URL`; para pruebas de esta entrega debe estar ausente, de forma que los fixtures permanezcan en memoria. No se documentan aquí contraseñas reales.

El visor anterior `preview-server.mjs` sirve solo la galería visual en `127.0.0.1:5186`; no es el gestor ni prueba la nueva ruta protegida.

Los launchers aislados están implementados en `interactive/qa-server.mjs` y `interactive/vite.qa.config.mjs`. Desde la raíz, en dos terminales:

```powershell
# Terminal 1: API exclusivamente local, memoria nueva en cada ejecución.
node prototypes/campus-map/interactive/qa-server.mjs

# Terminal 2: Vite sin cargar .env y con API fijada al proxy local.
node node_modules/vite/bin/vite.js --config prototypes/campus-map/interactive/vite.qa.config.mjs
```

Abrir `http://127.0.0.1:5175/login`, iniciar sesión con las cuentas de demostración documentadas en el launcher y entrar en **Mapa del colegio**. El API escucha solo en `127.0.0.1:4011`. Vite usa `strictPort`, desactiva lectura de archivos `.env` y fija `/api` para impedir que una variable heredada dirija la revisión al API remoto. El launcher anula las configuraciones remotas antes de importar el backend y utiliza un JWT aleatorio por proceso.

Detener ambos con Ctrl+C. El backend descarta el pool de memoria y retira su carpeta `interactive/output/qa/session-*` después de comprobar su ubicación real. En modo de prueba las cargas usan la memoria de `storage.js`; no se usa la carpeta de cargas del aplicativo ni Supabase. Un cierre forzado puede dejar una carpeta QA temporal vacía para revisión, sin información de producción. No se ejecutan comandos de migración sobre un servidor externo.

## Validación que corresponde a esta entrega

- Ejecutar `npm run build -w frontend`.
- Ejecutar las nuevas pruebas del módulo y la suite existente de frontend; revisar especialmente `api.test.js`, filtros/listados de incidencias, Dashboard y componentes de personal/evidencias para detectar regresiones de importación.
- Las pruebas de lógica del mapa deben cubrir identificadores/coordenadas de regiones, agrupaciones de ejemplo, estados reales, zonas vacías y supresión del clic después de arrastrar, incluso si el puntero vuelve al origen.
- Verificar en navegador local autenticado: rueda, botones, límites, arrastre, restablecer, hover, selección por mapa/lista, selección de edificios parcialmente ocultos y ausencia de selección accidental al desplazar.
- Inspeccionar escritorio y móvil, recuperación ante fallo de imagen/geometría y que el render y SVG compartan coordenadas. Las regiones deben omitir superficies ocultas por otros edificios.
- Confirmar que el módulo no solicita espacios/incidencias y que los datos ficticios se reconocen tanto antes como después de seleccionar.
- Comprobar las rutas actuales mediante la sesión de prueba y confirmar que no hay cambios de backend/modelos/migraciones ni despliegue.

## Resultados de entrega · 16 de octubre de 2026

La Etapa A está implementada en `frontend/src/pages/CampusMapPage.jsx`, `campus-map.css` y `campus-map-demo.js`, con cuatro pruebas en `CampusMapPage.test.jsx`. Los cambios en módulos existentes se limitan a registrar la ruta protegida y su título en `App.jsx`, añadirla al menú compartido en `AppLayout.jsx` e instalar `react-zoom-pan-pinch@4.2.0` en el frontend. No se cambió backend, modelos, migraciones ni datos de producción. La rama continúa siendo `feature/mapa-isometrico`; no hay despliegue ni cambios en `main`.

Comprobaciones realizadas:

- Build del frontend: **PASS**. El módulo queda en un chunk diferido, aproximadamente 20,6 kB de JavaScript y 4,87 kB de CSS comprimidos.
- Lint de frontend y backend: **PASS**.
- Pruebas nuevas del mapa: **4/4 PASS**. Cubren arrastre con retorno al origen, supresión temporal del clic, estados y zonas vacías, validación de coordenadas/IDs y marcado accesible del prototipo sin enlaces a registros reales.
- Vectorización: 16 regiones, IoU mínimo **0,99944**, error máximo de simplificación de 0,5 píxeles del render original. Los contornos conservan huecos e islas; el hit testing usa el relleno, sin ampliar la selección por el trazo del borde.
- Validación independiente en Blender: **2.760 rayos, cero discrepancias** contra 99.366 triángulos de 5.427 objetos evaluados, incluidas curvas y tipografía. Se muestrearon 160 puntos interiores por región y 200 puntos no seleccionables próximos a sus siluetas. `interactive/validate_rays.py` genera `interactive/output/raycast-validation.json`; excluye dos píxeles de margen para evitar bordes de antialias.
- Navegador local autenticado: vista de escritorio a 1440 × 1000, tablet a 768 × 1024 y móvil a 390 × 844. Sin desbordamiento horizontal. Se corrigió el doble centrado del canvas móvil; el render completo cabe en su vista inicial. Las capturas son `interactive/output/qa-desktop-map.jpg` y `qa-mobile-map.jpg`.
- Zoom por botones y rueda, límites 100–380 %, arrastre, restablecer, hover, selección y vista de todas las regiones: comprobados. Un arrastre sobre Preescolar conservó la selección anterior. El ancho de `sizes` aumenta con el zoom y la variante de 3200 px se carga al acercarse al máximo.
- Oclusiones en navegador: un árbol sobre la cancha no selecciona la cancha oculta; Administrativo recibe el clic delante de Economato; Comedor y Economato se seleccionan desde sus superficies visibles. Imagen y SVG conservaron límites coincidentes después de contraer el menú.
- Teclado: selección de regiones con Enter/Espacio, búsqueda y selección desde directorio, pestañas de historial y foco del encabezado al abrir «Ver ficha». Se comprobó una zona sin ejemplos, historial cerrado y expansión de una ficha simulada.
- Fallos de carga: se retiraron temporalmente, y luego se restauraron, el JSON y los tres WebP. Ambos fallos mostraron un mensaje legible y se recuperaron con «Reintentar». Los cuatro recursos finales fueron restaurados.
- Rutas existentes comprobadas, sin enviar formularios: Dashboard, Espacios, Personal, listado y detalle de incidencias, y Nueva incidencia. La visita inicial a `/mapa` sin sesión redirigió al login.
- Consola de la revisión final: sin errores ni advertencias. No se abrieron conexiones del mapa a espacios/incidencias; sus únicas cargas son los recursos locales estáticos.

La prueba móvil es una revisión responsive en navegador, **no una prueba física multitáctil**. El pellizco está soportado por la librería y su callback invalida la selección accidental; queda pendiente confirmarlo en un teléfono real durante la revisión del usuario.

La suite general **no está completamente verde**: frontend 125/127 y backend 58/61. Las cinco fallas están en archivos preexistentes que no fueron modificados: dos expectativas de etiquetas antiguas (`Pendiente`/`Pendiente de asignación` frente a `Sin asignar`/`Sin responsable`), dos expectativas del encabezado de WhatsApp y una expectativa de cookie `SameSite=Lax` frente a la configuración actual `None`. El lockfile solo añade la nueva librería del mapa; no cambia versiones anteriores. La ejecución inicial aislada del frontend tuvo además errores de archivos temporales de Vitest; al repetir fuera del aislamiento desaparecieron y quedaron únicamente las dos expectativas descritas. No se alteraron esos módulos para esta entrega.

**Punto de parada:** revisión visual y funcional del usuario. La Etapa B, las asociaciones a espacios y los datos reales requieren una nueva aprobación.
