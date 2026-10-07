# Informe de revisión — PR #294 / T-347 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/294  
**HEAD revisado:** `a0d860d46d96f1a03851cc2ffd2f17923c12aae0`  
**Base:** `develop` @ `a773c05cc488a1fc60bfb36512cdca35d12d1271`  
**Fecha:** 2026-10-07

## Resultado

**CON BLOQUEANTES (2).**

Decisión resuelta: `PR294-A01` → **A: solo `target=develop`**.

## Sincronización y alcance

```text
develop = a773c05cc488a1fc60bfb36512cdca35d12d1271
HEAD    = a0d860d46d96f1a03851cc2ffd2f17923c12aae0
ahead   = 2
behind  = 0
```

Los 10 archivos funcionales están dentro de la allowlist de T-347. No había historial previo en `docs/revision-pr/pr-294/**`.

## PR294-H01 — código no confiable de una PR ejecuta en el runner que recibe secretos de Develop

**Severidad:** crítica · **categoría:** correctness/security · **patrón:** P08-control-no-cubre-lo-que-dice.

El workflow acepta un número de PR como `target`, hace checkout de su SHA y ejecuta sobre ese checkout:

- `pnpm install --frozen-lockfile`;
- `pnpm build`;
- `pnpm start`;
- el spec Playwright del target.

Las fases control/mutant reciben `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DNI_HMAC_SECRET`, `CRON_SECRET` y datos de Supabase Develop.

`pnpm install` ocurre incluso antes de `check-env`, por lo que scripts del target pueden ejecutarse en el mismo runner y workspace. La separación `trusted/` / `target/` y `persist-credentials:false` no son un sandbox de procesos ni de memoria.

El target también conoce variables de job como la ruta de evidencia y puede influir en archivos que después usa `classify`.

No se ejecutó una exfiltración real contra secretos remotos; el flujo de datos basta para demostrar el defecto y ejecutar el exploit sería contrario a las reglas de seguridad del repo.

### Decisión

Lautaro073 eligió **A**:

- aceptar únicamente `target=develop`;
- eliminar números de PR del payload;
- resolver el SHA únicamente como la punta vigente de `develop`;
- eliminar API/permiso `pull-requests: read` y lógica de PR/fork/migraciones;
- todo lo ejecutado con secretos debe estar ya mergeado en `develop`.

H01 permanece abierto hasta verificar el arreglo.

## PR294-H02 — artifacts pueden contener secretos en salida cruda

**Severidad:** alta · **categoría:** correctness/security.

`e2e-mutation.mjs` persiste stdout/stderr en `control.log` y `mutant.log` mientras los procesos heredan `process.env`. Luego el workflow sube todo el directorio de evidencia y solo excluye `.env*`.

El masking de GitHub protege la presentación de logs de Actions, no constituye una sanitización demostrable de archivos creados por el proceso y subidos después como artifact. El mismo riesgo existe para JSON de Playwright si un error contiene un valor sensible.

Esto contradice el contrato: **los secretos nunca se escriben en el artifact**.

### Corrección requerida

- no subir stdout/stderr crudos de procesos con secretos;
- persistir únicamente `summary.json`, patch y evidencia estructurada mínima/sanitizada del caso objetivo;
- sanitizar explícitamente cualquier texto persistido contra la lista de valores sensibles;
- añadir un test con secreto canario que pruebe que el valor no aparece en ningún archivo que sería artifact.

H02 permanece abierto.

## PR294-M01 — nombre de artifact

La ficha exige `e2e-mutation-<id>-<sha7>`; el YAML usa el SHA completo. Corregir junto con H01/H02 y añadir test estructural.

## GREEN exact-head

CI `37590329884` sobre `a0d860d46d96f1a03851cc2ffd2f17923c12aae0`:

- lint ✅
- typecheck ✅
- build ✅ — `Compiled successfully in 25.7s`
- unit ✅ — 123/123 archivos, 1941/1941 tests
- verify-fichas ✅ — 7/7
- verify-workflows ✅ — 72/72
- ADR ✅ — 6/6
- db-tests ✅ — 19 archivos / 1853 tests
- tipos DB ✅ — sin drift
- audit ✅
- bundle-budget ✅ advisory
- Vercel ✅

E2E Preview `37590661055`:

- checkout exacto `a0d860d46d96f1a03851cc2ffd2f17923c12aae0`;
- 43/43 chromium ✅;
- 3/3 global-settings ✅;
- trusted E2E gate GREEN.

`approval-policy` rojo es esperado mientras haya bloqueantes de revisión.

## Cierre

No mergear todavía. La siguiente ronda debe demostrar: solo `target=develop`, artifact sin salida cruda y sanitización con canario, `sha7`, y CI/E2E exact-head.

La revisión independiente no aprobó ni mergeó la PR.
