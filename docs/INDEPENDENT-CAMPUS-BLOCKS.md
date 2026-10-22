# Bloques independientes, reporte y directorio · 21 de octubre de 2026

## Recuperación revisada

La rama `feature/mapa-isometrico` partía del commit `861dc79` ("Mapa estable con reporte"). Ese guardado y su exportador agrupaban los cuatro bloques y el bloque atravesado como `bloques-salones`. Se revisaron ramas, reflogs y los objetos inalcanzables de Git: 84 árboles y 87 blobs, sin commits perdidos. No apareció una selección individual recuperable. El `CampusMapPage` anterior del blob `f71dcf35583a1d8dd19b3b60b48aa87f567c2249` también agrupaba los bloques. Esto describe lo encontrado aquí; no demuestra que nunca haya existido otra copia fuera del repositorio.

Se reconstruyó la selección desde los objetos individuales del `.blend` aprobado, sin modificar el modelo, las imágenes ni la cámara.

## Comportamiento

- Veinte regiones visibles, con selección independiente de los bloques 1, 2, 3, 4 y el atravesado.
- Cada edificio conserva su lista de espacios. Añadir uno actualiza inmediatamente el panel y el directorio inferior.
- El directorio utiliza listas HTML desplegables y permite buscar por edificio, nombre o piso y seleccionar directamente un espacio. No carga fotografías ni hace una petición por edificio.
- **Reportar incidencia** abre el formulario existente `/incidencias/nueva` con edificio y espacio preseleccionados. Cambiar de edificio borra el espacio anterior y filtra las ubicaciones activas.
- Los parámetros del enlace se validan contra el catálogo autenticado. Un espacio cruzado, borrado, desconocido o archivado no selecciona otra ubicación como respaldo.
- El POST conserva el contrato existente y envía únicamente el `space_id` real junto a los demás campos de la incidencia. No crea ubicaciones ficticias.
- Las etiquetas de ubicación incluyen el edificio conocido para distinguir salones con igual nombre/piso. El detalle muestra el edificio **actual** usando el catálogo ya cargado, sin reemplazar nombres y zonas históricos ni agregar solicitudes.

## Compatibilidad

La migración `006_individual_campus_blocks.sql` amplía los IDs permitidos y limita la unicidad de nombre/zona al edificio. Dos edificios pueden tener "Salón 101 / Primer piso"; el mismo edificio sigue rechazando duplicados.

Los registros de `bloques-salones` conservan su ID, historial y asociación. Aparecen en **Salones · espacios compartidos** cuando existen. Pueden reasignarse explícitamente desde Espacios; no se adivina el edificio por nombre o zona. Las migraciones históricas 003 y 005 permanecen intactas. La normalización de nombre de restricción en `db.js` es exclusiva de pg-mem para reproducir PostgreSQL.

La migración 006 se probó solo en bases desechables en memoria. No se ejecutó en Supabase, no hubo despliegue y `main` permanece sin cambios.

## Integridad y reproducción

El exportador distingue los prefijos `salones.`, `bloque-2.`, `bloque-3.`, `bloque-4.` y `bloque-atravesado.`. Las 408 piezas anónimas de celosía se asignan por distancia al núcleo geométrico orientado de cada edificio: 102 por bloque. El terreno y los jardines mantienen su oclusión.

`build_assets.py` publica veinte siluetas SVG y `selectionRevision: 2`. Las tres imágenes WebP conservan exactamente sus hashes y tamaños anteriores; el JSON pasa a 155.982 bytes. El navegador sigue usando imágenes y trazados, sin cargar Blender ni un motor 3D.

Con los ejecutables ya documentados en `prototypes/campus-map/INTERACTIVE-STAGE-A.md`:

```powershell
& $blenderExe --background --factory-startup --python-exit-code 1 --python prototypes/campus-map/interactive/export_ids.py
& $assetPython prototypes/campus-map/interactive/build_assets.py
& $blenderExe --background --factory-startup --python-exit-code 1 --python prototypes/campus-map/interactive/validate_rays.py
& $assetPython prototypes/campus-map/interactive/validate_split.py
& $assetPython prototypes/campus-map/interactive/verify_delivery.py
```

`validate_split.py` lee la máscara anterior del commit `861dc79` sin restaurar archivos ni cambiar de rama. La unión de las cinco máscaras nuevas coincide exactamente con la anterior: 231.705 píxeles, IoU 1,0. Las otras quince máscaras también coinciden exactamente. Se verificaron 3.400 rayos de cámara sin discrepancias. El render, `.blend` y cinco fuentes de la quinta iteración conservan sus hashes.

## Verificación

- Build y lint: PASS.
- Backend y migración: 38/38 pruebas focalizadas PASS.
- Frontend, activos y etiquetas: 48/48 pruebas focalizadas PASS.
- Suite completa ejecutada antes de las dos últimas pruebas de activos/etiquetas: backend 109/112 y frontend 167/169. Permanecen las cinco fallas preexistentes: dos expectativas antiguas de estados, dos de WhatsApp y una de cookie SameSite. No se cambiaron esos comportamientos para ocultarlas.
- Navegador: selección de los cinco bloques; Salón 101/Primer piso en bloques 1 y 2; Baño norte/Segundo piso en bloque 1; aparición inmediata en el directorio; cambio entre espacios del mismo edificio; filtro que reinicia la ubicación; enlace cruzado que deja el espacio vacío; registro de MT-2026-003 en el espacio 6 y detalle con edificio actual.
- Escritorio y móvil: sin desbordamiento horizontal; listas, selección y acción de reporte legibles.

Capturas e informes en `prototypes/campus-map/interactive/output/`:

- `independent-blocks-desktop.jpg`
- `independent-blocks-mobile.jpg`
- `independent-incident-detail.jpg`
- `independent-blocks-validation.json`, `raycast-validation.json` y `delivery-verification.json`
- Logs `independent-*-tests.log`, `independent-frontend-focused.log` e `independent-build.log`

## Revisión local

Se mantienen los launchers QA aislados en `http://127.0.0.1:5175/mapa`, con API en 4011. Cuenta demo: `admin@mantenimiento.test` / `Mantenimiento2026!`. El backend utiliza memoria efímera: los ejemplos desaparecen al detenerlo o reiniciarlo. No está conectado a la base de producción. Se deja en ejecución para revisar esta entrega.
