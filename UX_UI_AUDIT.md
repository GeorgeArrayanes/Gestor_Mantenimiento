# Gestor Mantenimiento — auditoría UX/UI

Actualización: 2 de octubre de 2026. Refinamiento de la aplicación existente del Gimnasio Los Arrayanes.

## Auditoría breve

La revisión encontró una base funcional y un rediseño previo ya presentes. La mejora se concentró en composición, legibilidad y carácter institucional.

| Problema observado | Por qué debilitaba el diseño | Mejora aplicada |
| --- | --- | --- |
| Textos y metadatos demasiado pequeños | La información útil perdía peso frente a los contenedores y exigía esfuerzo de lectura. | Escala más clara para títulos, nombres, etiquetas, descripciones y controles. |
| Paleta muy pálida y contraste débil | Jerarquía poco definida y una apariencia fría, uniforme y sin profundidad. | Petróleo profundo, fondos cálidos, menta contenida y estados con texto explícito. |
| Paneles con tratamiento demasiado parecido | El Dashboard parecía una sucesión de tarjetas equivalentes. | Hero fotográfico, métricas integradas, resumen gráfico, caso destacado y columna de catálogos con proporciones distintas. |
| Espacio vacío y separación excesiva | Se necesitaba más desplazamiento para leer pocos registros. | Densidad más compacta, acciones próximas a su contenido y alineaciones consistentes. |
| Directorios con poca diferenciación | Personal, espacios y administradores parecían el mismo listado CRUD. | Tarjetas de personal con iniciales; espacios con dibujos arquitectónicos CSS; administradores con tabla sobria adaptable. |
| Ajustes responsive locales pendientes | Un selector móvil y la ilustración de Portería podían perder claridad. | Selector ajustado, colisión del dibujo corregida y comprobación de las vistas a tres anchuras. |

## Dirección y composición

Las referencias guían las proporciones, la navegación ligera, la fotografía institucional y el ritmo entre módulos. Se adaptaron a los campos y acciones que realmente contiene el producto. No se copiaron personas, cifras, fotografías de habitaciones ni controles sin funcionamiento.

El shell mantiene las rutas y una barra lateral compacta con icono y etiqueta, selección menta, marca superior y administrador inferior. La cabecera conserva el contexto, la cuenta y la acción existente de nueva incidencia. Los fondos cálidos, bordes finos y sombras suaves unen las pantallas sin darles el mismo tratamiento.

El Dashboard reúne la fotografía existente y las métricas Pendientes, Asignadas, Alta sin cerrar y Año escolar dentro del hero. Una columna lateral presenta espacios activos y equipo; los recuentos de trabajo proceden de las incidencias. Debajo aparecen resumen de mantenimiento, incidencia asignada destacada y actividad reciente. El gráfico cuenta todas las incidencias por estado; promedio de solución y cierres del mes se identifican por separado.

## Datos y semántica

Los estados siguen siendo `PENDING`, `ASSIGNED` y `CLOSED`. Alta sin cerrar cuenta incidencias de prioridad `ALTA` cuyo estado no es `CLOSED`. El año mostrado se obtiene de la fecha actual en America/Bogota; no se añade un calendario académico. El promedio mantiene «—» sin datos, «< 1 h» bajo una hora y hasta una décima en los demás valores.

Personal activo significa seleccionable para asignación, sin información de disponibilidad en tiempo real. Espacio activo significa seleccionable en el catálogo. No se inventan último acceso, perfiles fotográficos ni entrega de WhatsApp. Las APIs existentes siguen siendo la fuente de datos.

Se conserva la fotografía aportada. La interfaz usa ahora una copia JPEG del mismo tamaño, 1672 × 941, que baja de 2.515.729 a 431.813 bytes; el PNG original permanece. Los avatares usan iniciales o siluetas y las ilustraciones de espacios son decoración por CSS/iconos. No se añadieron mocks ni semillas al producto.

## Función, integridad y verificación

Rutas, autenticación, permisos, filtros, multipart, evidencias privadas y reglas de asignación/cierre permanecen. La única corrección backend es el literal de firma WhatsApp: «Gimnasio» pasó a «Gimnasio Los Arrayanes» tras documentar el fallo de una prueba. No cambió la preparación manual, el destino ni la codificación. No hubo cambios de esquema ni migraciones.

La ejecución nueva final de `npm test`, a las 15:09 del 2 de octubre en America/Bogota, pasó 133 pruebas: 55 backend y 78 frontend. Un recorrido HTTP aislado comprobó creación, asignación, filtros, evidencias privadas, destino WhatsApp, solución/cierre, permisos y CRUD con desactivación. Usó pool y archivos en memoria, sin modificar los servicios de revisión existentes. El detalle está en `output/review/refinement-functional-verification.md`.

El coordinador revisó acceso, Dashboard, lista de incidencias, Personal, Espacios, Administradores, nueva incidencia y detalle a 1440, 768 y 375 px, sin desbordamiento horizontal. Comprobó login/logout, filtros, búsqueda vacía y limpieza, menú móvil y foco/Escape del diálogo de solución. Abrió los formularios de edición de personal, espacios y administradores con sus datos actuales y los canceló sin guardar. El navegador no registró errores ni advertencias. La revisión visual y sus capturas se documentan en `output/review/refinement-browser-verification.md`; no incluye un recorrido completo de mutaciones desde la interfaz.

Compilación y lint finales: ambos correctos, con salida 0. Vite procesó 1840 módulos; CSS 91,06 kB / 18,27 kB gzip y JavaScript 334,17 kB / 100,52 kB gzip. Son resultados nuevos de este refinamiento, separados de los controles históricos.

La revisión no equivale a una auditoría completa con tecnología de asistencia ni a un despliegue con HTTPS y almacenamiento definitivo.

Git Operations: None.
