# Ronda 1 — PR #206 / T-327

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `def425a082e8b769b9a518feb9f705dae67ade72`  
**Resultado:** **CON BLOQUEANTES (6)**

## Qué se verificó

- PR #206 de Lautaro073, base `develop`, head `def425a082e8b769b9a518feb9f705dae67ade72`.
- Compare contra develop: ahead 1 / behind 0.
- CI #865 / run `36974328286`: GREEN completo.
- Vercel `cadeapp-develop`: deployment del SHA exacto READY.
- La URL Preview del SHA devuelve actualmente **302 / Vercel Authentication** en `/api/health`.
- La documentación oficial de Vercel confirma `repository_dispatch` y los eventos `vercel.deployment.ready/success`, con payload que incluye `git.sha`, `project.id`, `id` y `url`.
- Issue #205 está `open`, asignada a Lautaro073 y etiquetada `P1 · fase-3 · en-curso`.

## Decisiones P1

Las decisiones 1-A, 2-A, 3-A, 4, 5-A y 6-A quedaron registradas en #205 antes de cerrar la ronda.

## BLOQUEANTES

### PR206-H01 — La PR implementa T-327 pero está entregada como T-303 y no crea los artefactos canónicos de T-327

**Severidad:** alto · **Categoría:** alcance/proceso  
**Dónde:** título/body de PR #206; `docs/tasks/T-303.md:79+`; `docs/tasks/log/T-303.md:500+`; ausencia de `docs/tasks/T-327.md`, `docs/tasks/log/T-327.md` y T-327 en `docs/implementation-plan.md`.

Issue #205 define T-327 como tarea independiente y exige ficha, bitácora y fila de plan. La rama, en cambio, se presenta como `[T-303]`, modifica la ficha/bitácora de T-303 y no crea ninguno de los tres artefactos de T-327. Esto deja la infraestructura sin fuente de verdad propia y mezcla el histórico de una tarea funcional distinta.

**Qué debe pasar:** revertir únicamente los agregados T-327 hechos dentro de `docs/tasks/T-303.md` y `docs/tasks/log/T-303.md`; crear `docs/tasks/T-327.md`, `docs/tasks/log/T-327.md`, agregar T-327 al final de Fase 3 en `docs/implementation-plan.md` con primer DoD idéntico; renombrar PR/body a T-327 y usar `Refs #205` (no `Closes #205`, por decisión 3-A). La excepción issue-first de esta tarea queda documentada como decisión P1; no inventar que la ficha ya existía en develop.

### PR206-H02 — El helper nuevo introduce `any` prohibido por las reglas raíz

**Severidad:** alto · **Categoría:** calidad  
**Dónde:** `.github/workflows/e2e-preview-target.mjs:53,132`

Se introducen `Record<string, any>` y `any[]`. `AGENTS.md §4` prohíbe `any` y la skill lo clasifica como bloqueante.

**Qué debe pasar:** reemplazar ambos por `unknown` + narrowing/typedefs concretos. No silenciar ESLint/TypeScript ni convertirlo en casts equivalentes a `any`. Los tests de payload malformado deben seguir verdes y una mutación que quite el narrowing debe dejar un test rojo.

### PR206-H03 — Las reglas operativas siguen diciendo que develop usa Supabase Staging

**Severidad:** alto · **Categoría:** seguridad/contrato operativo  
**Dónde:** `AGENTS.md §6`, `.agents/rules/00-confianza-y-seguridad.md`, `e2e/AGENTS.md`

El código nuevo crea Supabase Develop separado, pero las reglas todavía autorizan/descríben `feat/* + develop + staging` contra `cadeapp-staging` y E2E “contra staging”. Eso haría que la próxima tarea reciba instrucciones contradictorias y puede dirigir operaciones al proyecto equivocado.

**Decisión P1 6-A:** T-327 queda autorizada a actualizar únicamente esos tres documentos para reflejar el nuevo esquema. Deben conservarse las prohibiciones de producción/secrets/comandos administrativos y aclarar que Preview/Develop usa Supabase Develop, mientras staging conserva Supabase Staging.

### PR206-H04 — El GitHub Environment `develop` contiene secretos privilegiados pero actualmente no restringe ramas

