# Informe de revisión — PR #279 / T-344 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/279  
**Head SHA revisado:** `320938f01b3a71c278f7c51a995e74e1e2e94e37`  
**Base:** `develop` @ `f3d00ed435bbbcaec448f7afc6ac356fb8494960`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

No hay decisiones pendientes. Lautaro073 confirmó durante la revisión que las decisiones 1-A y 2-A registradas en la ficha fueron autorizadas por él.

## Sincronización y alcance

La comparación remota `develop...feat/T-344-audit-vitest4` da:

- estado: `ahead`;
- 2 commits adelante;
- 0 commits detrás;
- merge base: `f3d00ed435bbbcaec448f7afc6ac356fb8494960`.

Archivos modificados:

- `docs/implementation-plan.md`
- `docs/tasks/T-344.md`
- `docs/tasks/log/T-344.md`
- `package.json`
- `pnpm-lock.yaml`
- `src/server/rpc/offers.test.ts`
- `vitest.config.ts`

Todos quedan dentro de la ficha base o de las dos ampliaciones autorizadas. La ficha del HEAD añade únicamente:

- 1-A: `src/server/rpc/offers.test.ts`, solo para aislar spies con `vi.restoreAllMocks()`;
- 2-A: `maxWorkers: 4`, sin subir timeouts ni tocar `cc007.test.ts` / `verify-scaffold.test.ts`;
- documentación del fallo preexistente de `next/font` (#280).

No se cambió el objetivo de T-344 ni se habilitó código de producción adicional.

## Dependencias y configuración

`package.json` cambia exactamente:

- `vitest`: 3.2.7 → 4.1.11;
- `@vitest/coverage-v8`: 3.2.7 → 4.1.11;
- override `source-map-js: 1.2.2`.

No se agregaron GHSA a `auditConfig.ignoreGhsas`.

El lockfile elimina `tinypool@1.1.1` y resuelve `source-map-js@1.2.2`. Los cambios transitivos restantes corresponden a la actualización de Vitest/coverage y a la nueva resolución de peers del lockfile.

El proyecto ya exige Node `>=22.14.0` y CI usa 22.14.0; Vitest 4.1.11 no introduce incompatibilidad con el runtime declarado.

## Decisión 1-A — aislamiento de spies

En `src/server/rpc/offers.test.ts` el cambio funcional de test está limitado al `describe` de T-206:

```ts
afterEach(() => {
  vi.restoreAllMocks();
});
```

No se tocaron expectations ni código de producción.

La API oficial de Vitest documenta que `vi.restoreAllMocks()` restaura las implementaciones originales de spies creados con `vi.spyOn`, que es exactamente el tipo de fuga observada.

### RED reproducido

En el primer commit de la PR (`b52677b75d3587b13be21f178b724f07109e751f`), CI `unit` run `37417781433` muestra:

```text
FAIL src/server/rpc/offers.test.ts
accept_offer con idempotent: true NO genera push ni consulta destinatarios (PR118-H01)
AssertionError: expected "createAdminClient" to not be called at all, but actually been called 4 times
Test Files 1 failed | 120 passed (121)
Tests      1 failed | 1920 passed (1921)
```

Esto reproduce el RED declarado por el autor sin adulterar expectations.

### GREEN final

En el HEAD revisado, CI `unit` run `37419295817`:

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
All files  83.2 % stmts | 78.51 % branch | 78.48 % funcs | 83.73 % lines
```

## Decisión 2-A — maxWorkers

`vitest.config.ts` añade únicamente `maxWorkers: 4`; no cambia:

- `globals`;
- `environment`;
- `include` / `exclude`;
- coverage;
- thresholds;
- aliases;
- pool;
- timeouts.

La documentación oficial de Vitest 4 define `maxWorkers` como el máximo de workers concurrentes y acepta un número entero; `4` usa la API prevista.

Los timeouts locales de `cc007` y `verify-scaffold` registrados por el autor no pudieron reproducirse dentro del runtime de esta revisión porque el contenedor no tiene salida DNS hacia GitHub para montar un checkout completo. No se los presenta como verificados independientemente. La decisión 2-A fue autorizada por Lautaro073 y el resultado final sí está corroborado por CI Linux del SHA revisado.

## RED/GREEN del audit

CI de `develop` sobre la base `f3d00ed`, job `audit`:

```text
7 vulnerabilities found
Severity: 3 moderate | 2 high (1 ignored) | 2 critical
```

Después del primer commit de T-344 y también en el HEAD final:

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

El advisory de `source-map-js` afecta versiones <1.2.2 y GitHub Advisory Database marca 1.2.2 como parcheada. El advisory de Vitest/`@vitest/mocker` marca 4.1.11 como versión corregida.

## CI del SHA revisado

CI run `37419295817`:

- typecheck ✅
- lint ✅ — `No ESLint warnings or errors`
- unit ✅ — 121/121 archivos, 1921/1921 tests
- audit ✅ — 2 vulnerabilidades: 1 moderate + 1 high ya ignorado
- build ✅
- bundle-budget ✅
- db-tests ✅ — `Files=18, Tests=1811`, `Result: PASS`

Externos:

- Vercel ✅
- e2e-preview run `37419420307` ✅
- Supabase Preview: skipped (la rama no tiene preview DB asociada; no es un fallo)
- approval-policy ❌ antes de esta ronda: faltaba el informe independiente requerido.

El fallo `next/font` documentado en #280 queda comprobado como preexistente: el build de la base `f3d00ed` falló con el mismo `TypeError: Cannot read properties of null (reading '1')`; el build final de T-344 pasó sin tocar fuentes ni `layout.tsx`.

## Limitación del entorno de revisión

No se ejecutó un checkout local del repo porque el contenedor de revisión no pudo resolver `github.com`. No se levantó Supabase ni Docker local. La verificación ejecutable se hizo contra los logs de GitHub Actions del SHA exacto revisado y contra los runs históricos que reproducen los RED declarados.

## Conclusión

No hay bloqueantes, mejoras pendientes ni decisiones por resolver. T-344 cumple su objetivo y queda lista para merge cuando el commit de esta revisión termine sus checks y `approval-policy` vea el informe completo.
