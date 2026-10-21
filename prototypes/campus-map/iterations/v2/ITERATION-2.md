# Arrayanes · Fase 1, iteración visual 02

Esta revisión mantiene el alcance de prototipo visual. Su objetivo es acercar la escena a un escenario isométrico reconocible del colegio, con más carácter arquitectónico y una lectura más clara del campus.

## Desarrollo visual de esta revisión

- Administrativo: lectura de acristalamientos y juntas de fachada, paños blancos y amarillos, acceso y pavimento.
- Cuatro bloques: composición longitudinal más clara, cubiertas azules, paños azules y verdes, corredores y celosía oscura en los extremos.
- Preescolar: interpretación de dos niveles, cubierta acristalada de dos aguas, estructura de cerchas y patio lúdico.
- Contexto: arquitectura preliminar en Bachillerato, transición, grado 11, GYM y zonas próximas; más presencia de pavimento, canchas, senderos, césped y jardines.

Estos elementos son decisiones de reconstrucción visual apoyadas en las referencias. No confirman medidas, plantas interiores ni una fidelidad completa al edificio real.

## Comparar las dos entregas

Abre `index.html` o inicia el visor local existente con `node preview-server.mjs` y visita `http://127.0.0.1:5186/`.

La galería coloca las vistas generales de ambas iteraciones una sobre otra. El control permite descubrir la primera versión o la actual sin cambiar de imagen. Las flechas del teclado también funcionan. Los acercamientos anteriores se conservan en una sección desplegable.

Los cuatro renders finales de la segunda iteración están verificados y visibles en la galería. Las rutas de entrega son `output/*.png`; los previews no se usan como imágenes finales.

| Entrega | Ubicación |
| --- | --- |
| Primera iteración conservada | `iterations/v1/output/` |
| Entrega visual actual | `output/` |
| Escena identificada | `output/overview-annotated.svg` |
| Plano vectorial de referencia | `output/distribution.svg` |

Los SVG se abren como documentos dentro de la galería para permitir que la escena anotada cargue su imagen de base. Si se comparte el SVG anotado por separado, debe acompañarlo `overview.png` en la misma carpeta.

## Comprobaciones de esta entrega

Los cuatro finales se completaron por GPU: vista general de 3200 × 2200 en 89,50 s; Administrativo en 41,40 s, Salones en 43,17 s y Preescolar en 36,99 s, con acercamientos de 1800 × 1350. El manifiesto identifica las cuatro entradas como iteración 2 y sus hashes coinciden con los generadores y PNG entregados.

La cámara general coincide con la versión 1, con diferencia máxima de parámetros de 0 según `output/camera-comparison.json`. La escena registra 4828 objetos y ningún error de validación. Estas comprobaciones verifican los archivos y la comparación; la fidelidad arquitectónica sigue sujeta a revisión visual.

## Criterios de revisión

- **Identidad:** reconocer el Administrativo por su composición blanca, vidrio y amarillo; los salones por su conjunto longitudinal y cubiertas azules; Preescolar por su planta y estructura acristalada.
- **Conjunto:** leer los cuatro bloques y su relación con el patio central, Bachillerato, transición, Preescolar y el borde Administrativo. Contrastar grado 11 y GYM con el plano corregido.
- **Acabado:** evaluar contraste, sombras, lectura de materiales y presencia de canchas, pisos, senderos y zonas verdes dentro de una estética contenida.
- **Comparación:** conservar la cámara general y la lógica de distribución para juzgar las mejoras visuales entre entregas. Los acercamientos sirven para revisar arquitectura; no son un levantamiento técnico.

## Fuentes

- [Recorrido virtual oficial del colegio](https://gimnasiolosarrayanes.com/tour/), proporcionado para contrastar arquitectura y relaciones espaciales.
- [Frame de Figma 2:2 — 02 · MAPA CORREGIDO · Zonas y edificios según anotaciones](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2), referencia de distribución y posición corregida de grado 11 y GYM.
- Fotografía aérea `ArrayanesMap.png`, plano adjunto y referencias del Administrativo aportadas en la conversación.
- Extracción conservada en `reference/figma-frame.json`, con las transformaciones de los polígonos originales.

La fotografía y el recorrido aportan referencias visuales; el plano corregido fija la distribución aproximada. Las alturas, proporciones, acabados y detalles reconstruidos contienen interpretación. Las unidades no equivalen a medidas arquitectónicas verificadas. El contexto se desarrolla de forma preliminar y no tiene el mismo nivel de detalle que los tres edificios principales.

## Alcance y reproducción

La revisión usa la escena y el generador de `prototypes/campus-map/`. Las instrucciones para regenerar se encuentran en `README.md`. El visor usa archivos locales y no instala paquetes.

El punto de entrada sigue siendo `build_scene.py`, que importa el nuevo módulo visual `refine_scene.py`. La primera versión conserva su propio generador y referencias en `iterations/v1/` para poder regenerarla sin incorporar el refinamiento actual.

Esta entrega no añade incidencias, selección de espacios, paneles ni datos reales. No requiere modificar la base de datos, endpoints o módulos existentes, y no incluye despliegue. El punto de parada sigue siendo la revisión visual del usuario antes de autorizar cualquier fase funcional.
