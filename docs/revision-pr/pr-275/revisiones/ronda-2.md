# Informe de revisión — PR #275 / T-343 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/275  
**Head SHA revisado:** `bee887e9ee66313be532354b2ead22b4329f7a14`  
**Base:** `develop` @ `83aeb34f00d2a4e78332d4da9004e1bdaab6def5`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (1).**

Los tres puntos de ronda 1 quedaron resueltos o aceptados. Aparece un único bloqueante nuevo de evidencia: el body declara `test ✅` aunque la propia evidencia local registra 4 fallos en `pnpm test`.

## PR275-H01 — ARREGLADO Y VERIFICADO

El cambio nuevo en `src/features/offers/queries.ts` ya no degrada un enum inválido a `{ requests: [], nextCursor: null }`.

Ahora:

- `package_type` inválido → lanza `Error`;
- `recipient_payment_method` inválido → lanza `Error`;
- el error puede propagarse desde `CourierFeedPage` al `error.tsx` de la ruta;
- el camino live mantiene `DATABASE_ERROR` / 500.

La prueba también cambió correctamente: usa una fila válida + una inválida y exige `rejects.toThrow` para ambos campos.

**Verificación independiente:** inspección del diff `c8daf3a..bee887e`, más CI `unit` ✅ sobre el mismo HEAD.

## PR275-A01 — ACEPTADO

Sin cambios respecto de la decisión de Lautaro073: Opción A. Se permite adaptar el fixture de `feed-privacy.test.tsx` dentro de #275.

## PR275-H03 — ARREGLADO Y VERIFICADO

El body contiene ahora el bloque completo:

- `### Informe de revisión de agy — autorrevisión`
- `Informe revisar-pr — T-343`
- `Resultado: SIN BLOQUEANTES`
- `Checks locales:`
- `BLOQUEANTES:`
- `MEJORAS:`
- `No revisado / dudas para Lautaro073:`

**Verificación independiente:** `approval-policy` run **37409596878** → **success**.

## PR275-H04 — BLOQUEANTE NUEVO: el check local de tests está declarado en verde sin estarlo

**Archivo:** body del PR / bitácora T-343  
**Severidad:** medio  
**Tipo:** evidencia / DoD

El body dice:

```md
Checks locales: typecheck ✅ · lint ✅ · test ✅ (...)
```

pero dentro del mismo paréntesis informa:

```text
pnpm test completo 1917 passed y 4 timeouts intermitentes
```

y la bitácora lo registra todavía más explícitamente como:

```text
pnpm test completo → 1917 passed | 4 failed
```

Eso no es una corrida local GREEN. Los tests aislados en verde y el job `unit` de CI en verde son evidencia útil, pero no convierten retroactivamente el comando local `pnpm test` fallido en `✅`.

Además, el DoD de T-343 pide explícitamente `pnpm typecheck && pnpm lint && pnpm test && pnpm test:db` GREEN.

### Qué hacer

1. Reejecutar `pnpm test` completo.
2. Si queda GREEN, pegar esa salida/resultado y mantener `test ✅`.
3. Si vuelve a fallar por timeouts, no declarar `test ✅`: registrar `test ❌` o equivalente y tratar esos timeouts antes de afirmar que el DoD está completo.
4. No sustituir el resultado del comando local por targeted tests o por el job `unit` de CI; se pueden mencionar aparte.

### Por qué bloquea

`AGENTS.md §4` y `revisar-pr` exigen evidencia real antes de review y prohíben declarar verde sin evidencia. El propio body contiene evidencia contradictoria.

## Checks observados sobre `bee887e`

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- e2e-preview ✅
- approval-policy ✅
- audit ❌ — advisories externos a T-343

## No revisado / dudas

- `audit` sigue fuera de T-343.
- No aparecieron cambios funcionales nuevos fuera de H01 desde la ronda 1.
