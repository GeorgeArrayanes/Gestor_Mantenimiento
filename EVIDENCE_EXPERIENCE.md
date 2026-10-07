# Evidencias visuales y tarjetas de incidencias

Implementación y revisión de navegador: 2 de octubre de 2026. Cierre documental y compilación final: 7 de octubre de 2026.

Se conserva la base visual aprobada: superficies claras, verde petróleo, menta, radios moderados y jerarquía compacta. El alcance se limita a las evidencias y a la composición de las tarjetas de Incidencias.

## Evidence Experience

Las imágenes JPEG, PNG y WEBP aparecen directamente en una galería reutilizable. Una fotografía ocupa el ancho disponible; varias usan una cuadrícula de una, dos o tres columnas según el espacio del contenedor. Las miniaturas mantienen sus proporciones mediante recorte, y el visor muestra la imagen completa sin distorsión.

Cada fotografía permite ampliar, abrir y descargar. El visor reutiliza el modal existente, muestra nombre y contador, incluye anterior/siguiente y permite navegar con las flechas del teclado. Escape cierra el visor, el foco queda dentro mientras está abierto y vuelve a la miniatura al cerrar.

Los PDF se presentan como tarjetas de documento con nombre, tipo, tamaño y acciones Abrir/Descargar. No se intentan representar como imágenes. Los nombres y tamaños de las fotografías tienen un peso secundario frente a la evidencia visual.

Los estados vacíos distinguen evidencia inicial y de solución. La carga muestra un marcador discreto; una respuesta inválida o una imagen que no se puede decodificar muestra «Vista previa no disponible», conservando las acciones de archivo y evitando el icono de imagen rota.

Una incidencia CLOSED con imágenes INITIAL y FINAL muestra Antes/Después. Se conservan todos los archivos de cada etapa, incluidos los documentos; no se limita la comparación a una fotografía por lado. En móvil, las etapas se apilan. La evidencia no se duplica en el bloque de notas de solución.

## Incident Cards

Las tarjetas muestran código y fecha, evidencia o símbolo de categoría, estado y prioridad, descripción real como título, categoría, ubicación, responsable y acciones. La descripción ocupa hasta dos líneas en la tarjeta y permanece completa en el detalle. Los responsables usan iniciales o un símbolo neutro, sin retratos añadidos.

La miniatura corresponde a la primera imagen INITIAL, ordenada por fecha y por identificador cuando hay empate. Se excluyen PDF e imágenes FINAL. Si no hay fotografía se muestra un símbolo del sistema de iconos existente, con un fondo tenue asociado a la categoría. No se generaron ni descargaron fotografías de mantenimiento.

Las tarjetas permiten navegar al detalle mediante enlaces; llamada y preparación de WhatsApp son acciones independientes. La preparación conserva el endpoint existente y el envío sigue siendo manual. La variante compacta del Dashboard conserva su composición aprobada y no carga fotografías nuevas.

Se mantienen búsqueda, estado, prioridad, responsable, espacio y limpieza de filtros. Los indicadores se calculan con las incidencias cargadas y muestran únicamente Pendientes, Asignadas y Cerradas. El acceso Nueva incidencia conserva su ruta y ubicación en la barra superior.

## Security

La evidencia sigue siendo privada. La vista previa realiza una petición autenticada al endpoint existente, obtiene un Blob y crea una URL temporal del navegador. Nunca se asigna una ruta privada de almacenamiento al atributo de la imagen ni se publica el archivo para mostrarlo.

El cliente acepta únicamente rutas de descarga de evidencia con identificador positivo dentro de la API configurada, rechaza redirecciones y comprueba que el Blob tenga contenido y un MIME permitido. La vista previa acepta solo JPEG, PNG y WEBP; las acciones de archivo también aceptan PDF. Se conservan cookies, respaldo Bearer y tratamiento existente de sesión expirada.

Las peticiones se cancelan al desmontar los componentes. Las URL temporales de vista previa se revocan al cambiar de archivo o desmontar; los fallos de decodificación también las liberan. Las acciones de abrir y descargar tienen su propia revocación. La carga comienza cerca del área visible y mantiene `loading="lazy"` en las miniaturas.

Las pruebas HTTP confirmaron rechazo 401 sin sesión y descarga autorizada de los bytes originales con `Cache-Control: private, no-store`. El endpoint mantiene el control ADMIN existente y `X-Content-Type-Options: nosniff`. No se modificaron las reglas de autorización, validación de cargas ni proveedores de almacenamiento.

## Backend Changes

El único cambio de comportamiento del backend es la metadata opcional `initial_evidence` en `GET /api/incidents`. Una consulta conjunta recupera la primera imagen INITIAL de cada incidencia devuelta. Expone solo identificador, nombre, MIME, tamaño, categoría y la ruta de descarga autenticada; devuelve `null` cuando no existe una imagen inicial.

No se cambió el endpoint que sirve los archivos. No se cambiaron creación, asignación, cierre, historial, autenticación ni almacenamiento.

