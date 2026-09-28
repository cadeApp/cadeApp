# PR #113 · T-124 — Ronda 2

- **SHA funcional revisado:** `32d56c44a67b83de782086e0f9e176490c088d88`
- **Base:** `aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd`
- **Estado:** Draft
- **Resultado:** **CON BLOQUEANTES (2)**
- **Hallazgos R1 cerrados:** H01–H08
- **Hallazgos nuevos:** H09–H10
- **Decisiones humanas pendientes:** 0

## Preflight

- 12 commits adelante de develop y 0 detrás.
- PR mergeable y Draft.
- El autor no modificó `docs/revision-pr/pr-113/**` desde R1.
- Scope funcional R2 contenido en rutas/feature/docs permitidos.

## CI

Final `36355934244`:
- typecheck ✅
- lint ✅
- unit ✅ — 92 archivos / 1225 tests
- build ✅
- audit ✅
- db-tests ✅ — 12 archivos / 1601 tests + db:types sin drift
- bundle-budget ✅ técnicamente, pero con warning por rutas >180 kB.

La fase RED corregida `86f53b5` también es válida: run `36353380524` dejó 8 archivos T-124 / 120 tests rojos mientras 84 archivos / 1102 tests ajenos seguían verdes.

---

## Cierre de H01–H08

### H01/H02 — CERRADOS
CC-012 está mergeado. Matriz D05-A, RLS solo por RPC, pgTAP y mutaciones del contrato fueron verificados en PR #115 R2.

### H03 — CERRADO
No existe `suspendCourierForIncidentAction` ni `adminSuspendCourierRpc` en el flujo. `resolveIncidentAction` usa schema strict y la RPC no recibe `courierId`.

### H04 — CERRADO
Schemas Zod reutilizan el contrato canónico. Tipos salen de `z.infer`; actions revalidan.

### H05 — CERRADO
`trip-report-wiring.test.tsx` renderiza la page real para merchant/courier y observa rol, status, deliveredAt y now reales. Las mutaciones de hardcode documentadas atacan esas aserciones.

### H06 — CERRADO
La feature delega a `admin_list_incidents`. URL/search params conservan `createdAt+id`; los tests recorren páginas con timestamps empatados y microsegundos.

### H07 — CERRADO
Happy path de las tres decisiones comprueba llamada única a `adminResolveIncidentRpc`, payload, resultado y revalidaciones. Actores/AAL/error no ejecutan la mutación.

### H08 — CERRADO
Dialogs reales comprueban Escape/Cancelar y retorno de foco. Loading usa Skeleton con forma de pantalla; error boundaries esconden detalles y llaman `reset()`.

---

## PR113-H09 — BLOQUEANTE

### Falta evidencia visual persistente/enlazada

La bitácora describe una verificación extensa en navegador, pero las capturas quedaron únicamente en la sesión local y el harness fue borrado. El PR no contiene links a las imágenes.

Esto incumple `docs/design/visual-task-directive.md §8`, que exige dejar enlaces a capturas en PR y bitácora antes de pedir review.

### Corrección requerida

Usar el patrón ya aceptado en T-118:

1. recrear el harness temporal sin datos remotos;
2. generar PNG reales de los estados obligatorios;
3. publicarlos en una rama separada, por ejemplo `feat/T-124-visual-assets`;
4. no mergear esa rama a develop;
5. usar links persistentes/raw de GitHub;
6. incrustar/enlazar las capturas en el body de PR #113 y agregar los links en `docs/tasks/log/T-124.md`;
7. borrar el harness de la rama funcional y demostrar que no quedó en el diff.

Como mínimo deben quedar verificables:
- 390 y 360 px del reporte;
- 1280 y 360 px de bandeja;
- detalle;
- los tres Dialogs de resolución;
- loading;
- empty;
- error;
- resuelto;
- una captura con foco visible.

No hace falta capturar datos reales ni usar Supabase remoto. El harness local controlado es válido; lo que falta es persistir la evidencia.

---

## PR113-H10 — BLOQUEANTE

### /trips/[id] agrega +7 kB sobre una ruta ya excedida

Regla 25: rutas comercio/repartidor ≤180 kB First Load JS.

Evidencia:
- fase RED antes del GREEN: `187 kB`;
- final: `194 kB`;
- delta atribuible a T-124: **+7 kB**.

Que el CI quede verde no cierra el hallazgo: el workflow está deliberadamente configurado como warning para deuda histórica.

### Corrección requerida

No ampliar scope para arreglar código histórico de trips.

Optimizar **solo el aporte de T-124** para que `/trips/[id]` vuelva como mínimo a **≤187 kB**; si se puede llevar a ≤180 kB dentro del scope actual, mejor.

Dirección sugerida:
- dejar un trigger cliente mínimo en el bundle inicial;
- diferir también Dialog/lucide/formulario/contratos del flujo de incidentes hasta interacción, no solo RHF/Zod;
- evitar que el barrel público arrastre módulos que no necesita el trigger inicial;
- no importar internals desde `src/app`: conservar la frontera pública de la feature.

Verificar con build/CI real; no estimar.

No tocar `src/features/trips/**`, `src/ui/**`, dependencias ni workflow para conseguir el número. No cambiar el límite ni silenciar el warning.

---

## No hallazgos nuevos

- Route guard de T-122 cubre `/admin/*` con rol admin + AAL2; el detalle no crea bypass.
- No hay escrituras directas/service role.
- Datos del destinatario no aparecen en consultas/UI.
- No se detectó adulteración de H03–H08.
- Las variantes de mutación que no dieron RED están identificadas como tales, no vendidas como evidencia.

## Resultado

**CON BLOQUEANTES (2).**

Corregir H09 y H10 y volver con un SHA publicado + CI completo para Ronda 3. No aprobar ni mergear PR #113 todavía.
