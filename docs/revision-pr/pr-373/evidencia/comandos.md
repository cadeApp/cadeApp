# Evidencia reproducible — PR #373 / CC-026 — ronda 1

**HEAD inspeccionado:** `eadaf54581b1c1cd3875e4a039ba66ffe70f0548`; **base develop:** `687e2043817340b2951714cb6e7b179be2e3973a`.

### Qué se consultó efectivamente

- GitHub PR metadata/diff `#373`, comentarios y CC desde `develop`; siete archivos cambiados, +160/-7 líneas.
- GitHub compare `develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548`: `ahead_by=1`, `behind_by=0`; ref/remoto coincide, PR Draft/mergeable.
- GitHub commit status: Vercel success; `e2e-preview` error por ejecución CANCELLED `38704263924`, no falla de test demostrada; CI main al momento de la ronda en progreso.
- **ANÁLISIS propio estático** sobre contenido de archivos reales: `RPC_CONTRACTS.reconcile_expired_requests.errorCodes` no contiene `VALIDATION_ERROR`; `callRequestRpc` devuelve ese código para parse inválido; output Zod no tiene `refine` ni `superRefine`; las suites nuevas sólo aportan un camino feliz de reconciliación.

**No** se ejecutaron Vitest, `node ... analizar.mjs`, Docker, pgTAP, `git merge-tree` o mutación real por imposibilidad de clonar desde este contenedor. La declaración RED/GREEN del autor no fue reproducida.

### Comandos para reproducir en el SHA limpio

```bash
set -euo pipefail
git fetch origin develop cc/CC-026-reconciliacion-expiraciones
git diff --stat origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git diff --name-status origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git merge-tree --write-tree origin/develop eadaf54581b1c1cd3875e4a039ba66ffe70f0548
git show origin/develop:docs/contracts/CC-026.md | sed -n '1,230p'
git diff origin/develop...eadaf54581b1c1cd3875e4a039ba66ffe70f0548 -- src/domain src/server/rpc docs/contracts/CC-026.md
git status --short
```

### Test de regresión requerido H01

En `src/server/rpc/requests.test.ts`, el mock de `client.rpc` no debe ser llamado ante input extra:

```ts
const rpc = vi.fn();
const client = createRequestsRpcServerClient({ rpc });
const response = await (client.reconcile_expired_requests as (v: unknown) => Promise<unknown>)({ merchantId: requestId });
expect(response).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
expect(rpc).not.toHaveBeenCalled();
expect(RPC_CONTRACTS.reconcile_expired_requests.errorCodes).toContain('VALIDATION_ERROR');
```

El `as` solo se usa en el test adversarial para escapar el tipado del caller y ejercer la validación runtime; no poner `as any` en producción.

### Test de regresión requerido H02

```ts
const base = {
  expiredRequestIds: [requestId],
  expiredCount: 1,
  hasMore: false,
};
expect(reconcileExpiredRequestsOutputSchema.safeParse(base).success).toBe(true);
expect(reconcileExpiredRequestsOutputSchema.safeParse({ ...base, expiredCount: 0 }).success).toBe(false);
expect(reconcileExpiredRequestsOutputSchema.safeParse({ ...base, expiredRequestIds: [requestId, requestId], expiredCount: 2 }).success).toBe(false);
```

Probar además `callRequestRpc` mockeando respuesta RPC con count=0/IDs=1: se espera `INTERNAL_ERROR`, sin success falso.

### Mutaciones RED de diseño del revisor — PENDIENTES DE EJECUCIÓN

No se afirma que se ejecutaron. Para ejecutarlas en una segunda ronda, construir en `/tmp` un harness que modifique **en memoria** la carga del módulo y restaure la fuente original, sin commit de mutaciones. Verificar:
1. Quitar `'VALIDATION_ERROR'` del catálogo tras corregir H01 ⇒ test nuevo cae.
2. Remover el refinamiento count-vs-IDs ⇒ test nuevo cae.
3. Desactivar `ALLOWED_ROLES_BY_RPC.reconcile_expired_requests` ⇒ test negativo de courier/admin cae.
4. Quitar `request.merchantId === actor.userId` ⇒ test de aislación entre comercios cae.
5. Sustituir `.slice(0, 50)` por la lista completa ⇒ test de 51 filas cae.

Cada control debe pasar GREEN sin mutación, luego RED por la violación **semántica** y GREEN después de revertir. No basta con errores de compilación; no se permite adulterar mocks, reducir expectations ni inventar ejecución.

### Suite exigida para terminar CC-026

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run src/domain/domain.test.ts src/server/rpc/requests.test.ts src/server/cron/sweep.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
# pgTAP en job db-tests CI del SHA vigente, con logs Files=/Tests=/Result: y build de tipos
# Concurrencia SQL: ejecutar el harness de dos conexiones autorizado en CI, no levantar Docker/Supabase local durante revisión
# Preview E2E: run nuevo concluido GREEN con SHA exacto; no contar CANCELLED como PASS
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git status --short
```