Para conservar los datos de la instancia principal en memoria, no se reinició su proceso. Si una lista procede de un proceso anterior sin `initial_evidence`, el frontend obtiene la metadata del detalle solo para tarjetas visibles. Con la respuesta nueva utiliza la metadata de la lista y evita esas peticiones adicionales. Esta compatibilidad no realiza escrituras.

## Database

**None.** No se modificó el esquema, no se añadieron columnas ni tablas y no se crearon o ejecutaron migraciones para este trabajo.

Se conserva el ciclo PENDING → ASSIGNED → CLOSED y el requisito de evidencia final y confirmación para cerrar. Los cuatro registros de la instancia principal existentes durante la revisión se conservaron. Las mutaciones de comprobación se hicieron exclusivamente en una base aislada en memoria con almacenamiento también en memoria.

## Components

| Componente o archivo | Cambio |
| --- | --- |
| `frontend/src/components/EvidenceImage.jsx` | Carga privada, carga diferida, Blob, estados y limpieza. |
| `frontend/src/components/EvidenceGallery.jsx` | Galería de fotografías, documentos, acciones y visor accesible. |
| `frontend/src/components/evidence-gallery.css` | Composición adaptable, visor y estados visuales. |
| `frontend/src/pages/IncidentDetailPage.jsx` | Galerías por etapa y comparación Antes/Después. |
| `frontend/src/pages/detail-evidence.css` | Composición de la comparación. |
| `frontend/src/components/IncidentCard.jsx` | Jerarquía compacta, miniatura real y acciones separadas. |
| `frontend/src/components/incident-cards.css` | Proporciones y cuadrícula adaptable de tarjetas. |
| `frontend/src/components/useIncidentThumbnail.js` | Selección de imagen y compatibilidad de lectura con la instancia anterior. |
| `frontend/src/pages/IncidentsPage.jsx` | Texto de apoyo y composición del listado con filtros existentes. |
| `frontend/src/api.js` | Obtención autenticada de Blob y apertura/descarga con formatos y rutas limitados. |
| `backend/src/routes/incidents.js` | Metadata segura de la primera imagen inicial en el listado. |

Se reutiliza `Modal` sin añadir una biblioteca de galería. Se retiraron estilos obsoletos de la antigua lista de archivos en `maintenance-pages.css` y `editorial-theme.css`. No se añadieron dependencias.

## Browser Verification

Se verificó la aplicación principal en ejecución y una segunda instancia del mismo código, con datos temporales aislados, para cubrir los casos que faltaban sin modificar los registros del usuario.

En la instancia principal se comprobó que las cuatro incidencias seguían presentes, que la imagen realmente adjuntada a una incidencia aparecía en su tarjeta y que el detalle mostraba esa misma evidencia mediante una URL Blob privada. El frontend funcionó con el proceso anterior del backend mediante la compatibilidad de metadata. No se crearon, asignaron, editaron ni cerraron incidencias en esa instancia durante esta comprobación.

En la instancia aislada se comprobó:

- Incidencia con dos imágenes iniciales y PDF: miniatura real en la lista, fotografías visibles en el detalle y PDF como documento.
- Incidencia sin imágenes: símbolo contextual en la tarjeta y mensaje vacío en el detalle.
- Incidencia cerrada con imágenes iniciales y finales: comparación Antes/Después con todos los archivos conservados.
- Imagen no decodificable: mensaje controlado y ausencia de una imagen rota.
- Visor: apertura, imagen completa, contador, anterior/siguiente, flechas, Escape, retorno de foco y recorrido circular con Tab/Shift+Tab.
- Búsqueda sin coincidencias: cero resultados; limpiar restauró las tres incidencias de prueba. El filtro de cerradas mostró una.
- Acciones de abrir y descargar PDF invocadas desde sus controles. La apertura produjo una pestaña con URL Blob; las limitaciones de inspección se indican abajo.

| Ancho verificado | Tarjetas | Galería | Antes/Después | Resultado |
| --- | --- | --- | --- | --- |
| 1440 px | 3 columnas | 2 en el detalle probado | 2 etapas en paralelo | Sin desbordamiento horizontal. |
| 768 px | 2 columnas | 2 en el detalle probado | 2 etapas en paralelo | Sin desbordamiento horizontal. |
| 375 px | 1 columna | 1 columna | Etapas apiladas | Sin desbordamiento; visor y filtros utilizables. |
| 1600 px | 4 columnas | No se repitió este caso | No se repitió este caso | Cuadrícula de tarjetas sin desbordamiento. |

Se comprobó la carga diferida al desplazar la galería móvil. La consola de las instancias revisadas no registró errores ni advertencias al terminar los recorridos. Estado y prioridad incluyen texto, los botones tienen nombres accesibles y el foco es visible.

Capturas de la instancia principal, con sus datos existentes:

- [Incidencias](output/review/evidence-actual-incidents-desktop.jpg).
- [Detalle con evidencia real adjuntada](output/review/evidence-actual-detail-desktop.jpg).

