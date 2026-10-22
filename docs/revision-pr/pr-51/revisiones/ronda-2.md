# PR #51 · Ronda 2 — `a5df3a9`

| | |
|---|---|
| **SHA revisado** | `a5df3a9` |
| **Commits nuevos** | `9e331ea` (H01–H04), `dee388d` y `a5df3a9` (bitácora) |
| **Base** | `ddb883d` |
| **Fecha** | 2026-09-21 |

## Veredicto

**Los cuatro hallazgos que T-003 podía arreglar están cerrados, y los cuatro los verifiqué en rojo**: rompiendo cada arreglo, la suite cae de 12/12 a `11 pass 1 fail`, siempre en la prueba que corresponde.

Queda H05 —que no puede resolver T-003— y apareció uno nuevo, chico, que es consecuencia del arreglo de H04.

| | |
|---|---|
| Cerrados y verificados | **5 de 7** (H01, H02, H03, H04, A01) |
| Abiertos | 2 (H05, que es tuyo; H06, nuevo y medio) |
| Alcance | **0 archivos fuera de la ficha** |

## Checks

| | Resultado |
|---|---|
| `node --test .github/workflows/verify-workflows.test.mjs` | **12/12** (eran 11) |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | exit 0 · limpio · **71/71** |
| CI en la PR | **7 de 8** — solo falla `db-types` |

`db-types` falla por el drift real de `src/types/database.types.ts` (12 líneas commiteadas contra ~650 generadas desde staging). Es de T-004, fuera de esta tarea, y está diagnosticado aparte.

---

## Las cuatro demostraciones en rojo

Rompí cada arreglo por separado y volví a correr la suite:

| Qué rompí | Suite |
|---|---|
| Borré `environment: production` de `migrate.yml` | `11 pass 1 fail` |
| Devolví `github.actor` al `if:` del job | `11 pass 1 fail` |
| Borré el guard que compara el ref con el de staging | `11 pass 1 fail` |
| Restauré `process.exitCode = 1` en `check-bundle-budget.mjs` | `11 pass 1 fail` |
| Restaurado | **`12 pass 0 fail`**, árbol limpio |

La primera es la que más importa: **con la assert anterior, borrar `environment: production` pasaba**. Ahora no.

## 🔴→✅ H01 · Producción tiene su propio ref, y hay guard

```yaml
SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PRODUCTION_PROJECT_REF }}
SUPABASE_STAGING_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}
```

```bash
if [ -z "$SUPABASE_STAGING_PROJECT_REF" ] || [ "$SUPABASE_PROJECT_REF" = "$SUPABASE_STAGING_PROJECT_REF" ]; then
  echo '::error::El ref de production debe existir y ser distinto al de staging.'
  exit 1
fi
```

No alcanza con separar los nombres: el guard convierte el desastre silencioso en un error ruidoso. Eso era exactamente lo que pedía el hallazgo.

**Residual, que no es defecto:** `SUPABASE_PRODUCTION_PROJECT_REF` todavía no existe en Actions —`gh api .../actions/variables` sigue devolviendo solo `SUPABASE_PROJECT_REF`—, así que hoy el job de producción fallaría con mensaje explícito. Fail-closed, que es lo correcto. Queda como configuración pendiente.

## 🟠→✅ H02 · El actor ahora bloquea en vez de saltear

El `if:` volvió a lo que le corresponde y la autorización pasó a un paso que falla:

```yaml
if: github.ref_name == 'main'
steps:
  - name: Require authorized release actor
    run: |
      if [ "$GITHUB_ACTOR" != 'Lautaro073' ]; then
        echo '::error::La migración de production requiere un release iniciado por Lautaro073.'
        exit 1
      fi
```

Es literalmente `AG-24`. Y está primero, antes del checkout, así que falla rápido.

**Residual:** los environments `staging` y `production` siguen con `protection_rules: []`. El paso del actor ya es un control real, pero §6 pide además el revisor obligatorio del environment.

## 🟡→✅ H03 · Las asserts miran el job, no el archivo

```js
function job(yaml, name) { /* recorta el bloque de un job */ }

assert.match(job(migrate, 'staging'), /^\s+environment: staging$/m);
assert.match(job(migrate, 'production'), /^\s+environment: production$/m);
```

Y la prueba del actor pasó a afirmar la **ausencia** de lo viejo y la presencia de lo nuevo:

```js
assert.doesNotMatch(production, /github\.actor/);
assert.match(production, /GITHUB_ACTOR/);
assert.match(production, /"\$SUPABASE_PROJECT_REF" = "\$SUPABASE_STAGING_PROJECT_REF"/);
```

Es `AG-25`. El helper recorta por string en vez de parsear YAML —frágil si alguien agrega una clave de dos espacios—, pero cubre lo que tiene que cubrir y se demuestra.

## 🟡→✅ H04 · Avisa, como pide el DoD

`process.exitCode = 1` → `console.warn('::warning::…')`, con prueba de conducta: lanza el script con `spawnSync` y verifica `status 0`, `Supera el límite` en stdout y `::warning::` en stderr.

---

## 🟡 H06 · El aviso dice algo falso cuando no pudo leer nada

**`check-bundle-budget.mjs:29` · medio · nuevo**

```js
ok: routes.length > 0 && routes.every(({ sizeKb }) => sizeKb <= maxKb)
```

Dos estados muy distintos colapsan en `ok: false`: **«ninguna ruta se parseó»** y **«alguna ruta supera el presupuesto»**. El único mensaje que emite el script habla del segundo.

Corriéndolo con una salida que el regex no reconoce:

```
| — | — | No se pudo leer el resultado de Next.js |

::warning::Alguna ruta supera el presupuesto de First Load JS.
EXIT=0
```

El job **no midió nada**, **afirma algo falso** y **no bloquea**. Antes del arreglo de H04, este caso al menos fallaba.

Importa porque el regex depende de los glifos de `next build` (`┌├└│` y `○ƒλ●`): una actualización de Next.js que cambie el formato cae justo acá, y el job se volvería decorativo sin que nadie se entere.

Es `AG-14`: un arreglo no puede reducir otro control.

**Cómo arreglarlo.** Separar los dos estados: si no se parseó ninguna ruta, **fallar** —el control no está funcionando—; si hay rutas y alguna supera, `::warning::` con los nombres y exit 0, que es lo que pide el DoD. Y sumar el caso ilegible a la prueba.

## 🟡 H05 · Sigue abierto, y es el único que no puede resolver T-003

```
pnpm test → Test Files 9 passed (9) · Tests 71 passed (71)
```

`verify-workflows.test.mjs` no está: las 12 pruebas de los workflows solo corren en el job `unit` de CI. Los dos `.mjs` siguen sin `typecheck` ni `lint`.

Arreglarlo necesita `package.json` o `vitest.config.ts`, los dos fuera de la ficha. La bitácora lo registra y propone una tarea que autorice la configuración de checks — que me parece bien, pero es decisión tuya.

---

## Alcance

7 archivos, **0 fuera de la ficha**. Es la primera ronda en la que esta carpeta de revisión no genera desvío, porque la PR #53 sumó `docs/revision-pr/**` a las 27 fichas.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H06** — separar «no pude leer» de «supera el presupuesto» | agy |
| 2 | **H05** — dónde viven los `.mjs` para que los checks los alcancen | **@Lautaro073** |

Aparte, y fuera de la revisión del código: cargar `SUPABASE_PRODUCTION_PROJECT_REF`, configurar revisores obligatorios en los dos environments, y las demostraciones en vivo que pide el DoD (migración vacía en staging, dos merges seguidos, PRs de prueba de la política).
