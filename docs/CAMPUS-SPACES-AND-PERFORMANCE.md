# Espacios internos y rendimiento · 19 de octubre de 2026

## Alcance y uso

La nueva solicitud permite crear espacios dentro de los edificios del mapa. Al elegir un edificio aparece «Añadir espacio»; el formulario pide nombre y ubicación interna. El registro se guarda mediante el endpoint existente `POST /api/spaces`, aparece en el desplegable de ese edificio y se puede volver a seleccionar después de recargar. No se dibujan interiores ni se cargan modelos adicionales. El mapa arquitectónico aprobado permanece intacto.

El catálogo de Espacios incorpora «Edificio del mapa» al crear/editar. Los registros anteriores quedan sin edificio hasta que alguien los asigne explícitamente. No hay asociaciones inferidas por nombres o por zona. Los cuatro bloques y el bloque atravesado conservan un único identificador `bloques-salones`.

El mapa consulta el catálogo una vez por montaje y filtra sus listas localmente; cambiar de edificio no hace una consulta por edificio ni descarga fotos. Tras crear un espacio se incorpora la respuesta a la lista sin volver a descargar el catálogo. No se conectaron contadores/historial de incidencias del mapa ni se añadieron formularios de incidencias dentro de él.

## Persistencia preparada

- `shared/campus-regions.mjs`: catálogo compartido de 16 IDs semánticos.
- `database/migrations/005_campus_regions.sql`: columna **opcional** `maintenance_spaces.campus_region_id`, validación de IDs e índice. Los registros previos conservan `NULL`.
- `backend/src/routes/spaces.js`: POST/PATCH validan el campo; omitirlo en PATCH conserva la relación, `null` o cadena vacía la retiran. GET devuelve la relación con el resto del catálogo.
- `CampusSpacesPanel.jsx` y `campus-spaces.js`: formulario, lista nativa y ficha del espacio seleccionado.

La migración se probó únicamente al crear bases en memoria de QA/tests. **No se ejecutó en Supabase ni en otra base persistente.** Antes de publicar este código debe aprobarse y aplicarse la migración 005 mediante el mecanismo de migraciones existente; después se despliega el aplicativo. Publicar las nuevas escrituras antes de actualizar el esquema provocaría errores. No se modificó `main` ni hubo despliegue.

## Carga y navegación

Todas las pantallas administrativas usan carga diferida, con el mismo control de sesión y roles. El foco se ajusta cuando la pantalla termina de cargar. La caché de fotografías privadas permanece exclusivamente en RAM: 60 segundos, 32 entradas y 12 MiB como máximo. Deduplica solicitudes simultáneas; cancelar una vista no cancela las otras que comparten esa foto. Se limpia al entrar, salir, cambiar token o recibir un 401, incluyendo peticiones pendientes y las transiciones de sesión. No guarda PDF, tokens, URL temporales ni blobs en almacenamiento persistente. Cada componente sigue revocando sus propias URL temporales.

Medidas del build local, antes y después de esta solicitud:

| Recurso inicial | Antes | Después |
| --- | ---: | ---: |
| JavaScript principal | 361,50 kB | 244,37 kB |
| JavaScript compartido precargado | incluido arriba | 16,78 kB |
| JavaScript inicial total | 361,50 kB | 261,14 kB, aproximadamente **28 % menos** |
| CSS inicial | 110,89 kB | 30,54 kB, aproximadamente **72 % menos** |

Son bytes de archivos minificados, no una promesa de latencia de red ni de RAM total. Las pantallas siguientes añaden su propio código al abrirse. El render WebP del mapa ya optimizado se conserva. La ilustración de fondo compartida pasa de JPG a WebP: 431.813 a 389.688 bytes, conservando el original como referencia.

En el servidor, ExcelJS y PDFKit se importan solo al exportar. Una medición local del módulo de reportes antes de usarlos bajó de unos 15,1 a 0,4 MiB de heap adicional; es una medición puntual del módulo, no de todo el servidor. Ambos formatos se generaron correctamente después del cambio.

## Fotos nuevas