**Severidad:** crítico · **Categoría:** seguridad CI  
**Dónde:** configuración externa GitHub → Environments → develop.

La evidencia aportada por P1 muestra **Deployment branches and tags: No restriction**, mientras el mismo Environment contiene `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `DNI_HMAC_SECRET`, `CRON_SECRET` y otros secretos. Con esa configuración, un workflow de una rama interna podría solicitar `environment: develop` directamente; la protección no debe depender solo de que el workflow “bueno” viva en develop.

**Qué debe pasar antes del merge:** configurar el Environment `develop` para aceptar únicamente la rama `develop` (custom deployment branch/tag rule exacta). El `repository_dispatch` sigue ejecutándose en el contexto de la rama por defecto y el job confiable puede usar el Environment. Actualizar el runbook: esto es requisito de seguridad, no una mera recomendación.

### PR206-H05 — Falta `SUPABASE_DEVELOP_PROJECT_REF` y el propio merge dispararía `migrate-develop`

**Severidad:** alto · **Categoría:** configuración/CI  
**Dónde:** `.github/workflows/migrate.yml:18+`; `.github/workflows/e2e-preview.yml:82+`; configuración externa GitHub Environment `develop`.

El código falla cerrado si `SUPABASE_DEVELOP_PROJECT_REF` no existe. P1 confirmó decisión 2-A: crear esa variable no secreta. Al mergear esta PR a `develop`, el nuevo trigger de `migrate.yml` corre inmediatamente, por lo que no es un detalle post-merge: sin la variable la primera migración de Develop nace roja.

**Qué debe pasar antes del merge:** P1 agrega `SUPABASE_DEVELOP_PROJECT_REF` al Environment `develop` y confirma que el `SUPABASE_ACCESS_TOKEN` ya usado por CI tiene acceso al proyecto Develop. Claude no debe leer ni escribir valores secretos.

### PR206-H06 — El DoD promete “sin cancelar una corrida por otra”, pero GitHub concurrency no puede garantizarlo

**Severidad:** medio · **Categoría:** contrato/evidencia  
**Dónde:** issue #205 DoD; `docs/runbooks/e2e-preview.md:86-89`.

La propia rama documenta correctamente que GitHub conserva como máximo una corrida running y una pending por grupo y que una tercera puede reemplazar la pending. Eso contradice literalmente el DoD original.

**Decisión P1 5-A:** se acepta esa limitación. No implementar FIFO propia. La ficha T-327 y el plan deben formular el criterio real: grupo global compartido, `cancel-in-progress: false`, status cancelado/error y re-run soportado; no prometer que nunca habrá reemplazo de pending.

## No bloqueante / residual decidido

- **Vercel Authentication:** el Preview exacto hoy responde 302. P1 eligió 1-A: desactivar Authentication solo para Preview. Por decisión 3-A esto no impide necesariamente mergear la infraestructura una vez corregidos los bloqueantes, pero #205 NO se cierra hasta un `e2e-preview` real GREEN.
- **Primer evento real:** aún no hay corrida de `e2e-preview` porque el workflow no existe en default branch hasta el merge. Eso es compatible con 3-A.
- **Branch protection de develop:** la rama `develop` está actualmente sin protección requerida. Esta ronda no convierte eso en requisito de T-327; el estado `e2e-preview` sigue siendo evidencia operativa para la decisión humana de merge.

## Checks de esta ronda

CI exacto `def425a082e8b769b9a518feb9f705dae67ade72`:
- typecheck ✅
- lint ✅
- build ✅
- audit ✅
- bundle-budget ✅
- Vitest 110/110 archivos · 1627/1627 tests ✅
- workflow behavior tests 45/45 ✅
- ADR 6/6 ✅
- db-tests: Files=13 · Tests=1621 · PASS ✅

No se ejecutó una mutación independiente local del reviewer; las mutaciones declaradas por el autor no se toman como verificación independiente. La ronda se cierra con inspección del SHA remoto, CI exact-head, configuración GitHub aportada por P1 y comprobación real del Preview en Vercel.

## Resultado

**CON BLOQUEANTES (6).** No aprobar ni mergear. Después del arreglo, revisar un SHA nuevo y verificar especialmente: T-327 canónica, eliminación total de `any`, reglas de entorno actualizadas, configuración manual previa al merge y CI exact-head.
