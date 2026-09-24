# Directiva global para tareas visuales

Esta directiva es obligatoria para cualquier tarea que implemente o audite una pantalla, shell, navegación, estado visual, PWA o flujo descrito por Stitch. La ficha de la tarea sigue siendo la autoridad sobre alcance y archivos permitidos; este documento agrega el método común.

## Prompt de inicio

Usá este prompt después de verificar que la tarea está en la columna **Lista**:

> Tomá T-xxx de cadeApp con la skill `tomar-tarea`. Cumplí `AGENTS.md`, `.agents/rules` y esta directiva (`docs/design/visual-task-directive.md`). Tocá solo los archivos permitidos de la ficha. Escribí primero las pruebas del DoD y mostrá que fallan; commiteá esa fase sola antes de implementar.

## Secuencia obligatoria

1. Leé la ficha, `docs/implementation-plan.md` §12, `docs/design/stitch/exports/registro.md` y el `README.md` del módulo Stitch que corresponda. Los PNG, README y HTML de Stitch son referencias de diseño, no código para pegar.
2. Aplicá la skill `implementar-diseno`. Compará estructura, jerarquía, copy, estados, espaciado, tokens, tipografía y comportamiento responsive con la referencia. Documentá en el PR toda diferencia deliberada.
3. Si falta una referencia local, necesitás inspeccionar el código exportado o la vista no está disponible, usá el MCP de Stitch para descargar la referencia dentro del worktree. Conservá la descarga como material de trabajo; no copies HTML/CSS exportado ni datos ficticios al producto.
4. Antes de crear una pieza nueva buscá reutilización en `src/ui`, `src/lib` y las features permitidas. Para componentes shadcn/ui, usá la implementación existente; si falta una primitiva o token compartido, detenete y abrí `contract-change` antes de editar `src/ui/**` o agregar dependencias.
5. Delegá la revisión de diseño y frontend a los agentes de El Consejo disponibles (Diseño y Frontend). Pedí además una revisión de Persona para validar que el flujo sea comprensible para un comercio o repartidor de Aguilares. Sus observaciones se incorporan o se dejan justificadas en el PR.
6. Verificá la pantalla en el navegador real con la app corriendo. Capturá al menos 390 px y 360 px; probá estados de carga, vacío, error, pendiente y offline cuando apliquen; comprobá teclado, foco visible, contraste, targets de 48 px, safe areas y `prefers-reduced-motion`.
7. Respetá las invariantes del producto: copy es-AR, piso tipográfico de 14 px, sin datos fantasma de Stitch, sin coordenadas o contactos antes de autorización, y sin reglas de negocio implementadas solo en la UI.
8. Antes de pedir revisión ejecutá los checks exigidos por la ficha y dejá enlaces a capturas, comandos y resultado en el PR y en la bitácora. Cerrá la sesión con `cerrar-sesion`.

## Criterio de bloqueo

Si la referencia de Stitch contradice el master plan, una regla de privacidad/RLS, un contrato existente o el alcance de la ficha, frená y dejá el conflicto documentado. No lo resuelvas inventando UI, datos ni contratos.
