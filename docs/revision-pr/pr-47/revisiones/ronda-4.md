# Ronda 4 — verificación de cierre · PR #47 / T-000

**Head SHA revisado:** `4abf24a24bca864025fea2c83bea5851fc1334c7`
**Anterior:** `d0268345f72411148810a0ecf3eb5187890ada28`
**Fecha:** 2026-09-21

---

## Veredicto

**Los 16 defectos están corregidos y verificados** — cada uno comprobado ejecutando algo contra `4abf24a`, con el método registrado en `hallazgos.jsonl`.

De los dos puntos no técnicos, **H14 ya se resolvió** (desvío aceptado por @Lautaro073 en `606c132`). Queda **A01**: documentación fuera de los «Archivos permitidos» de T-000, pendiente de la misma decisión explícita.

`pnpm lint` volvió a verde: la regresión R02 nunca llegó a commitearse — era un experimento del árbol de trabajo, y el commit final tomó el camino correcto.

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 26/26 en 6 archivos
pnpm build      → ✓ 87.2 kB First Load JS en /
```

---

## El camino elegido fue el bueno

En la ronda 3 había tres opciones sobre la mesa para restringir `feature → server`. Se tomó la **opción C**, que era la mejor:

- Se agregó la regla `cadeapp/feature-server-boundary` al plugin propio y se conectó en `.eslintrc.json`.
- Se eliminó el bloque `overrides` (causa de R01).
- **No** se commiteó el elemento `feature-server-api` (causa de R02): `grep -c feature-server-api .eslintrc.json` devuelve 0.

Con eso no hay listas de paquetes duplicadas que mantener sincronizadas, y el control opera por archivo, que es la granularidad que `boundaries` no podía dar.

---

## Verificación independiente

Cada caso reproducido contra `4abf24a`, con el árbol limpio.

### Fronteras de feature

| Caso | Esperado | Obtenido |
|---|---|---|
| `axios` + `lodash/get` en `components/` | bloqueado | ✅ 3 errores |
| Archivo suelto de feature → `@/server` | bloqueado | ✅ 1 error |
| `hooks/` → `@/server` | bloqueado | ✅ 1 error |
| `components/` → `../schemas` | **permitido** | ✅ 0 errores |
| `queries.ts` y `actions.ts` reales | **permitido** | ✅ 0 errores |
| Import profundo cross-feature de `schemas` | bloqueado | ✅ 1 error |

Los dos controles «permitido» son los que fallaban en la ronda 3 (R02). Ahora pasan.

### Regla `client-no-server` (sin regresiones)

| Caso | Esperado | Obtenido |
|---|---|---|
| Comentario antes de `'use client'` (H02) | bloqueado | ✅ 1 error |
| `export * from '@/server/env'` (H06) | bloqueado | ✅ 1 error |
| `await import('@/server/env')` (H06) | bloqueado | ✅ 1 error |
| `import type ... from 'next/server'` (H07) | **permitido** | ✅ 0 errores |

### H04 · El test de build ahora prueba lo que dice

El arreglo aplicó los tres cambios: directorio `src/app/boundary-probe` (enrutable), `next build --no-lint`, y regex cerrado a `/needs server-only/i`. Además agregaron limpieza de `.next` en el `finally`, que evita el problema de artefactos rancios que rompía el `typecheck` siguiente.

**Demostrado en rojo** (principio 8 del plan): al quitar `import 'server-only';` de `src/server/env.ts`, el test falla:

```
expect(buildError!.message).toMatch(/needs server-only/i);
                                    ^
Test Files  1 failed (1)
```

Restaurado el import, vuelve a verde. Ahora sí verifica el DoD.

### H01 · Inlineado de env (sin regresión)

Build con `NEXT_PUBLIC_APP_URL=https://probe-marker.example.com`:

```
grep -rl "probe-marker" .next/static/chunks/
→ .next/static/chunks/app/envprobe/page-a490b84ef10264ed.js
```

### H03 · Escala tipográfica (sin regresión)

Cero coincidencias de `font-size: 14px` en la raíz; `.text-xs` en `0.875rem` (14px sobre raíz 16px).

### H12 · Stub que falla ruidosamente

`src/features/_template/hooks/use-example.ts:19` ahora hace `throw new Error('Implementar la lectura real...')` en vez de devolver el closure. El `queryKey` sigue parametrizado por filtros.

---

## H14 · Resuelto: desvío aceptado

`middleware.ts` sigue con función y matcher, y la ficha T-000 pide «`middleware.ts` vacío».

El matcher quedó bien (excluye `api`, ancla `brand/`) y el archivo ya está bajo lint desde H10, así que aceptar el desvío es de bajo riesgo. Pero **es una decisión de @Lautaro073**, no algo que deba resolver un agente:

**Resolución:** @Lautaro073 eligió la opción (b) — se acepta el placeholder con el matcher optimizado y queda registrado en la aprobación. Marcado como `aceptado` en `hallazgos.jsonl`, con `verificado_en_sha: 606c132`.

---

## A01 · Desvío de alcance, pendiente de decisión

El commit `4abf24a` agrega 13 archivos bajo `docs/revision-pr/**`. Los «Archivos permitidos» de la ficha T-000 son «raíz y configs, esqueleto de `src/**`, `middleware.ts`, `components.json`, `tools/lint-fixtures/**`», y el DoD común de la sección 8 exige «sin cambios fuera de Archivos permitidos».

No es un problema técnico, pero **tampoco alcanza con mencionarlo**: es el mismo tipo de desvío que H14 y merece el mismo tratamiento explícito. Queda registrado como `PR47-A01` con estado `decision-pendiente`.

Opciones:

- **(a)** Sacar `docs/revision-pr/**` de este PR y llevarlo a uno propio, o a T-001, cuya ficha sí incluye `docs/**` entre los archivos permitidos.
- **(b)** Aceptar el desvío y registrarlo en el comentario de aprobación del PR, igual que H14.

Vale notar que ningún check compara el diff contra la lista de archivos permitidos de la ficha — por eso este desvío y el de H14 pasaron sin que nada los señalara. Es material para `AG-13`.

---

## Metodología

Verificado contra `4abf24a` con el árbol limpio. Probes creados y eliminados (`src/app/envprobe/`, `tools/lint-fixtures/_p/`, archivos sueltos en `src/features/_template/`), `.next/` borrado, `src/server/env.ts` restaurado tras la prueba en rojo. `git status` quedó limpio.

No se verificó por ejecución: H14 (decisión, sin componente técnico pendiente).
