# PR #51 · Ronda 1 — `631dc1e`

| | |
|---|---|
| **SHA revisado** | `631dc1e` |
| **Base** | `cdf6d13` |
| **Tamaño** | 7 archivos, +649 / −0 |
| **Fecha** | 2026-09-21 |

## Veredicto

**El trabajo está bien hecho.** Es la mejor primera ronda de las cuatro PRs revisadas: las decisiones difíciles —que son de seguridad— están tomadas correctamente, hay pruebas de conducta y no de forma para los dos módulos ejecutables, y la bitácora es honesta sobre lo que falta.

**No es mergeable todavía**, por un hallazgo crítico: **el job de migración de producción apuntaría a la base de staging.**

| | |
|---|---|
| Abiertos | 5 (1 crítico, 1 alto, 3 medios) |
| Alcance | **0 archivos fuera de la ficha** |
| DoD | sin marcar, correctamente |

## Checks

| Job en CI | Resultado |
|---|---|
| `typecheck`, `lint`, `unit`, `build`, `db-tests`, `bundle-budget`, `audit` | **pass** (7/8) |
| `db-types` | **fail** — variables de Actions vacías, ya diagnosticado aparte |

Local: `pnpm typecheck` exit 0 · `pnpm lint` limpio · `pnpm test` 71/71 · `pnpm build` exit 0.

---

## Lo que está bien, y no es poco

Esto merece decirse antes de los hallazgos, porque es la parte difícil y está resuelta:

- **Todas las Actions fijadas por SHA de 40 caracteres**, y hay un test que recorre *todos* los `.yml` del directorio y lo exige. No es una lista que se desactualiza: es un barrido.
- **`permissions: contents: read`** a nivel workflow, y `persist-credentials: false` en cada checkout.
- **`approval-policy` usa `pull_request_target` correctamente.** Hace checkout de `base.sha` y corre el script de la base, no el del PR. Esa es la diferencia entre un workflow seguro y una vía de ejecución arbitraria con el token del repo, y está bien del lado seguro.
- **`db-types` aplica el mismo patrón**: instala y ejecuta desde `trusted/`, trae el archivo del PR como dato a `proposal/`. El código del PR nunca corre con el token de Supabase.
- **El interruptor `mode=local` / `mode=remote`** de `db-types`: si la PR toca `supabase/migrations`, compara contra la base local; si no, contra staging. Eso evita que T-004 se bloquee a sí misma cuando develop vaya por delante de staging. Está bien pensado y yo esperaba encontrar ese problema.
- **`concurrency: migrate-<ambiente>` con `cancel-in-progress: false`**, como pide el DoD.
- **Pruebas de conducta reales** para los dos `.mjs`: la lógica de aprobación se ejerce con reviews sintéticas (aprobación vigente, comentario que no la revoca, cambio solicitado que sí), y el parser del bundle con una salida de `next build` que supera el presupuesto.
- **Demostrado en rojo primero.** La bitácora registra «8/8 pruebas fallan en rojo» antes de implementar.
- **La bitácora no miente.** Dice «No se marca el DoD completo», lista los bloqueos y anota que `production` tiene `protection_rules: []`.

---

## 🔴 H01 · Producción migraría contra la base de staging

**`migrate.yml:67` · crítico**

Los dos jobs leen la misma variable:

```yaml
SUPABASE_PROJECT_REF: ${{ vars.SUPABASE_PROJECT_REF }}
```

`vars` a nivel repositorio es una sola. Lo comprobé:

```
$ gh api repos/cadeApp/cadeApp/actions/variables
  SUPABASE_PROJECT_REF = axwvmyqwhwfghyjdufny      ← el proyecto de staging

$ gh api .../environments/staging/variables        → (vacío)
$ gh api .../environments/production/variables     → (vacío)
```

Una variable definida dentro de un environment pisa a la de repositorio. Ninguno de los dos environments define ninguna. Así que el job `migrate-production` resuelve el ref **de staging**.

Y el guard solo mira que no esté vacía:

```bash
if [ -z "$SUPABASE_ACCESS_TOKEN" ] || [ -z "$SUPABASE_DB_PASSWORD" ] || [ -z "$SUPABASE_PROJECT_REF" ]; then
```

**El modo de falla es el peor posible:** `supabase db push` se aplica a la base equivocada y el job reporta éxito. Producción nunca recibe el esquema y nadie se entera.

**Cómo arreglarlo.** Nombres distintos (`SUPABASE_STAGING_PROJECT_REF` / `SUPABASE_PRODUCTION_PROJECT_REF`), o definir la variable dentro de cada environment. Y que el job de producción **falle** si el ref coincide con el de staging: un chequeo de tres líneas que convierte un desastre silencioso en un error ruidoso.

## 🟠 H02 · El filtro de quién migra saltea el job, y saltear es verde

**`migrate.yml:46` · alto**

```yaml
if: github.ref_name == 'main' && github.actor == 'Lautaro073'
```

