# Arrayanes · Prototipo visual, Fase 1 · Iteración 02

Una escena de Blender generada enteramente mediante Python. Esta segunda iteración se centra en el parecido arquitectónico de tres edificios y en desarrollar visualmente el conjunto del campus. La entrega se limita a revisión visual; no está integrada al gestor.

## Revisar el resultado

Abre `index.html` para ver la galería comparativa, o consulta los archivos de `output/`. La primera entrega está conservada en `iterations/v1/`, incluidos su generador y los renders de `iterations/v1/output/`.

El control de la galería superpone las dos vistas generales con la misma proporción de imagen. Moverlo a la izquierda muestra la versión actual; a la derecha descubre la primera versión. Los acercamientos anteriores también se pueden consultar en la sección desplegable. La cámara general se mantiene para que la comparación permita evaluar arquitectura, materiales y contexto. [Notas de esta revisión](ITERATION-2.md).

Opcionalmente, con el Node ya instalado: `node preview-server.mjs`, y abre `http://127.0.0.1:5186/`. Solo sirve esta carpeta en la interfaz local; no instala paquetes ni publica el prototipo. Detén el visor con Ctrl+C.

| Archivo | Contenido |
| --- | --- |
| `overview.png` | Vista ortográfica general, 3200 × 2200 |
| `administrativo.png` | Acercamiento al Administrativo, 1800 × 1350 |
| `salones.png` | Acercamiento al bloque de salones, 1800 × 1350 |
| `preescolar.png` | Acercamiento a Preescolar, 1800 × 1350 |
| `overview-annotated.svg` | Vista general identificada para comparar las zonas principales; mantener junto a `overview.png` |
| `distribution.svg` | Distribución vectorial anotada para comparar con Figma |
| `arrayanes-campus.blend` | Escena nativa editable; incluye la textura institucional empaquetada |
| `scene-validation.json` | Comprobación de escena, materiales y dispositivo seleccionado |
| `camera-validation.json` | Comprobación de encuadres y parámetros de las cuatro vistas |
| `camera-comparison.json` | Comparación de la cámara general con la primera iteración |
| `render-manifest.json` | Resoluciones, tiempos y dispositivo real de los renders finales |

## Referencias y decisiones

