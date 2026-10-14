# Informe de revisión — PR #278 / T-344

**PR:** https://github.com/cadeApp/cadeApp/pull/278  
**Head SHA revisado:** `ae676c3f445b503fe8e4bf2635ddfd7935b721ab`  
**Base:** `develop` @ `fde9ec2100b3c98e10369b397b9ab6c37d91cd4e`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

La PR es documental y registra una tarea nueva. `docs/tasks/T-344.md` no existía en `develop`, por lo que se revisó la ficha completa contra el estado real del repo, el issue #277, el árbol de dependencias y el CI de la base.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| — | — | — | No se detectaron hallazgos | — |

## Validaciones realizadas

### Alcance

El diff revisado contiene solo:

- `docs/implementation-plan.md`
- `docs/tasks/T-344.md`
- `docs/tasks/log/T-344.md`

No toca dependencias ni código todavía. La fila del plan, ficha y bitácora son coherentes entre sí.

### Origen del incidente

Se reprodujo por CI sobre la base exacta `fde9ec2100b3c98e10369b397b9ab6c37d91cd4e` y sobre el SHA revisado:

- `tinypool 1.1.1` por `vitest 3.2.7`: dos advisories critical;
- `source-map-js 1.2.1` por `@vitest/coverage-v8 > magicast`: advisory high;
- resumen: `7 vulnerabilities found`, `3 moderate | 2 high (1 ignored) | 2 critical`.

El rojo de `audit` no es una regresión de esta PR: aparece también en `develop` sin cambios de dependencias y es precisamente el problema que T-344 registra para corregir.

### Viabilidad de Vitest 4

La guía oficial de migración de Vitest 4 confirma:

- requisito Vite >= 6 y Node >= 20;
- el repo usa Node >=22.14.0 y fuerza Vite 6.4.3;
- Vitest 4 elimina Tinypool de su arquitectura de pools;
- la cobertura V8 cambia el remapeo y puede cambiar métricas.

La ficha cubre ese riesgo correctamente: exige `pnpm test:coverage` con los mismos umbrales y prohíbe bajarlos para hacer pasar la migración. También exige dos corridas consecutivas de `pnpm test`, `pnpm why tinypool`, validación de `source-map-js` y no permite nuevos GHSA ignorados.

La versión objetivo mínima 4.1.11 coincide con la versión parcheada para GHSA-82fw-gwwq-j7x9.

### Contratos y seguridad

No hay CC porque no se cambia contrato de dominio, esquema, RPC, RLS ni `src/ui`. `vitest` y `@vitest/coverage-v8` ya figuran entre las dependencias de desarrollo aprobadas en la regla 25.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `audit` rojo | Es preexistente y reproducido en `develop`; T-344 existe para corregirlo. |
| `postcss-selector-parser` moderado queda fuera | `--audit-level=high` no falla por moderados; la ficha lo documenta explícitamente. |
| No adoptar Vitest 5 | Es una decisión de alcance válida: 4.1.11 está parcheado y la tarea evita sumar otro major innecesario. |
| Override de `source-map-js` | Es condicional: solo se agrega si Vitest/coverage 4.1.x no resuelve por sí mismo la versión transitiva. |
| Bundle-budget muestra rutas >180 kB | El control es advisory y esas rutas no cambian en este diff documental; no son regresión de #278. |

## Checks del SHA revisado

- `typecheck` ✅
- `lint` ✅
- `unit` ✅ — 121 archivos / 1921 tests; cobertura total 83.72% statements/lines, 82.71% branches, 77.63% functions
- `db-tests` ✅ — T321 preserve GREEN; bootstrap 10/10; suite 18 archivos / 1811 tests PASS
- `build` ✅
- `bundle-budget` ✅ como job, con warnings preexistentes en rutas >180 kB
- Vercel ✅
- `audit` ❌ esperado/preexistente — mismo advisory set que `develop`
- `approval-policy` ❌ al corte porque todavía faltaba este informe independiente
- `e2e-preview` ⏳ en curso al cierre de la ronda; revalidar antes de mergear

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| unit/coverage | El estado actual de Vitest 3 sigue estable | No prueba todavía la futura migración a Vitest 4 |
| audit | Detecta el incidente real | No dice por sí solo cuál actualización es compatible |
| bundle-budget | Produce mediciones de rutas | Es advisory y puede quedar SUCCESS con rutas por encima del presupuesto |
| verify-fichas | Valida forma de la ficha | No demuestra compatibilidad de Vitest 4 |

## Checklist de verificación final

- [x] Base y HEAD coinciden con GitHub.
- [x] `develop` no avanzó respecto de la base del PR al revisar.
- [x] Diff completo revisado.
- [x] Issue #277 y bitácora coherentes.
- [x] Incidente de audit reproducido en `develop`.
- [x] Ruta de migración contrastada con documentación oficial de Vitest 4.
- [x] No se debilitan audit, cobertura ni tests en la ficha.
- [ ] `e2e-preview` todavía estaba ejecutándose al cierre.

## Metodología

Revisión independiente por inspección del diff, GitHub Actions del SHA/base exactos y documentación oficial de Vitest. No se modificó código de producto ni se fabricaron pruebas RED/GREEN. El único commit de esta revisión agrega `docs/revision-pr/pr-278/**`; el SHA verificado sigue siendo `ae676c3f445b503fe8e4bf2635ddfd7935b721ab`.
