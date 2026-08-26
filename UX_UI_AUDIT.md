# Auditoría UX/UI y cierre de implementación — Gestor Rutas

Fecha de validación: 26 de agosto de 2026  
Entorno auditado: producción y versión local corregida  
Roles revisados: Administrador y Conductor

## Alcance

Se recorrieron login, dashboards, creación y listado de novedades, detalle y flujo de reparación, buses, ficha de bus, conductores y notificaciones. La matriz responsive incluyó 1440, 1280, 1024, 768 y 390 px. También se revisaron teclado, foco, modales, estados loading/error/empty, validación, permisos y reglas de integridad.

La auditoría en navegador no creó registros, no cambió estados y no marcó notificaciones como leídas.

## Resultado ejecutivo

La aplicación conserva la dirección visual editorial en blanco, negro y gris, pero deja de depender de una maqueta rígida. Los fallos críticos de desbordamiento, overlays, sesión e integridad quedaron corregidos. La versión local fue revalidada con ambos roles y no presentó desbordamiento horizontal en los recorridos probados.

## Evidencia antes y después

| Caso | Antes en producción | Después en local |
|---|---|---|
| Login a 768 px | Dos columnas de ~288/378 px | Una columna, tarjeta de 700 px |
| Login a 390 px | CTA terminaba en y=879 | CTA termina en y=617 |
| Nuevo reporte a 390 px | Documento de 573 px por radios invisibles | Documento de 375 px; radios contenidos en 1×1 px |
| Novedades a 390 px | Tabla mínima de 780 px | Tarjetas de 301 px con etiquetas por campo |
| Progreso a 390 px | Documento de 463 px y pasos sin texto | 337 px, nombres visibles y paso actual anunciado |
| Modal móvil | Sin diálogo, Escape ni foco; podía salir del viewport | `role=dialog`, foco contenido, Escape, retorno y borde inferior en y=844 |
| Drawer móvil → escritorio | Podía conservar `overflow:hidden` sin controles | Se cierra, restaura scroll y enfoca contenido |
| Ficha del bus | Mostraba `Invalid Date` | Fecha válida en `<time datetime>` |
| Filtros | Cinco controles sin nombre | Cinco nombres accesibles, conteo y limpiar filtros |

## Hallazgos priorizados y estado

### Críticos

- **Resuelto — Responsive:** radios invisibles, login tablet/móvil, progreso y tabla ya no ensanchan el documento.
- **Resuelto — Overlays:** drawer y modales gestionan semántica, Escape, foco, retorno, scroll y cambio de breakpoint.
- **Resuelto — Sesión:** un `401` limpia globalmente la sesión y permite volver al login sin quedar atrapado en rutas protegidas.
- **Resuelto — Integridad conductor/bus:** la API sólo acepta conductores activos, bloquea reasignaciones con novedades abiertas e impide inactivar cuentas todavía comprometidas.
- **Resuelto — Estado del bus:** crear/cerrar novedades preserva mantenimiento y fuera de servicio; sólo alterna `OPERATIVO ↔ CON_NOVEDADES` cuando corresponde.
- **Resuelto — Reparación:** enviar a validación queda bloqueado hasta guardar evidencia del ciclo actual.
- **Resuelto — Seguridad del login:** se retiraron las credenciales administrativas precargadas del código local.

### Importantes

- **Resuelto:** filtros con nombre, peticiones cancelables, error recuperable, conteo y limpieza.
- **Resuelto:** tabla móvil en tarjetas, `caption`, encabezados y acciones de 44 px.
- **Resuelto:** `Invalid Date`, detección de PDF y validación de archivos/fecha.
- **Resuelto:** doble envío en buses/conductores y feedback de pending.
- **Resuelto:** loading/error/empty y toast anunciables; notificaciones distinguen “Sin leer” semánticamente.
- **Resuelto:** Activo/Inactivo ya no reutiliza vocabulario operativo de buses.
- **Resuelto:** títulos por ruta, foco al contenido y progreso con `aria-current`.
- **Resuelto:** contador de notificaciones no leídas calculado sobre todo el conjunto, no sólo las últimas 50.

### Mejoras aplicadas

- Valores neutrales en bus, tipo y urgencia del nuevo reporte.
- Errores asociados a campos y foco en el primer campo inválido.
- Límite de cinco archivos comunicado sin truncado silencioso.
- Cancelación explícita con aviso de cambios sin guardar en el reporte.
- Formateador común para tipos de daño y fechas.
- Enlace desde la ficha del bus a sus novedades filtradas.
- Contraste, microtipografía, wrapping y targets táctiles reforzados.
- Estados de carga fallida con reintento en las pantallas principales.

## Decisiones de producto pendientes

1. **Modelo de estado del bus:** la protección actual evita sobrescrituras incorrectas, pero la solución ideal es separar en base de datos el estado técnico manual del indicador derivado de novedades.
2. **Garantía en base de datos:** la API cubre la relación “conductor activo”, pero una restricción entre tablas requeriría trigger o rediseño de esquema.
3. **Notificaciones en tiempo real:** el conteo es correcto y se refresca al navegar; polling, WebSocket o push siguen siendo una mejora futura.
4. **Protección de borradores:** el reporte avisa antes de salir; los modales aún podrían incorporar confirmación de cambios sin guardar.
5. **Regresión visual automatizada:** conviene añadir capturas comparativas y pruebas de accesibilidad automatizadas en CI.

## Verificación final

- Backend: 14 pruebas aprobadas.
- Frontend: 6 pruebas aprobadas.
- Build Vite de producción: aprobado.
- `git diff --check`: aprobado, sin errores de whitespace.
- Navegador local: ambos roles, rutas protegidas, 1440/1280/1024/768/390 px, filtros, modales, estados vacíos y validación.