Si el push a `main` lo hace otra persona, GitHub **no ejecuta el job y lo marca como skipped**, que no rompe ningún check. El release sale con el código y sin la migración.

¿Puede pasar? §3 dice *«Merge: squash, hecho por el autor después de la aprobación»*, y §6 solo dice que Lautaro073 **aprueba** `staging → main` — no que lo abra ni que lo mergee. El actor no está garantizado.

Agravante: el environment que debería atajarlo no atája nada todavía.

```
$ gh api .../environments/production → {"protection_rules": []}
```

Sin reviewers obligatorios, detrás del skip no hay nada.

**Cómo arreglarlo.** Sacar `github.actor` de la condición y dejar que lo haga cumplir el environment `production` con revisores obligatorios, que **bloquean** en vez de saltear. Si se quiere además un freno en el YAML, que sea un paso que falle, no un `if` que saltee.

> Ojo: `verify-workflows.test.mjs:66` afirma que el YAML contiene ese literal exacto. El test fija el diseño en vez de probar la conducta, así que **hay que tocarlo también** o va a impedir el arreglo.

## 🟡 H03 · El test de la compuerta de producción no la ve

**`verify-workflows.test.mjs:62` · medio**

```js
assert.match(migrate, /environment:\s*(staging|production)/);
```

Busca **una** aparición en todo el archivo. Borrando `environment: production` del segundo job, el regex encuentra `environment: staging` en el primero y el test pasa.

Es la línea más sensible de toda la PR: sin ella, una migración a producción corre sin aprobación de ambiente.

El resto de los `assert` del archivo tienen la misma forma. `assert.match(ci, /180/)` pasa si el número 180 aparece en cualquier lado; `/cancel-in-progress:\s*false/` no está atada al job de migración.

**Cómo arreglarlo.** Parsear el YAML y comprobar por job, o como mínimo exigir las dos cadenas por separado.

## 🟡 H04 · El DoD pide que avise y el job bloquea

**`check-bundle-budget.mjs:42` · medio**

El DoD dice: *«job `bundle-budget` **informa** el first-load JS por ruta y **avisa** si supera el presupuesto de la regla 25»*. El script termina con:

```js
if (!result.ok) process.exitCode = 1;
```

Bloquear es más estricto de lo acordado, y hoy una ruta sobre 180 kB frena PRs que no tienen nada que ver con el bundle.

Las dos posturas son defendibles; lo que no va es que la ficha y el job digan cosas distintas. **Decisión del Tech Lead:** o el job pasa a avisar, o se cambia la letra del DoD y del plan.

## 🟡 H05 · Los `.mjs` no pasan por typecheck, ni lint, ni `pnpm test`

**`approval-policy.mjs` · medio**

| Check | Alcance | ¿Cubre `.github/**/*.mjs`? |
|---|---|---|
| `pnpm typecheck` | `tsconfig.include`: `**/*.ts`, `**/*.tsx` | **no** |
| `pnpm lint` | `--dir src --file middleware.ts` | **no** |
| `pnpm test` | `src/**/*.test.{ts,tsx}`, `tools/**/*.test.{ts,tsx}` | **no** |

```
$ pnpm test → Test Files 9 passed (9)   ← verify-workflows.test.mjs no está
```

La única cobertura de los 155 líneas de lógica en `approval-policy.mjs` y `check-bundle-budget.mjs` es `node --test`, que corre **solo dentro del job `unit` de CI**. Quien corra los tres checks del DoD en su máquina no ejercita nada de esto.

La bitácora ya notó la mitad: *«se probó un error de tipos dentro de `.github/workflows/**`, pero `pnpm typecheck` no incluye esa carpeta»*. Lo registró y siguió, que era lo correcto dado el alcance.

**Origen: ambos.** La ficha permite solo `.github/workflows/**`, así que meter ahí código ejecutable lo deja fuera del alcance de los checks **por construcción**. Sumar el comando a `package.json` o mover la lógica a `tools/` como `.ts` requiere archivos que T-003 no permite. Conviene decidirlo antes de seguir.

---

## Alcance

7 archivos, **0 fuera de la ficha**. Cuarta PR consecutiva en cero. La bitácora pudo entrar gracias a la PR #50.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H01** — separar el ref de producción del de staging y fallar si coinciden | agy |
| 2 | **H02** — sacar `github.actor`, apoyarse en el environment, y actualizar el test que lo fija | agy |
| 3 | **H03** — el test de `environment` tiene que ver el job, no el archivo | agy |
| 4 | **H05** — dónde viven los `.mjs` para que los checks los alcancen | **@Lautaro073** (toca archivos fuera de T-003) |
| 5 | **H04** — ¿`bundle-budget` avisa o bloquea? | **@Lautaro073** |

Aparte, y fuera de esta revisión: cargar `SUPABASE_ACCESS_TOKEN`, configurar revisores obligatorios en el environment `production`, y las demostraciones que el DoD pide en vivo (migración vacía en staging, dos merges seguidos, PRs de prueba de la política).
