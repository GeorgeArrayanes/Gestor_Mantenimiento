# Arrayanes · Prototipo visual, Fase 1 · Iteración 04

Escena isométrica de Blender generada mediante Python. Esta cuarta revisión corrige la orientación de la cancha de fútbol, la separación del bloque atravesado y los ventanales laterales de Preescolar. Conserva la cámara general y la dirección artística; el resultado sigue limitado a validación visual local.

## Revisar y comparar

Abre `index.html` o, con el Node ya disponible, ejecuta `node preview-server.mjs` y visita `http://127.0.0.1:5186/`. El visor sirve únicamente esta carpeta en la interfaz local. No instala paquetes ni publica el prototipo; se detiene con Ctrl+C.

La comparación superpone la vista general de la **iteración 3**, conservada en `iterations/v3/output/`, con la actual de `output/`. Arrastra la separación o usa el control y las flechas del teclado. A la izquierda se descubre la versión actual completa; a la derecha, la anterior. Las tres tarjetas principales permiten revisar la cancha de fútbol en la vista general, el conjunto de bloques y Preescolar. La vista anotada y el plano permiten contrastar su relación espacial.

La galería presenta los seis renders finales verificados de esta revisión y compara las iteraciones 3 y 4. La cámara general conserva exactamente los parámetros de la primera entrega. [Resultados y criterios de esta revisión](ITERATION-4.md).

| Archivo de `output/` | Contenido |
| --- | --- |
| `overview.png` | Vista ortográfica general, 3200 × 2200 |
| `preescolar.png` | Acercamiento para revisar los dos ventanales amplios del lateral |
| `conjunto-bloques.png` | Cuatro bloques de salones y separación del bloque atravesado posterior |
| `bachillerato.png`, `administrativo.png`, `salones.png` | Vistas auxiliares de esta revisión, 1800 × 1350 |
| `overview-annotated.svg` | Escena general identificada; debe permanecer junto a `overview.png` |
| `distribution.svg` | Distribución vectorial anotada para comparar las zonas |
| `arrayanes-campus.blend` | Escena nativa editable con la textura institucional empaquetada |
| `scene-validation.json` | Comprobación de escena y materiales |
| `camera-validation.json` | Comprobación de encuadres y parámetros de las vistas generadas |
| `camera-comparison.json` | Comparación de la cámara general con la referencia conservada |
| `geometry-review.json` | Comprobaciones geométricas de la escena y de las correcciones visuales |
| `render-manifest.json` | Registro de renders finales, dimensiones, tiempos, dispositivo y hashes |
| `delivery-verification.json` | Verificación de finales, hashes, cámaras y apertura del archivo nativo |

Los archivos `preview-*` son revisiones rápidas y no constituyen la entrega final. El manifiesto permite comprobar qué imágenes corresponden al generador actual.

El generador actual tiene cuatro fuentes Python que deben permanecer juntas: `build_scene.py` organiza la escena, `refine_scene.py` conserva el estilo general, `campus_geometry.py` construye la cubierta completa en V y el bloque atravesado, y `corrected_zones.py` resuelve Bachillerato, el parque GYM y la nueva posición de Tienda 1. No requieren dependencias externas a Blender.

## Correcciones de esta iteración

- **Cancha de fútbol:** orientar horizontalmente el eje largo del campo, con las porterías en sus extremos cortos y la línea de medio campo transversal a ese eje. La tarjeta del fútbol abre la vista general completa para revisar su relación con el campus.
- **Conjunto de salones:** conservar el bloque atravesado de la región **4:23**, con una separación clara respecto a los bloques superiores. Se mantiene el mismo lenguaje arquitectónico del conjunto, corrigiendo la unión visual excesiva.
- **Preescolar, 4:33:** representar el lateral con **dos ventanales amplios**, evitando una retícula pequeña que fragmente la lectura del vidrio.

Bachillerato, el GYM exterior, la relación de Tienda 1 con Preescolar y el resto del escenario conservan las decisiones de la tercera revisión. No se presentan como nuevos cambios de la cuarta. No se incorporan funciones del gestor ni nuevos datos.

## Fuentes y límites

