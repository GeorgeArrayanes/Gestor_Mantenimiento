# Arrayanes · Fase 1, iteración visual 04

Esta revisión se concentra en tres correcciones visuales de la escena, conservando la cámara isométrica base, la dirección artística y la distribución general. No amplía el prototipo a funciones o datos del gestor.

## Cambios a revisar

| Zona | Corrección solicitada | Qué comprobar en la imagen |
| --- | --- | --- |
| Cancha de fútbol | Disponer horizontalmente su eje largo | Porterías en los extremos cortos y línea de medio campo transversal al eje largo |
| Conjunto de salones | Separar claramente el bloque atravesado de los bloques superiores | Un vacío legible entre las piezas, manteniendo la coherencia del conjunto |
| Lateral de Preescolar | Sustituir la retícula pequeña por dos ventanales amplios | Dos paños principales de vidrio con una lectura limpia del lateral |

Bachillerato conserva el desarrollo de la tercera iteración. También se mantienen el GYM como parque exterior de ejercicio, la cubierta en V y la cercanía de Tienda 1 a Preescolar. Esos elementos forman parte del contexto conservado y no se presentan como cambios nuevos de esta revisión.

## Comparativa visual

La galería `index.html` compara la vista general de la **iteración 3**, en `iterations/v3/output/overview.png`, con la actual de `output/overview.png`. La separación se puede arrastrar; el control inferior también funciona con teclado. A la izquierda del recorrido del control se descubre la versión actual completa y a la derecha, la anterior.

Las tres tarjetas principales abren:

- `output/overview.png`: la cancha de fútbol dentro de la vista general. Esta tarjeta no se presenta como un render de acercamiento independiente.
- `output/conjunto-bloques.png`: el conjunto de salones y la separación de la pieza atravesada.
- `output/preescolar.png`: los dos ventanales amplios del lateral.

La escena identificada se consulta en `output/overview-annotated.svg`, junto a su imagen de base `overview.png`; el plano vectorial está en `output/distribution.svg`. Las anotaciones sirven para revisar la relación entre zonas y no incorporan interacción del aplicativo.

## Ajustes geométricos aplicados

- **Fútbol:** se conserva la huella verde. Las marcas ahora usan el eje largo horizontal: medio campo transversal, círculo central, áreas grandes y pequeñas en los extremos izquierdo y derecho, con sus respectivas porterías. Se retiran las marcas que orientaban el juego de arriba abajo y las porterías duplicadas del paisaje.
- **Bloques superiores:** se retrasa únicamente el testero posterior de cada bloque en 3 unidades relativas y se abre cada uno hacia su lado exterior en 0,55 unidades. La pareja delantera mantiene su posición. La pieza atravesada se desplaza 2,25 unidades hacia atrás y se acorta un 7 %, conservando su anchura, materiales y niveles.
- Las envolventes de las cubiertas quedan separadas **3,439 y 3,107 unidades** respecto al atravesado. Las galerías quedan separadas **2,474 y 2,273 unidades**; entre las galerías de los dos bloques superiores quedan **2,048 unidades**. Dos pasos estrechos y sin cubierta unen las nuevas caras, conservando una lectura separada de los tejados. Son unidades de diseño aproximadas, no metros comprobados.
- **Preescolar:** el exterior del ala blanca que mira al patio recibe exactamente dos conjuntos acristalados grandes, de dos alturas, separados por un paño blanco central. Cada uno tiene un único montante fino central. La fachada interior del atrio y el vidrio de la cubierta en V conservan su tratamiento anterior.

## Entrega verificada · 15 de octubre de 2026

Los seis renders finalizaron correctamente en Blender 4.5.9 LTS, Cycles por CUDA y 96 muestras. Los hashes de todos los PNG, los cuatro módulos Python y `layout.json` coinciden con su manifiesto y pertenecen a la cuarta iteración. La galería queda habilitada con `data-render-ready="true"`.

| Vista | Resolución | Tiempo de render |
| --- | --- | --- |
| General | 3200 × 2200 | 92,60 s |
| Administrativo | 1800 × 1350 | 41,61 s |
| Salones | 1800 × 1350 | 43,13 s |
| Conjunto de bloques | 1800 × 1350 | 41,92 s |
| Preescolar | 1800 × 1350 | 34,99 s |
| Bachillerato | 1800 × 1350 | 40,41 s |

La escena contiene **5631 objetos** y **5098 mallas**, sin errores de materiales ni coordenadas. Los seis encuadres pasan la comprobación de recorte y la cámara general coincide con la primera entrega, con diferencia máxima de parámetros **0**. La escena nativa abrió en un proceso independiente con siete cámaras, la imagen institucional empaquetada, dos conjuntos grandes de vidrio en el lateral y cuatro postes de portería.

Se inspeccionaron visualmente la vista general y los finales de bloques y Preescolar. Las comprobaciones de separación y orientación están registradas en `geometry-review.json`; la verificación de archivos y cámaras queda en `delivery-verification.json`. Los renders previos rápidos `preview-*` no forman parte de la entrega final.

Los archivos de la tercera iteración se comprobaron contra sus hashes y permanecen en `iterations/v3/`. Las proporciones y medidas continúan siendo aproximadas; no constituyen un levantamiento arquitectónico. La revisión visual del usuario sigue siendo el punto de parada de esta fase.

## Referencias

- Correcciones expresas del usuario para esta cuarta revisión, conservadas en `reference/iteration-4-correcciones.png`.
- Plano actualizado del campus y fotografía aérea `ArrayanesMap.png` aportados en la conversación.
- [Frame de Figma 2:2 — Mapa corregido](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2) y extracción conservada en `reference/figma-frame.json`.
- [Recorrido virtual oficial](https://gimnasiolosarrayanes.com/tour/) e imágenes previas como apoyo arquitectónico.

El plano guía la distribución aproximada; las correcciones del usuario precisan la interpretación. Alturas, separaciones, acabados y detalles reconstruidos contienen decisiones visuales y quedan sujetos a revisión.

## Archivos y reproducción

`build_scene.py` es el punto de entrada. Debe permanecer junto a los otros tres módulos Python —`refine_scene.py`, `campus_geometry.py` y `corrected_zones.py`—, `layout.json` y `reference/`. Las instrucciones de regeneración y del visor local están en `README.md`. No se requieren dependencias externas a Blender.

Las entregas anteriores están conservadas en `iterations/v1/`, `iterations/v2/` e `iterations/v3/`, cada una con sus propios archivos para comparar y regenerar sin mezclar versiones.

El alcance permanece en `prototypes/campus-map/` y en `feature/mapa-isometrico`: revisión exclusivamente visual, sin integración funcional, selección, paneles o datos reales. No incluye cambios de base de datos, endpoints, incidencias, módulos existentes, `main` ni despliegues. El punto de parada sigue siendo la revisión de las imágenes por el usuario.