Capturas de comprobación aislada; las imágenes del campus son archivos de prueba para revisar la composición, no evidencia de una reparación real:

| Vista | Escritorio | Tableta | Móvil |
| --- | --- | --- | --- |
| Tarjetas | [1440 px](output/review/evidence-cards-desktop.jpg) | [768 px](output/review/evidence-cards-tablet.jpg) | [375 px](output/review/evidence-cards-mobile.jpg) |
| Galería y PDF | [1440 px](output/review/evidence-gallery-desktop.jpg) | [768 px](output/review/evidence-gallery-tablet.jpg) | [375 px](output/review/evidence-gallery-mobile.jpg) |
| Antes/Después | [1440 px](output/review/evidence-before-after-desktop.jpg) | [768 px](output/review/evidence-before-after-tablet.jpg) | [375 px](output/review/evidence-before-after-mobile.jpg) |
| Visor | [1440 px](output/review/evidence-viewer-desktop.jpg) | [768 px](output/review/evidence-viewer-tablet.jpg) | [375 px](output/review/evidence-viewer-mobile.jpg) |

Adicionales: [tarjetas a 1600 px](output/review/evidence-cards-large.jpg) y [detalle sin evidencia en móvil](output/review/evidence-no-image-mobile.jpg).

Las dos instancias temporales de comprobación, en puertos 4100 y 5174, quedaron detenidas. Se eliminaron el servidor de pruebas, el PDF temporal, la imagen deliberadamente no decodificable y la configuración temporal de Vite. No se escribieron fixtures en la base o el almacenamiento principal. Se conservaron las capturas y la aplicación principal en 4000/5173.

## Regression Verification

Recorrido real de navegador, realizado en la instancia aislada:

1. Inicio de sesión.
2. Creación y guardado de una incidencia sin responsable, con evidencia inicial; quedó PENDING.
3. Asignación de personal; quedó ASSIGNED y se conservó el historial.
4. Preparación de WhatsApp desde la tarjeta y apertura del destino con los datos de la incidencia. No se envió ningún mensaje.
5. Registro de solución: se comprobó el rechazo cuando faltaba evidencia final.
6. Carga de imagen final, revisión de solución, confirmación y cierre; quedó CLOSED.
7. Recarga y consulta del registro guardado, notas, evidencia y eventos. «Reabrir/ver» se comprobó como volver a consultar el detalle guardado; no se añadió una transición desde CLOSED.
8. Búsqueda, filtro de estado, limpieza de filtros y cierre de sesión.

Los filtros de prioridad, responsable y espacio, los permisos y las reglas operativas existentes también están cubiertos por las pruebas automatizadas. No se atribuye a la revisión de navegador una ejecución de todos esos filtros.

Verificación automatizada del código final:

- Backend: **59 pruebas aprobadas**, incluidas selección estable de la primera imagen INITIAL, exclusión de PDF/FINAL, metadata limitada, consulta conjunta, filtros y descarga protegida. Ejecución del 2 de octubre con base y almacenamiento en memoria y conexiones externas deshabilitadas.
- Frontend: **121 pruebas aprobadas**, incluidas acceso Blob privado, formatos y rutas rechazados, cancelación y limpieza, galería/visor, tarjetas, filtros y compatibilidad de metadata. Ejecución final del 2 de octubre.
- Total: **180 pruebas aprobadas**.
- `npm run lint`: aprobado, repetido al cierre el 7 de octubre.
- `npm run build`: aprobado, repetido al cierre el 7 de octubre. Vite procesó 1845 módulos; CSS 100,66 kB / 20,05 kB gzip y JavaScript 346,53 kB / 103,71 kB gzip.

La compilación del cierre incluye el ajuste final del tamaño del título del visor y la limpieza de estilos obsoletos. Se conserva por separado la verificación histórica del refinamiento visual anterior, con sus 133 pruebas.

## Known Limitations

- El navegador de comprobación bloqueó la inspección del lector nativo abierto mediante URL Blob. Se verificó que la acción produjo esa pestaña privada, pero no se verificó visualmente el contenido del PDF en el lector.
- El navegador no expuso el evento de descarga del PDF; no se confirmó un archivo guardado en el equipo desde esa acción. Las pruebas automatizadas verifican la descarga, los bytes, las cabeceras y el control de acceso. El intento de abrir directamente el endpoint sin sesión también fue bloqueado por el navegador; el rechazo 401 se confirmó mediante HTTP.
- Las miniaturas usan el archivo original con carga diferida. No se añadieron versiones reducidas ni un servicio de procesamiento de imágenes.
- Esta iteración no volvió a ejecutar integración contra PostgreSQL real ni almacenamiento externo. La comprobación local no acredita un despliegue con HTTPS y el proveedor persistente elegido.

## Git Operations

**None.** No se ejecutaron operaciones de Git.

Implementación terminada. Se detiene el trabajo a la espera de **Product / Architecture Review**. No se desplegó ni publicó esta iteración.
