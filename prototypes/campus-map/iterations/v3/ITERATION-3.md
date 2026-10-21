# Arrayanes · Fase 1, iteración visual 03

Esta revisión corrige cinco problemas concretos de fidelidad respecto al plano y a la fotografía aérea aportados de nuevo por el usuario. Mantiene la cámara isométrica base, el estilo y la dirección artística de la segunda entrega. Continúa siendo un prototipo visual local.

## Correcciones a revisar

| Zona | Corrección visual solicitada | Referencia |
| --- | --- | --- |
| Conjunto de salones | Añadir el bloque atravesado posterior y darle continuidad arquitectónica con los cuatro bloques | Región 4:23, ahora rotulada en el plano actualizado |
| Preescolar | Completar el vidrio en V, con una geometría coherente con la huella y con sus encuentros en las cubiertas azules y la estructura blanca | Región 4:33 y fotografía aérea |
| Tienda 1 | Acercarla a Preescolar y reducir el vacío entre ambas piezas | Región 4:35 y su relación espacial en el plano |
| Bachillerato | Resolver mejor volumen, cubierta, fachadas y acristalamientos | Región 4:25 y fotografía aérea |
| GYM | Sustituir la interpretación como edificio por un parque exterior de ejercicio, con suelo y aparatos al aire libre | Región 4:47; corrección expresa del usuario |

Las medidas y los detalles siguen siendo interpretativos. El modelo no contiene un levantamiento arquitectónico ni una escala de obra comprobada.

## Comparar las entregas

Abre `index.html` o ejecuta `node preview-server.mjs` y visita `http://127.0.0.1:5186/`. El visor utiliza únicamente archivos locales y no instala paquetes ni despliega el prototipo.

La vista general compara la segunda entrega, conservada en `iterations/v2/output/overview.png`, con la actualización en `output/overview.png`. La separación se puede arrastrar, y el control inferior admite teclado. Ambas vistas comparten la proporción de imagen y la cámara base para revisar los cambios de arquitectura y distribución.

Los acercamientos principales de esta entrega son:

- `output/preescolar.png`: cubierta de vidrio y relación con Tienda 1.
- `output/conjunto-bloques.png`: los cuatro bloques y la pieza atravesada posterior.
- `output/bachillerato.png`: volumen, fachadas y cubierta.

La escena anotada está en `output/overview-annotated.svg` y carga `overview.png` desde la misma carpeta. El plano vectorial se consulta en `output/distribution.svg`. Las anotaciones sirven para contrastar zonas; no añaden selección ni funciones al gestor.

## Entrega verificada · 15 de octubre de 2026

Los seis renders finales se generaron correctamente con Blender 4.5.9 LTS, Cycles por CUDA y 96 muestras. Se verificaron los hashes de cada PNG, los cuatro módulos Python y `layout.json` contra el manifiesto: todas las entradas corresponden a la tercera iteración y a las mismas fuentes. La galería queda habilitada con `data-render-ready="true"`.

| Vista | Resolución | Tiempo de render |
| --- | --- | --- |
| General | 3200 × 2200 | 146,38 s |
| Administrativo | 1800 × 1350 | 81,24 s |
| Salones | 1800 × 1350 | 95,79 s |
| Conjunto de bloques | 1800 × 1350 | 97,60 s |
| Preescolar y Tienda 1 | 1800 × 1350 | 68,46 s |
| Bachillerato | 1800 × 1350 | 77,70 s |

La escena contiene 5742 objetos, de los cuales 5200 son mallas, y no presenta errores de materiales o coordenadas en la validación. Los seis encuadres pasan la comprobación de recorte. La cámara general coincide con la de la primera entrega: diferencia máxima de parámetros **0**. El archivo `.blend` se abrió en un proceso independiente y contiene siete cámaras y la imagen institucional empaquetada.

La cubierta en V tiene dos brazos, 74 paneles y una partición sin área omitida entre los brazos; sus seis vértices permanecen dentro de la huella de referencia. El conjunto contiene cuatro bloques y una pieza atravesada. El GYM no tiene muros ni cubierta. Se revisaron visualmente la vista general y los tres acercamientos solicitados. Estas comprobaciones certifican la generación y coherencia interna del prototipo; la fidelidad arquitectónica final queda pendiente de la revisión del usuario.

## Fuentes y criterio espacial

- Plano actualizado adjunto, con el **bloque atravesado** identificado expresamente.
- Fotografía aérea `ArrayanesMap.png` reenviada por el usuario.
- [Frame de Figma 2:2 — Mapa corregido](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2) y extracción conservada en `reference/figma-frame.json`.
- [Recorrido virtual oficial del colegio](https://gimnasiolosarrayanes.com/tour/) e imágenes de las revisiones anteriores como apoyo visual.

El plano corregido guía la distribución aproximada y las correcciones expresas del usuario guían la interpretación de las zonas. La fotografía aporta cubiertas, volúmenes y relaciones visibles, sin resolver por sí sola la escala o la perspectiva. Las cubiertas, alturas, separaciones y elementos de ejercicio se reconstruyen visualmente y quedan sujetos a revisión.

## Alcance y reproducción

El punto de entrada es `build_scene.py`, con sus módulos `refine_scene.py`, `campus_geometry.py` y `corrected_zones.py`, configuración y referencias locales. Las instrucciones de ejecución están en `README.md`. Las versiones anteriores permanecen en `iterations/v1/` y `iterations/v2/` para comparar y regenerar cada entrega con sus propios archivos.

## Criterio geométrico aplicado

- El bloque atravesado usa la región **4:23**, tres niveles y los mismos materiales, fachadas y cubiertas del conjunto de salones. Dos galerías cortas unen su encuentro con los bloques posteriores.
- La cubierta de Preescolar parte de los **seis lados reales de la huella** y conserva la esquina entrante. Dos brazos acristalados comparten el mismo encuentro de cumbrera; su partición cubre todo el polígono de vidrio sin dejar el brazo largo abierto. Los bordes interiores de los techos azules y del ala blanca fijan sus retiros.
- Tienda 1 conserva su orientación y se traslada junto al extremo del ala blanca de Preescolar. La distancia del centro de su cabecera a ese extremo pasa de **12,738 a 1,8 unidades relativas de diseño**; esta medida sirve para comparar la separación y no representa metros comprobados. Una conexión corta de suelo y marquesina resuelve la unión visual.
- Bachillerato recibe un volumen cerrado de tres niveles, frente de vidrio, seis campos azules de cubierta y dos lucernarios. Se elimina el vacío central provisional de la segunda iteración.
- El GYM usa su polígono como superficie abierta, con barras, banco y escalones de ejercicio. No contiene muros ni cubierta de edificio.

Todo permanece en la carpeta independiente de prototipos y en `feature/mapa-isometrico`. Esta revisión no autoriza integración funcional ni cambios de datos. No añade incidencias, selección, paneles o conexiones; no modifica base de datos, endpoints, módulos existentes ni `main`, y no incluye despliegue. La siguiente etapa depende de una nueva aprobación del usuario tras revisar las imágenes.