Se añade `sharp@0.35.5` únicamente al backend. `image-optimization.js` se invoca desde `prepareUpload/prepareUploads` **antes** de abrir transacciones en los tres flujos: espacios, personal y evidencias iniciales/finales de incidencias. Se almacenan conjuntamente los bytes definitivos y su nombre, MIME y tamaño correspondientes. Las fotos residen en Storage/local; PostgreSQL conserva sus referencias y metadatos.

- Entradas permitidas y límite conservados: JPEG/PNG/WebP hasta 5 MB; las evidencias también admiten PDF.
- Validación de firma, decodificación real, límite de 40 megapíxeles y rechazo de animaciones soportadas.
- Corrección de orientación, proporciones conservadas, sin ampliar imágenes pequeñas; candidato WebP a calidad 90, alfa 100 y lado de hasta 2560 px.
- Si el candidato pesa más o el original ocupa menos de 1 KiB, se conserva el archivo original validado. En esa excepción también se conserva su resolución original.
- Un solo procesamiento a la vez, cola limitada, caché de libvips de 16 MiB y un trabajador para limitar picos de recursos.
- PDF sin cambios. No se reprocesaron fotos ya almacenadas ni se creó un segundo original en Storage.

Ejemplo reproducido con `frontend/public/campus-maintenance.png`: **2.515.729 → 418.292 bytes**, 83,4 % menos. La reducción depende de cada foto. WebP calidad 90 prioriza calidad visual alta; **no es compresión matemáticamente sin pérdida**, y reducir resolución puede eliminar detalles finos. Los originales de referencia del proyecto se mantienen.

Referencia de la herramienta: [documentación oficial de salida de sharp](https://sharp.pixelplumbing.com/api-output/).

## Validación

- Build y lint completos: PASS.
- Backend de espacios/imágenes: **41/41** pruebas focales PASS; incluye las 16 regiones, guardado/edición/desasociación, autorización y correspondencia entre bytes servidos y MIME/nombre/tamaño en BD.
- Frontend de API/caché: **61/61** PASS; incluye TTL, límites, deduplicación, cancelación independiente, aislamiento de sesiones, 401, exclusión de PDF y seguridad de URL.
- Mapa/listas: **5/5** PASS, incluyendo separación explícita entre edificios y agrupación de salones.
- Suite completa backend: **99/102**. Suite completa frontend con aislamiento normal: **159/161**. Permanecen las cinco fallas preexistentes de expectativas antiguas de etiquetas, encabezado de WhatsApp y cookie SameSite, documentadas en la entrega anterior. No se cambiaron esos comportamientos para ocultar fallas.
- El PNG diminuto usado en los fixtures se sustituyó por un PNG válido: el anterior tenía un bloque corrupto que solo se detectó al introducir un decodificador real.
- Navegador local: creación de dos espacios en Administrativo, separación respecto a Preescolar, persistencia después de recargar, selección desde el desplegable, formulario de edición con edificio correcto y revisión a 1440 × 1000 y 390 × 844. Sin desbordamiento horizontal en móvil. Capturas en `prototypes/campus-map/interactive/output/internal-spaces-desktop.jpg` y `internal-spaces-mobile.jpg`.
- El selector de archivos de la automatización del navegador falló con una referencia de nodo inválida; esa subida manual no se confirmó. La subida y compresión mediante la API sí están cubiertas por las pruebas de integración.
- El verificador de entrega visual confirma intactos el `.blend`, render aprobado, generadores y geometrías del mapa.

Para revisar localmente, se reutilizan los launchers aislados documentados en `prototypes/campus-map/INTERACTIVE-STAGE-A.md`, en `http://127.0.0.1:5175/mapa`. Las credenciales de prueba son `admin@mantenimiento.test` / `Mantenimiento2026!`. Los ejemplos creados durante QA están en memoria y desaparecen al detener el servidor; no son datos de producción.

Comandos comprobados, desde la raíz:

```powershell
npm run build
npm run lint
npm run test -w frontend -- --maxWorkers=1
# Para backend: TEST_POSTGRES_URL, SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY vacíos.
npm run test -w backend
```

La opción `--no-isolate` no debe usarse para la suite completa: permite que mocks de una prueba afecten a otra. Las pruebas se verificaron también con aislamiento normal y un trabajador.