Las correcciones expresas del usuario guían esta revisión, contrastadas con el **plano actualizado** y la fotografía aérea `ArrayanesMap.png` ya aportados. El [recorrido virtual oficial](https://gimnasiolosarrayanes.com/tour/) y las imágenes previas complementan la interpretación de fachadas, cubiertas y corredores.

La extracción de Figma en `reference/figma-frame.json` procede del frame **2:2 — 02 · MAPA CORREGIDO · Zonas y edificios según anotaciones**, de 2417 × 1110. [Abrir el frame](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2). El plano adjunto original corresponde a sus dimensiones al doble. Los vectores y sus transformaciones permanecen conservados; la corrección de etiquetas aportada por el usuario guía esta iteración sin editar Figma.

El generador aplica las transformaciones de los polígonos y elimina el contorno repetido del Administrativo. `layout.json` contiene la compensación aproximada de profundidad de la zona lejana. Las unidades son relativas; no equivalen a metros ni a una rectificación fotogramétrica calibrada.

La planta, alturas, uniones, detalles estructurales y separación entre edificios contienen interpretación. La revisión busca una lectura arquitectónica más fiel y coherente dentro de un escenario estilizado; no certifica medidas, interiores ni una reproducción exacta del colegio. El contexto conserva distintos niveles de detalle.

## Regenerar

Requiere **Blender 4.5 LTS**. No necesita Python externo, pip, npm ni servicios de red. Usa `bpy`, `mathutils` y la biblioteca estándar incluidas en Blender; la semilla del paisaje es fija: 42.

`build_scene.py` es el punto de entrada. Mantén los cuatro módulos Python juntos (`build_scene.py`, `refine_scene.py`, `campus_geometry.py` y `corrected_zones.py`), junto a `layout.json` y `reference/`. No ejecutes los módulos auxiliares por separado: utilizan las utilidades y la escena preparadas por el generador.

Desde esta carpeta, en PowerShell:

```powershell
# Reconstruir la escena y las vistas de entrega.
.\render.ps1

# Revisión rápida.
.\render.ps1 -Preview
.\render.ps1 -Preview -View preescolar

# Blender en otra ubicación.
.\render.ps1 -BlenderPath 'D:\Herramientas\Blender\blender.exe'
```

Equivalente directo:

```powershell
& 'RUTA\blender.exe' --background --factory-startup --python-exit-code 1 --python build_scene.py -- --view all
```

La ejecución reconstruye la escena desde cero y sobrescribe las salidas actuales de `output/`. Guarda con otro nombre cualquier edición manual que quieras conservar. Las copias de `iterations/v1/`, `iterations/v2/` e `iterations/v3/` permanecen independientes y no se modifican al regenerar la versión actual. Para repetir una entrega anterior, utiliza los generadores, módulos, configuración y referencias guardados en esa carpeta, sin mezclarlos con los actuales.

Cycles utiliza denoising y cámara ortográfica. Se selecciona CUDA si está disponible y se reintenta por CPU si falla el render por GPU. Las muestras y resoluciones de cada ejecución quedan definidas por el generador; el manifiesto registra los resultados reales. Pueden existir pequeñas diferencias entre dispositivos o versiones de Blender.

## Herramienta disponible

Blender **4.5.9 LTS portátil** se preparó fuera del repositorio, en `%LOCALAPPDATA%\Programs\BlenderPortable\blender-4.5.9-windows-x64\`. [Distribución oficial](https://download.blender.org/release/Blender4.5/).

- ZIP: `blender-4.5.9-windows-x64.zip`, 399 051 129 bytes.
- SHA-256 comprobado: `41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf`.
- La prueba inicial de Cycles funcionó por CUDA en NVIDIA GeForce GTX 1070 with Max-Q Design; véase `output/blender-diagnostics.json`.
- No se modificaron dependencias del aplicativo. Esta revisión no requiere instalar otra herramienta.

## Historial y validación

Las tres entregas anteriores permanecen en `iterations/v1/`, `iterations/v2/` e `iterations/v3/`. La tercera incluye seis renders finales: vista general de 3200 × 2200 y cinco acercamientos de 1800 × 1350, con sus manifiestos y validaciones. Registró 5742 objetos, ningún error de validación y cámara general idéntica a la primera, con diferencia máxima de parámetros de 0. Esas comprobaciones pertenecen a la **tercera iteración** y no certifican la cuarta.

La cuarta entrega incluye seis renders finales verificados, 5631 objetos, materiales y coordenadas sin errores, seis encuadres sin recortes y cámara general idéntica a la primera. La escena nativa abrió correctamente con siete cámaras y la imagen institucional empaquetada. Los resultados están en `ITERATION-4.md` y en los JSON de `output/`. La revisión técnica de archivos y encuadres no sustituye la aprobación visual de fidelidad y distribución por parte del usuario.

## Alcance

Todo el trabajo permanece en `prototypes/campus-map/`, sobre `feature/mapa-isometrico`. La fase continúa siendo exclusivamente visual: sin integración de incidencias, selección, paneles ni datos reales; sin cambios de base de datos, endpoints, módulos existentes, `main` o despliegues. El punto de parada es la revisión visual del usuario antes de autorizar otra etapa.
