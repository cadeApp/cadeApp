# Prompt para agy — T-356 / CC-025 / PR #376 — ronda 2

**Branch:** `fix/CC-025-onboarding-compatible`; **HEAD funcional revisado:** `11e2c7750ce037df022e74ed53bbd065a5dd2a66`. **Resultado:** H02/H03 corregidos por código+CI, H01 **BLOQUEADO** a la espera de decisión humana específica. Fase A (#374) mergeada; C (#364) y T-356 (#358) NO se mergean todavía.

## 0. Sincronización
`git fetch origin && git switch fix/CC-025-onboarding-compatible && git pull --ff-only origin fix/CC-025-onboarding-compatible && git status --short`. Incorporá el commit de revisión que contiene `docs/revision-pr/pr-376/revisiones/ronda-2.md`. **No rebase, force ni amend. No modificar `docs/revision-pr/**`.** Leer informe y `evidencia/ronda-2.md`, `docs/contracts/CC-025.md`, ficha T-356 desde develop y workflow de migraciones.

## 1. H02 y H03: NO rehacer reparaciones
- Conservar `validateCurrentDocumentSet` y chequeo inicial de status `submitted|verified` para mismo path; `rejected` devuelve VALIDATION_ERROR.
- Conservar post-INSERT, recuperación 23505/42501 y tests o–s más helper: rutas, status, faltantes, duplicados; `couriers.update` sólo tras validar.
- Los GREEN de Vitest no son un RED de DB transaccional. No afirmar verificación independiente. Si se modifica código, exigir nuevos RED→GREEN del comportamiento efectivamente modificado.
- **Corrección menor por revisor:** la descripción ya no afirma DB pre-A compatible. No reintroducirlo.

## 2. H01: dejar bloqueado hasta decisión de Lautaro073
- `UNIQUE(storage_path)` no evita dos rows diferentes del mismo kind. El control actual no es transaccional.
- No crear SQL/RPC, migraciones, policies, índices, grants, tipos DB ni `.github/**` SIN autorización de ampliación de CC. No convertir el test unit `n` en supuesta prueba multisesión.
- Recomendación técnica A: B0 aditiva transaccional sobre `couriers(profile_id) FOR UPDATE` y revalidación completa del conjunto, probada con dos conexiones, **con control de convivencia**: los INSERT directos/legacy no necesariamente respetan esa serialización. Antes de decir que resuelve la unicidad global, mostrar gate/guard efectivo contra writer anterior y cliente REST. Otras opciones y riesgos están en `revisiones/ronda-2.md`.
- Si Lautaro073 AUTORIZA A, primero revisar su texto preciso y scope. Abrir PR B0 separada nacida de develop, no importar la migración final de #364. Migración por `pnpm supabase migration new ...` y timestamp posterior a A, jamás editar ya aplicadas. `SECURITY DEFINER` sólo si estrictamente necesario, role/auth check y `search_path` fijo; EXECUTE revocado de PUBLIC y anon, permitir únicamente authenticated conforme matriz. Tests pgTAP de actor propio/ajeno/sin sesión, permisos, campos forjados, rollback, E2E/HTTP en entorno autorizado. Runner real con dos sesiones **paths iguales y distintos**; mutar `FOR UPDATE` en SQL original RED y restaurarlo GREEN, sin tests adulterados. Vincular a issue #363 con autorización explícita y no cerrar el CC.
- Fase B no se puede considerar lista para merge con H01 abierto. Tras B0 integrado y esquema efectivamente aplicado donde corresponda, conectar la app B a la nueva operación atómica, eliminar aceptación indebida del viejo flujo y revisar la PR otra vez. Conservar compatibilidad A→B→C.

## 3. Entrega de lo autorizado ahora
**Archivos editables hoy:** ninguno de código por requerimiento de esta ronda; únicamente `docs/tasks/log/T-356.md` y `docs/contracts/CC-025.md` si necesitan reflejar la decisión cuando Lautaro073 la dé. Ninguna dependencia, nuevo mock o suite permitido para hacer verde un control falso.

Cuando haya decisión, presentar al revisor: plan de rollout con versiones de código y migración por ambiente; contenido SQL y pruebas reales de B0, resultados RED→GREEN con tests intactos, `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, CI db-tests, types, `git diff --check`, `git merge-tree --write-tree origin/develop HEAD`, `node docs/revision-pr/analizar.mjs verificacion`, `git status --short`, `git ls-remote origin fix/CC-025-onboarding-compatible`; commit, push, pedir ronda 3. No tocar `docs/revision-pr/**` ni prometer despliegues.

**PROHIBIDO:** tests falsos o adulterados, mocks, fixtures, aserciones, snapshots, .skip/.only, gates rebajados, migraciones anteriores, service-role bypass, publicar SQL remoto, aprobar/mergear #376/#364/#358, cerrar issue #363, ni fingir autorizaciones/ejecuciones.