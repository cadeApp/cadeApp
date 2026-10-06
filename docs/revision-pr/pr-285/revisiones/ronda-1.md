# Informe de revisión — PR #285 / T-346 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/285  
**Head SHA revisado:** `6d9a4afb6ff247848da976c485ac6671aa9ccd09`  
**Base:** `develop` @ `228de182b6980526966a74446a2fc222cc8616ee`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

No hay decisiones 🔵 pendientes ni mejoras necesarias.

La implementación cumple el alcance fijado por la ficha: agrega únicamente el override `"sharp": "0.35.5"`, regenera el lockfile y actualiza la bitácora. No modifica `next`, `eslint-config-next`, `auditConfig`, código de aplicación ni workflows.

## Alcance e integración

- `develop` actual coincide con la base del PR: `228de182b6980526966a74446a2fc222cc8616ee`.
- Compare `develop...HEAD`: `ahead_by=2`, `behind_by=0`.
- Archivos funcionales modificados:
  - `package.json`;
  - `pnpm-lock.yaml`;
  - `docs/tasks/log/T-346.md`.
- El historial de `docs/revision-pr/pr-285/**` estaba vacío antes de esta revisión: el autor no escribió la carpeta de revisión.
- Issue #283 está abierto, asignado a @Lautaro073 y en `en-review`.

## Reproducción independiente del RED

El RED anterior se tomó del CI de `ff887ffb8aff7920c701d1e53521beba00a70454`, cuyo árbol de dependencias es idéntico a la base de #285:

```text
package.json
  ff887ff = 01e8a38966a4cb2435e162b35cec452e599f5d4e
  develop = 01e8a38966a4cb2435e162b35cec452e599f5d4e

pnpm-lock.yaml
  ff887ff = 47abcb1947febc031b6cf30d5d9b4f62f9d1f0e6
  develop = 47abcb1947febc031b6cf30d5d9b4f62f9d1f0e6
```

Su job `audit` reproduce exactamente:

```text
high  sharp : Vulnerability in librsvg dependency
Package  sharp
Paths    .>next>sharp
GHSA-wq5f-xc86-pv6w
3 vulnerabilities found
Severity: 1 moderate | 2 high (1 ignored)
exit 1
```

Por lo tanto el RED de la bitácora está respaldado por un árbol de dependencias idéntico al de la base de esta PR.

## GREEN del HEAD revisado

En `6d9a4afb6ff247848da976c485ac6671aa9ccd09`:

### Audit

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
exit 0
```

No se agregaron GHSA a `ignoreGhsas` ni se cambió el umbral.

### Árbol

Inspección mecánica del lockfile:

```text
sharp@0.35.4: 0 ocurrencias
sharp@0.35.5: presente
next -> sharp: 0.35.5
```

Las dos claves `sharp@` del lockfile son la entrada de paquete y su snapshot, ambas de la misma versión 0.35.5; no hay una segunda versión instalada.

### CI y runtime

| Check | Resultado | Evidencia |
|---|---|---|
| typecheck | ✅ | job exact-head success |
| lint | ✅ | job exact-head success |
| unit | ✅ | 121/121 archivos, 1921/1921 tests |
| workflows | ✅ | 57/57 |
| ADR | ✅ | 6/6 |
| build | ✅ | `Compiled successfully` |
| audit | ✅ | 2 vulnerabilidades; 1 moderate + 1 high ignorado |
| bundle-budget | ✅ | job success |
| db-tests | ✅ | 10/10 + 1811/1811 |
| Vercel | ✅ | deployment success |
| e2e-preview | ✅ | 37/37 + 3/3 = **40/40** |

## Revisión del lockfile

El diff del lockfile está limitado a la resolución de `sharp`:

- `sharp` 0.35.4 → 0.35.5;
- paquetes binarios `@img/sharp-*` 0.35.4 → 0.35.5;
- `@img/sharp-libvips-*` 1.3.3 → 1.3.4;
- referencias de snapshot correspondientes.

No aparecen cambios de `next`, otras dependencias directas, scripts ni configuración de auditoría.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Cambian muchas líneas del lockfile | Son los binarios por plataforma de `sharp` y su `libvips`; corresponden a la única actualización solicitada. |
| Hay dos cadenas `sharp@0.35.5` | Son package entry + snapshot de pnpm, no dos versiones distintas. |
| El build no ejercería `sharp` | Además del build exact-head, Vercel desplegó el Preview y el E2E remoto pasó 40/40. |
| Quedan vulnerabilidades en `pnpm audit` | Son las dos expresamente fuera de alcance por la ficha: una moderada y el high ya ignorado previamente. |

## Metodología

Se leyó T-346 desde `develop`, comentarios, bitácora, diff completo, historial de la carpeta de revisión y estado de integración. Se reprodujo el RED mediante CI de un árbol con blobs de dependencias idénticos a la base, y se inspeccionaron logs exact-head del GREEN, lockfile, build, db-tests y E2E.

No se necesitó batería de mutaciones porque no se formuló ningún hallazgo: no hay una propiedad defectuosa que demostrar pasando en verde.

La revisión independiente no aprobó ni mergeó la PR.
