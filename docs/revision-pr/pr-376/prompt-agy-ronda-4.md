# Prompt para agy — PR #376 / Fase B / CC-025 — Ronda 4 sin bloqueantes nuevos

**Rama:** `fix/CC-025-onboarding-compatible` · **Código auditado:** `9e194c346baa4366c402684cbc909a1cfb3445cf` · **Resultado:** arreglos R01/R02 comprobados por inspección y GitHub CI trusted; NO hay nuevos fixes funcionales pedidos.

**0. Actualizá tu worktree:** `git fetch origin && git switch fix/CC-025-onboarding-compatible && git pull --ff-only origin fix/CC-025-onboarding-compatible && git status --short`. El commit de la revisión agregará `docs/revision-pr/pr-376/revisiones/ronda-4.md`. Leerlo y no modificar `docs/revision-pr/**`. **No rebase, force-push ni amend.**

**1. Único pendiente operativo:** La rama figuró **2 commits behind develop** al revisarla. Ejecutar `git fetch origin && git merge origin/develop`; resolver solo conflictos reales, si los hubiera. En `docs/tasks/T-356.md` prevalece develop, sin inventar scope. No editar código funcional, tests, migraciones, RLS, backend, `.github/**`, `src/domain/**` ni fixtures para lograr verde. Si aparece conflicto de lógica fuera de los archivos de la tarea, reportar el detalle y no resolverlo a ciegas.

**2. Revalidación luego del merge:** `pnpm typecheck && pnpm lint && pnpm test && pnpm build`; `git diff --check`, `git merge-tree --write-tree origin/develop HEAD`, `node docs/revision-pr/analizar.mjs verificacion`, `git status --short`, `git ls-remote origin fix/CC-025-onboarding-compatible`. Push del merge con commit regular, no force. Esperar CI `unit,db-tests,typecheck,lint,build,audit,bundle-budget,approval-policy` y **trusted E2E `e2e-preview=success` sobre el HEAD final**. No reutilizar runs 38946283341/38946438099 como si validaran un SHA nuevo.

**3. Riesgos que NO se cierran con B:** RPC B0 protege a sus callers pero REST legacy puede insertar otro path hasta C. No afirmar unicidad global ni comenzar C prematuramente. Debe verificarse writer B desplegado y sin tráfico legacy antes de aplicar índice único y políticas finales de #364.

**4. Entrega:** Registrar bitácora con HEAD final, resultado de merger, links de CI y E2E, sin marcar hallazgos como verificados por el autor. Pedir una **verificación corta de checks del nuevo HEAD**, sin abrir otra ronda de código si el diff propio sigue igual. Lautaro073 decide merge de #376; no lo hagas por tu cuenta. #364/#358/issue #363 siguen bloqueados.

**Prohibido:** falsificar/adulterar tests, mocks, fixtures, screenshots, expectations, asserts, RED/GREEN, snapshots, jobs/timeout/threshold, usar `.skip/.only`, bypass RLS, `service_role` de cliente, desactivar trusted E2E, editar `docs/revision-pr/**`, autoaprobar ni mergear fases sin autorización.
