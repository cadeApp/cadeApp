# Informe de revisión — PR #284 / T-346 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/284  
**Head SHA revisado:** `da5f00f472663a931043e504a5f47a31ff754092`  
**Base:** `develop` @ `5c7febf6c2a4cba97d29148cc797e373103bd838`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

La ficha es coherente con el fallo real que hoy deja `audit` en rojo y mantiene el arreglo dentro de una modificación mínima de dependencias: override fijo de `sharp`, sin subir Next.js, sin bajar el umbral y sin ignorar un advisory nuevo.

No hay decisiones 🔵 pendientes.

## Alcance y sincronización

- El HEAD funcional parte exactamente del `develop` actual: `5c7febf6c2a4cba97d29148cc797e373103bd838`.
- La PR funcional toca solo:
  - `docs/implementation-plan.md`;
  - `docs/tasks/T-346.md`;
  - `docs/tasks/log/T-346.md`.
- T-346 todavía no existe en `develop`: esta PR es justamente el alta de la ficha.
- Issue #283 está abierto, asignado a @Lautaro073 y marcado `lista`.
- No hay cambios de contratos, aplicación, workflows, Supabase ni dependencias en esta PR de ficha.

## Verificación del diseño propuesto

### Advisory y versión objetivo

El advisory del mantenedor de `sharp`, GHSA-wq5f-xc86-pv6w, marca como afectadas las versiones `<0.35.5` y como parcheadas `>=0.35.5`. El árbol actual de `develop` resuelve `next > sharp` en `0.35.4`.

### Compatibilidad con Next.js

Los metadatos de `next` 15.5.26 y 15.5.27 declaran `sharp` como dependencia opcional con rango:

```text
^0.34.3 || ^0.35.4
```

Por lo tanto `0.35.5` está dentro del contrato de versión de Next.js y no hace falta ampliar T-346 a una actualización de `next`.

### Guardas de alcance

La ficha deja explícitamente fuera:

- subir `next` o `eslint-config-next`;
- agregar GHSA nuevos a `pnpm.auditConfig.ignoreGhsas`;
- bajar `--audit-level=high`;
- tocar código de la app o `.github/**`;
- fabricar RED/GREEN o debilitar pruebas.

El DoD además exige `pnpm why sharp`, build, suite, db-tests de CI y `e2e-preview`.

## Evidencia exact-head

Sobre `da5f00f472663a931043e504a5f47a31ff754092`:

| Check | Resultado | Evidencia relevante |
|---|---|---|
| typecheck | ✅ | job success |
| lint | ✅ | lint bloqueante success; Prettier advisory reporta deuda preexistente fuera del diff |
| unit | ✅ | 121/121 archivos, 1921/1921 tests |
| verify-fichas | ✅ | `tools/verify-fichas.test.ts`: 7 tests |
| build | ✅ | Next.js compiló correctamente |
| bundle-budget | ✅ | job success |
| db-tests | ✅ | `Files=1, Tests=10, Result: PASS` y `Files=18, Tests=1811, Result: PASS` |
| Vercel | ✅ | deployment success |
| e2e-preview | ✅ | status success |
| audit | ❌ esperado | `sharp` vía `next`; 3 vulnerabilities, `1 moderate | 2 high (1 ignored)` |

El rojo de `audit` reproduce el origen documentado en T-346 y es el objeto de la tarea futura, no una regresión introducida por esta PR.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `audit` rojo impide aceptar la ficha | Es el incidente que la ficha registra; el diff no modifica dependencias y el log exact-head reproduce el advisory esperado. |
| Falta `package.json` / lockfile en esta PR | Correcto: esta PR solo crea la ficha. Esos archivos pertenecen a la implementación de T-346, no al alta documental. |
| `sharp` sería una dependencia nueva no aprobada | No se agrega como dependencia directa; ya es dependencia transitiva opcional de `next`. La tarea solo fija la versión resuelta. |
| Habría que subir `next` | El rango de Next.js ya admite 0.35.5; subirlo ampliaría innecesariamente el riesgo y el alcance. |

## Metodología

Revisión estática del diff, ficha, issue, reglas del repo, antecedente T-344, árbol de dependencias y metadatos de Next.js; verificación de CI/Vercel/E2E sobre el SHA exacto. No se alteró código funcional ni se ejecutaron comandos contra infraestructura remota.

La revisión independiente no aprueba ni mergea la PR.
