# Arrayanes · Prototipo visual, Fase 1

Una escena de Blender generada enteramente mediante Python. La entrega se limita a la revisión visual de la distribución y de tres edificios. No está integrada al gestor.

## Revisar el resultado

Abre `index.html` para ver la galería, o consulta los archivos de `output/`:

Opcionalmente, con el Node ya instalado: `node preview-server.mjs`, y abre `http://127.0.0.1:5186/`. Solo sirve esta carpeta en la interfaz local; no instala paquetes ni publica el prototipo. Detén el visor con Ctrl+C.

| Archivo | Contenido |
| --- | --- |
| `overview.png` | Vista ortográfica general, 3200 × 2200 |
| `administrativo.png` | Acercamiento al Administrativo, 1800 × 1350 |
| `salones.png` | Acercamiento al bloque de salones, 1800 × 1350 |
| `preescolar.png` | Acercamiento a Preescolar, 1800 × 1350 |
| `overview-annotated.svg` | Vista general con tres edificios, grado 11 y GYM identificados; abrir junto a `overview.png` |
| `distribution.svg` | Distribución vectorial anotada para comparar con Figma |
| `arrayanes-campus.blend` | Escena nativa editable; incluye la textura institucional empaquetada |
| `scene-validation.json` | Comprobación de escena, materiales y dispositivo seleccionado |
| `camera-validation.json` | Comprobación de encuadres y parámetros de las cuatro vistas |
| `render-manifest.json` | Resoluciones, tiempos y dispositivo real de los renders finales |

## Referencias y decisiones

Se verificó el frame de Figma **2:2 — 02 · MAPA CORREGIDO · Zonas y edificios según anotaciones**, de 2417 × 1110. La imagen adjunta del plano, 4834 × 2220, corresponde a ese frame al doble. [Abrir el frame](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2).

`reference/figma-frame.json` conserva la extracción de vectores y transformaciones. El script aplica sus transformaciones, elimina el contorno repetido del Administrativo y emplea las huellas poligonales. No se utilizaron rectángulos envolventes como plantas ni se modificó Figma.

- **Administrativo, 4:37:** la franja 4:39 sitúa el acceso. Se modelaron fachada blanca, acristalamientos, torre de circulación, dos paneles amarillos, escudo GLA, acceso cubierto, cubierta plana y equipos superiores. La imagen frontal aportada guía la composición.
- **Salones, 4:17:** bloque junto al patio central; tres niveles, corredores abiertos, barandas, columnas, ventanas y cubierta azul con juntas. La fotografía aérea guía su carácter arquitectónico.
- **Preescolar, 4:33:** huella irregular, dos alas de cubierta azul, ala de acceso blanca y espacio central cubierto por vidrio y estructura metálica. Las cubiertas azules tienen un encuentro recortado para evitar superposiciones coplanares.
- **Grado 11, 4:45, y GYM, 4:47:** se conserva su ubicación en el plano corregido, que prima sobre la fotografía aérea anterior.

Las demás regiones se muestran como huellas de contexto, con canchas, vegetación contenida, senderos y mobiliario. No son edificios terminados. Algunas zonas de Figma se cruzan: se separaron ligeramente en altura las láminas de contexto para evitar parpadeos, sin alterar la referencia original.

### Límites que deben revisarse visualmente

La fotografía es oblicua y el plano no tiene escala. Las unidades son relativas, no metros comprobados. `layout.json` contiene una compensación aproximada de profundidad de la zona lejana; no equivale a una rectificación fotogramétrica calibrada. Las proporciones, alturas, accesos, barandas, vegetación, mobiliario y estructura acristalada contienen interpretación visual.

El Administrativo y Salones se reconstruyen sobre ejes derivados de sus polígonos; no se afirma una planta arquitectónica exacta. Preescolar conserva la concavidad característica, pero su estructura interior debe contrastarse con fotografías adicionales antes de una fase posterior. La vista general mantiene una cámara ortográfica fija; el acercamiento al Administrativo gira para mostrar su fachada principal.

## Regenerar

Requiere **Blender 4.5 LTS**. No requiere Python externo, pip, npm ni servicios de red. El generador usa `bpy`, `mathutils` y la biblioteca estándar incluidas en Blender. La semilla de vegetación es fija: 42.

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

La escena se reconstruye desde cero y los archivos de salida se sobrescriben. Guarda con otro nombre cualquier edición manual del `.blend` que quieras conservar. Los previews usan nombres `preview-*`; no sustituyen los PNG finales. Para comprobar solo el motor, ejecuta `verify_blender.py` con `--python`.

El motor es Cycles, con denoising, 96 muestras finales y cámara ortográfica. El script selecciona CUDA si está disponible y reintenta por CPU si falla el render GPU. Los resultados pueden variar ligeramente entre versiones de Blender y dispositivos.

## Herramienta verificada

Se preparó Blender **4.5.9 LTS portátil** fuera del repositorio, en `%LOCALAPPDATA%\Programs\BlenderPortable\blender-4.5.9-windows-x64\`. [Descarga oficial](https://download.blender.org/release/Blender4.5/).

- ZIP oficial: `blender-4.5.9-windows-x64.zip`, 399 051 129 bytes.
- SHA-256 verificado: `41da973b9bf95bb312cbeff4d1982feb13259b43c821686b9bafea4dfe5477cf`.
- Prueba real: Cycles por CUDA en NVIDIA GeForce GTX 1070 with Max-Q Design; diagnóstico en `output/blender-diagnostics.json`.
- La instalación portátil y su ZIP permanecen fuera de Git. No se modificaron dependencias del aplicativo.

### Verificación de la entrega

Los cuatro renders finales se completaron por GPU: aproximadamente 81 s para la vista general y 32–34 s para cada acercamiento. Se revisaron las cuatro imágenes, las uniones de cubiertas, la distribución y la galería. Los cuatro encuadres pasan la comprobación de límites; no hay materiales ausentes ni coordenadas no finitas. Se volvió a abrir el `.blend` con éxito y se comprobaron sus cinco cámaras —la principal y cuatro vistas guardadas— y la textura empaquetada.

Estas comprobaciones validan los archivos y la presentación del prototipo. La fidelidad arquitectónica y la distribución aproximada quedan sujetas a revisión visual; no sustituyen un levantamiento del colegio.

## Alcance

Todo el trabajo está en `prototypes/campus-map/`, sobre `feature/mapa-isometrico`. No modifica base de datos, endpoints, módulos existentes ni `main`. No hay despliegue, selección de espacios, contadores, formularios ni conexión con datos. El siguiente paso requiere la revisión visual del usuario.

