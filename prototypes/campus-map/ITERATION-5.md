# Arrayanes · Fase 1, iteración visual 05

Esta revisión se concentra en dos cambios: la altura del bloque atravesado y una segunda cancha de fútbol junto al GYM. Mantiene la cámara isométrica base, la dirección artística y el resto del campus de la cuarta entrega. Continúa siendo exclusivamente visual.

## Cambios a revisar

| Zona | Ajuste solicitado | Qué comprobar en la imagen |
| --- | --- | --- |
| Bloque atravesado, 4:23 | Dos pisos y una altura total del 45,17 % de la cuarta versión | Una pieza claramente más baja que los cuatro bloques, con dos niveles legibles |
| Accesos al bloque atravesado | Retirar los conectores elevados y mantener conexión peatonal en el terreno | Ausencia de puentes o pasos altos hacia la pieza baja |
| Zona verde 4:43 | Segunda cancha de fútbol vertical, inmediatamente a la izquierda del GYM | Un campo completo con porterías en sus extremos y marcas acordes a su eje vertical |

La cancha horizontal de **4:9** se conserva; la entrega debe mostrar dos canchas. Preescolar y los cuatro bloques de salones mantienen su geometría de la cuarta revisión. Bachillerato, el GYM exterior y Tienda 1 forman parte del contexto conservado y no son nuevos cambios de esta iteración.

La comparación de los archivos `.blend` registra una cota máxima de **4,80** frente a **10,36** en la cuarta versión: **46,33 %** de la cota anterior. La altura total de su envolvente, incluyendo el cambio de cota mínima de la base, queda al **45,17 %**. Son dos plantas compactas. Las unidades son relativas y no equivalen a metros comprobados.

La lectura independiente de las escenas archivada y actual también confirma que los cuatro bloques de salones, Preescolar y la cancha horizontal conservan exactamente los mismos vértices, curvas y materiales asignados. El bloque bajo ya no tiene conexiones elevadas; quedan dos pasos peatonales en el terreno. Estos resultados están en `output/iteration-5-native-check.json`.

## Comparar las entregas

`index.html` compara la vista general de la **iteración 4**, conservada en `iterations/v4/output/overview.png`, con la actualización en `output/overview.png`. La separación se puede arrastrar y el control también admite teclado. Moverlo a la izquierda descubre la imagen actual completa; a la derecha, la anterior.

Las dos tarjetas principales abren:

- `output/overview.png`: ambas canchas en el contexto del campus; no se presenta como un acercamiento independiente.
- `output/conjunto-bloques.png`: proporción y dos niveles del bloque atravesado, junto a los cuatro bloques existentes.

La entrega incluye seis vistas finales: una general y cinco acercamientos. `preescolar.png`, `bachillerato.png`, `administrativo.png` y `salones.png` son vistas auxiliares. El manifiesto registra sus parámetros. Los previews `preview-*` no constituyen la entrega final.

La escena identificada se consulta en `output/overview-annotated.svg`, junto a `overview.png`. El plano vectorial está en `output/distribution.svg`. Las anotaciones ayudan a contrastar zonas y no añaden interacción del gestor.

## Entrega verificada · 15 de octubre de 2026

Los seis renders terminaron correctamente con Blender 4.5.9 LTS, Cycles por CUDA y 96 muestras. Los hashes de cada PNG, los cuatro módulos Python y `layout.json` coinciden con su manifiesto y pertenecen a la quinta iteración. La galería queda habilitada con `data-render-ready="true"`.

| Vista | Resolución | Tiempo de render |
| --- | --- | --- |
| General | 3200 × 2200 | 99,97 s |
| Administrativo | 1800 × 1350 | 39,91 s |
| Salones | 1800 × 1350 | 43,36 s |
| Conjunto de bloques | 1800 × 1350 | 41,82 s |
| Preescolar | 1800 × 1350 | 33,67 s |
| Bachillerato | 1800 × 1350 | 39,66 s |

La escena contiene **5437 objetos** y **4897 mallas**, sin errores de materiales ni coordenadas. Los seis encuadres pasan la comprobación de recorte. La cámara general coincide con la primera entrega: diferencia máxima de parámetros **0**. La escena nativa abrió correctamente con siete cámaras y la imagen institucional empaquetada.

La comparación nativa confirma dos niveles en el bloque atravesado, ningún conector elevado, dos canchas completas y conservación de los otros cuatro bloques, Preescolar y el campo horizontal. Se inspeccionaron visualmente la vista general y el acercamiento del conjunto de bloques. La verificación de finales está en `output/delivery-verification.json` y la comparación de geometría en `output/iteration-5-native-check.json`.

La cuarta versión queda conservada en `iterations/v4/`. La fidelidad arquitectónica y la disposición final siguen sujetas a la revisión visual del usuario.

## Fuentes y criterio espacial

- Correcciones expresas del usuario para esta quinta revisión.
- Plano actualizado del campus y fotografía aérea `ArrayanesMap.png` aportados en la conversación.
- [Frame de Figma 2:2 — Mapa corregido](https://www.figma.com/design/Zt2AMEOoZ1mEOJHvdEKsom?node-id=2-2) y extracción conservada en `reference/figma-frame.json`.
- [Recorrido virtual oficial](https://gimnasiolosarrayanes.com/tour/) e imágenes anteriores como apoyo arquitectónico.

El plano y las correcciones del usuario fijan la relación aproximada entre las zonas. Alturas, separaciones, materiales y detalles contienen interpretación visual; la escena no es un levantamiento arquitectónico.

## Archivos y reproducción

El punto de entrada es `build_scene.py`, junto a los módulos `refine_scene.py`, `campus_geometry.py` y `corrected_zones.py`, `layout.json` y `reference/`. Son cuatro módulos Python que deben permanecer juntos. Las instrucciones de regeneración y del visor local están en `README.md`; no se requieren dependencias externas a Blender.

Las entregas anteriores están conservadas en `iterations/v1/`, `iterations/v2/`, `iterations/v3/` e `iterations/v4/`, cada una con sus propios archivos para comparar y regenerar sin mezclar versiones.

El alcance permanece en `prototypes/campus-map/` y `feature/mapa-isometrico`: revisión visual local, sin integración funcional, selección, paneles o datos reales. No incluye cambios de base de datos, endpoints, incidencias, módulos existentes, `main` ni despliegues. El punto de parada sigue siendo la revisión de las imágenes por el usuario.