El [recorrido virtual oficial del colegio](https://gimnasiolosarrayanes.com/tour/) complementa la fotografía aérea y las imágenes aportadas para contrastar fachadas, cubiertas, corredores y relaciones entre espacios. La reconstrucción sigue siendo interpretativa; el recorrido no proporciona una planta ni medidas arquitectónicas verificadas.

Se verificó el frame de Figma **2:2 — 02 · MAPA CORREGIDO · Zonas y edificios según anotaciones**, de 2417 × 1110. La imagen adjunta del plano, 4834 × 2220, corresponde a ese frame al doble. [Abrir el frame](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2).

`reference/figma-frame.json` conserva la extracción de vectores y transformaciones. El script aplica sus transformaciones, elimina el contorno repetido del Administrativo y emplea las huellas poligonales. No se utilizaron rectángulos envolventes como plantas ni se modificó Figma.

- **Administrativo, 4:37:** la franja 4:39 sitúa el acceso. La composición conserva fachada blanca, acristalamientos, torre de circulación, paneles amarillos, escudo GLA, acceso cubierto y cubierta plana. Esta revisión añade lectura de juntas, vidrios, paños laterales y pavimento de acceso. La imagen frontal aportada y el recorrido guían la interpretación.
- **Salones, 4:17, y conjunto de cuatro bloques:** se desarrollan tres niveles, corredores, barandas, columnas y cubiertas azules. Los paños azules y verdes y la celosía oscura de los extremos recogen rasgos visibles del colegio. El bloque representativo mantiene su acercamiento propio, mientras los otros tres ayudan a leer el conjunto junto al patio central.
- **Preescolar, 4:33:** se interpreta la huella irregular con dos niveles, alas de cubierta azul, cubierta acristalada de dos aguas y estructura de cerchas. El patio lúdico incorpora colores y marcas de juego para revisar su carácter espacial. Su planta interior y dimensiones no están levantadas.
- **Bachillerato, transición y zonas cercanas:** aparecen volúmenes preliminares con patios, cubiertas y superficies de juego. Sirven para dar continuidad al campus y todavía no tienen el detalle de los tres edificios principales.
- **Grado 11, 4:45, y GYM, 4:47:** se conserva su ubicación en el plano corregido, que prima sobre la fotografía aérea anterior. La revisión les da volumen, cubierta y una caracterización visual inicial.
- **Pisos y paisaje:** el pavimento, las canchas, los senderos, el césped y los jardines reciben más contraste y lectura de material. La vegetación y el mobiliario aportan escala visual con una distribución contenida e interpretativa.

El resto del campus combina huellas de referencia y arquitectura preliminar. El desarrollo adicional del contexto no equivale a edificios terminados ni confirma sus geometrías. Algunas zonas de Figma se cruzan: se separan ligeramente en altura las láminas de contexto para evitar parpadeos, sin alterar la referencia original.

### Límites que deben revisarse visualmente

La fotografía es oblicua y el plano no tiene escala. Las unidades son relativas, no metros comprobados. `layout.json` contiene una compensación aproximada de profundidad de la zona lejana; no equivale a una rectificación fotogramétrica calibrada. Las proporciones, alturas, accesos, barandas, vegetación, mobiliario y estructura acristalada contienen interpretación visual.

El Administrativo y Salones se reconstruyen sobre ejes derivados de sus polígonos; no se afirma una planta arquitectónica exacta. Preescolar conserva su concavidad característica, pero su estructura interior, alturas y uniones de cubierta requieren revisión visual. El desarrollo de Bachillerato, transición y el norte tiene un nivel preliminar. La vista general mantiene la cámara ortográfica de la primera iteración; el acercamiento al Administrativo gira para mostrar su fachada principal.

## Regenerar

Requiere **Blender 4.5 LTS**. No requiere Python externo, pip, npm ni servicios de red. El generador usa `bpy`, `mathutils` y la biblioteca estándar incluidas en Blender. La semilla de vegetación es fija: 42.

`build_scene.py` es el punto de entrada. Importa automáticamente el nuevo módulo `refine_scene.py`, que contiene el acabado de materiales, el refinamiento de edificios, los cuatro bloques y el contexto de esta segunda iteración. No ejecutes `refine_scene.py` por separado: utiliza las utilidades y la escena preparadas por el generador principal. Ambos archivos deben permanecer en la misma carpeta.

Desde esta carpeta, en PowerShell:

```powershell
# Generar la escena y los cuatro renders finales.
.\render.ps1

# Revisión rápida o una vista individual.
.\render.ps1 -Preview
.\render.ps1 -Preview -View preescolar

# Blender en otra ubicación.
.\render.ps1 -BlenderPath 'D:\Herramientas\Blender\blender.exe'
```

Equivalente sin el script de PowerShell:

```powershell
& 'RUTA\blender.exe' --background --factory-startup --python-exit-code 1 --python build_scene.py -- --view all
```

La escena se reconstruye desde cero y los archivos de `output/` se sobrescriben. La copia conservada en `iterations/v1/` no se modifica al ejecutar el generador actual. Guarda con otro nombre cualquier edición manual del `.blend` que quieras conservar. Los previews usan nombres `preview-*`; no sustituyen los PNG finales. Para comprobar solo el motor, ejecuta `verify_blender.py` con `--python`.

Para regenerar la primera iteración en su propia carpeta, ejecuta `iterations/v1/render.ps1`. Usa su copia de `build_scene.py`, `layout.json` y referencias; sus salidas quedan en `iterations/v1/output/`. No sustituyas esos archivos por el generador actual si deseas conservar una comparación reproducible.

El motor es Cycles, con denoising, 96 muestras finales y cámara ortográfica. El script selecciona CUDA si está disponible y reintenta por CPU si falla el render GPU. Los resultados pueden variar ligeramente entre versiones de Blender y dispositivos.

## Herramienta verificada

Se preparó Blender **4.5.9 LTS portátil** fuera del repositorio, en `%LOCALAPPDATA%\Programs\BlenderPortable\blender-4.5.9-windows-x64\`. [Descarga oficial](https://download.blender.org/release/Blender4.5/).

- ZIP oficial: `blender-4.5.9-windows-x64.zip`, 399 051 129 bytes.
- SHA-256 verificado: `41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf`.
- Prueba real: Cycles por CUDA en NVIDIA GeForce GTX 1070 with Max-Q Design; diagnóstico en `output/blender-diagnostics.json`.
- La instalación portátil y su ZIP permanecen fuera de Git. No se modificaron dependencias del aplicativo.

### Verificación de la primera entrega conservada

Los cuatro renders de la primera iteración se completaron por GPU: aproximadamente 81 s para la vista general y 32–34 s para cada acercamiento. Se revisaron sus cuatro imágenes, uniones de cubiertas, distribución y galería. Los cuatro encuadres pasaron la comprobación de límites; no hubo materiales ausentes ni coordenadas no finitas. Se volvió a abrir su `.blend` y se comprobaron las cinco cámaras —la principal y cuatro vistas guardadas— y la textura empaquetada. Estos tiempos y verificaciones pertenecen a `iterations/v1/`; no son un registro de la segunda iteración.

### Verificación de la segunda iteración

Los cuatro finales están generados por GPU y registrados como **iteración 2** en `output/render-manifest.json`: vista general de 3200 × 2200 en 89,50 s; Administrativo en 41,40 s, Salones en 43,17 s y Preescolar en 36,99 s, estos últimos de 1800 × 1350. Cada entrada incluye los hashes de `build_scene.py`, `refine_scene.py`, `layout.json` y del PNG correspondiente; se verificó su coincidencia con los archivos entregados.

`output/camera-comparison.json` confirma la misma cámara general que en la primera iteración, con diferencia máxima de parámetros de **0**. `scene-validation.json` registra 4828 objetos y ningún error de validación. La galería se habilitó después de completar y verificar los cuatro finales; los previews de `output/preview-*.png` no se usan como imágenes de entrega.

Estas comprobaciones validan los archivos y la presentación del prototipo. La fidelidad arquitectónica y la distribución aproximada quedan sujetas a revisión visual; no sustituyen un levantamiento del colegio.

## Alcance

Todo el trabajo está en `prototypes/campus-map/`, sobre `feature/mapa-isometrico`. No modifica base de datos, endpoints, módulos existentes ni `main`. No hay despliegue, selección de espacios, contadores, formularios ni conexión con datos. El siguiente paso requiere la revisión visual del usuario.

