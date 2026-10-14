# Informe de revisión — PR #275 / T-343 — ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/275  
**SHA funcional revisado:** `08dffbfb6c8c05750680b876c7b2d55a3eb38c4c`  
**Commit de ampliación de alcance:** `eda5e34c92b22f025988e926b765008fa8cafa69`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (1): PR275-H04.**

No apareció una regresión nueva de T-343. La ronda 3 resolvió la decisión pendiente de H04: Lautaro073 eligió **B**, por lo que T-343 va a corregir dentro de #275 los dos defectos preexistentes de infraestructura que impiden que `pnpm test` local termine GREEN.

## Verificación de la respuesta a ronda 2

Desde el commit de revisión `4b84b2e` hasta `08dffbf`, el autor solo modificó:

- `docs/tasks/log/T-343.md`

No tocó `docs/revision-pr/pr-275/**`.

La bitácora corrigió la evidencia: ya no declara `pnpm test` como verde. Registra dos corridas completas sobre `4b84b2e`, ambas con:

```text
exit=1
Tests 3 failed | 1918 passed (1921)
```

Eso resuelve la inconsistencia documental original de H04, pero deja expuesto el problema real que impide cumplir el DoD.

## Diagnóstico técnico de H04

### A. Carrera en `src/server/rpc/cc007.test.ts`

La función `executeMutation()` lee un archivo real del checkout, lo reescribe con `fs.writeFileSync`, lanza un Vitest hijo y recién en `finally` restaura el contenido.

La mutación A modifica físicamente:

```text
src/features/auth/guards.ts
```

mientras la suite principal todavía ejecuta otros archivos en paralelo. Por eso `src/features/auth/guards.test.ts` puede importar el archivo durante la ventana mutada y observar lógica falsa.

La bitácora reproduce la relación causal:

- suite completa: dos fallos de assertions en `guards.test.ts`;
- excluyendo `cc007.test.ts`: `guards.test.ts` pasa;
- `guards.test.ts` aislado: 88/88 pasa.

**Arreglo requerido:** las mutaciones adversariales tienen que ejecutarse sobre un checkout/worktree temporal aislado. `cc007.test.ts` no puede escribir nunca `src/features/auth/*.ts` ni migraciones del checkout donde corre la suite principal.

### B. Arranque en frío de ESLint en `tools/verify-scaffold.test.ts`

Cada `it` llama `eslint.lintFiles()` por separado. El primer test paga carga de parser/plugins/config en un timeout individual de 5 s; bajo la carga de la suite completa puede excederlo aunque aislado pase.

**Arreglo requerido:** ejecutar ESLint una sola vez en `beforeAll` sobre todos los fixtures/archivos que usa este archivo, indexar los resultados por `filePath` y hacer que cada `it` conserve exactamente sus assertions actuales contra el resultado cacheado.

No subir el timeout del `it`; no usar `.skip`; no debilitar assertions.

## Decisión B aplicada al alcance

La ficha y `docs/implementation-plan.md` fueron ampliados por la revisión en `eda5e34` únicamente para:

- `src/server/rpc/cc007.test.ts`
- `tools/verify-scaffold.test.ts`

No se autorizan cambios en:

- `src/features/auth/guards.ts`
- `src/features/auth/guards.test.ts`
- `src/features/auth/queries.ts`
- `src/features/auth/actions.ts`
- `vitest.config.ts`
- `package.json` / `pnpm-lock.yaml`
- dependencias o timeouts globales.

## Criterio de cierre de H04

Se requiere:

1. `pnpm vitest run src/server/rpc/cc007.test.ts src/features/auth/guards.test.ts` GREEN.
2. `pnpm vitest run tools/verify-scaffold.test.ts` GREEN.
3. `pnpm test` completo GREEN **dos veces consecutivas**.
4. `pnpm typecheck` y `pnpm lint` GREEN.
5. Sin archivos del checkout real modificados como efecto lateral de los mutation tests.
6. Body y bitácora reportan literalmente los resultados; nada se marca verde si el comando nombrado falló.

## CI

No se usa CI para cerrar H04 antes del arreglo: mientras existe un bloqueante, la ronda es estática. El `unit` anterior estaba verde, pero H04 es específicamente reproducible en la ejecución local completa y ahora forma parte explícita del DoD ampliado.
