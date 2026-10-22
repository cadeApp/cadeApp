# PR #51 · Ronda 3 — `1381d86`

| | |
|---|---|
| **SHA revisado** | `1381d86` |
| **Commits nuevos** | `038f8cc` (H06), `a47af09` (H05), `98d6d3b`/`1c8d7ed` (demostración remota), bitácoras |
| **Base** | `75d00cc` (merge-base con `origin/develop`) |
| **Tamaño** | 13 archivos |
| **Fecha** | 2026-09-21 |

## Veredicto

**H05 y H06 cerrados.** H06 está verificado en rojo. H05 tiene tres tercios y **dos son controles reales**: `typecheck` y `pnpm test` ahora alcanzan los `.mjs`, demostrado en rojo cinco veces y —lo mejor de la ronda— **también en el runner de GitHub**. El tercio de `lint` corre, lee los tres archivos y **no puede fallar**: ninguna de las 55 reglas que resuelve puede dispararse sobre un módulo de Node.

Lo que apareció al leer el camino de aceptación de punta a punta es más interesante que el lint: **la sección «Informe de revisión de agy» de este cuerpo no pasa el control que esta misma PR construye.** Lo verifiqué ejecutando `evaluateApprovalPolicy` contra el cuerpo real del PR.

| | |
|---|---|
| Cerrados y verificados | **6 de 6** (H01–H06) |
| Abiertos | 5 (3 medios, 2 azules) |
| Bloqueantes de código | **0** |
| Alcance | 13 archivos, **0 fuera de la ficha** |

**Lo que impide mergear no es código:** `db-types` sigue rojo por el stub de `database.types.ts` (T-004), la PR sigue en Draft y faltan las demostraciones en vivo del DoD.

## Checks en `1381d86`

| Comando | Alcance real | Resultado |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit` + `tsc --project .github/workflows/tsconfig.json` | exit 0 |
| `pnpm lint` | `next lint --dir src --file middleware.ts` + `eslint` sobre 3 `.mjs` | exit 0 |
| `pnpm test` | `vitest run` + `node --test` de los workflows | **72/72 · 16/16** |
| `git diff --check` | todo el rango | limpio |
| CI (run 35676503236) | 8 jobs | **7 pass**, `db-types` fail (drift de T-004) |
| Alcance | 13 archivos vs. «Archivos permitidos» | **0 fuera** |

`pnpm build` no lo repetí localmente: el job `build` de CI pasó y `bundle-budget` midió sobre su salida real.

---

## 🟡→✅ H05 · Dos tercios reales, uno nominal

### `typecheck`: real, y demostrado en los dos lados

Local, plantando un error de tipos en un `.mjs`:

```
.github/workflows/check-bundle-budget.mjs(52,50): error TS2551:
  Property 'toFixed' does not exist on type 'string'.
TC_EXIT=2
```

Y **en Actions**, que es lo que de verdad importa: el commit `98d6d3b` agregó `type-error-probe.mjs` con un `@type {number}` asignado a un string, el job `typecheck` **falló** en el [run 35676222759](https://github.com/cadeApp/cadeApp/actions/runs/35676222759), y `1c8d7ed` lo retiró. Lo comprobé por API:

```
head_sha=98d6d3b  conclusion=failure
typecheck  failure      ← el probe
lint       success      ← ver H07
```

Es la primera vez en cuatro PRs que un control se demuestra en rojo **en el runner y con el run enlazado en el cuerpo**, no solo en la máquina de quien lo escribió. Eso vale más que las cinco demostraciones locales juntas.

El `tsconfig.json` dentro de `.github/workflows/` es la decisión más fina de la ronda: resuelve el problema sin tocar el `tsconfig.json` raíz —que está fuera de la ficha—, hereda `noEmit` del padre (comprobado: el árbol queda limpio después de `pnpm typecheck`) y pone `incremental: false` para no pelearse con el `.tsbuildinfo` del raíz.

Un detalle que verifiqué porque parecía un error y no lo es: el JSDoc de una sola línea con tres `@param` **tipa los tres**. Lo probé con un archivo aparte: TS marca el segundo y el tercero igual que si estuvieran en líneas separadas.

### `pnpm test`: real, y el control no es autorreferencial

`pnpm test` ahora corre Vitest **y** `node --test` de los workflows: 72/72 y 16/16.

La pregunta obvia es quién cuida al cuidador: si alguien saca el `&& node --test ...` de `package.json`, la prueba que lo detecta deja de correr. No es un agujero, porque **`ci.yml:70` corre `node --test` aparte de `pnpm test`**. Así que en CI la prueba sigue ejecutándose y falla. Está bien cerrado.

### Las cinco demostraciones en rojo

Rompí cada control por separado y corrí la suite:

| Qué rompí | Suite | Quién falló |
|---|---|---|
| Saqué `&& node --test` de `pnpm test` | `15 pass 1 fail` | `pnpm test includes workflow behavior tests` |
| Saqué `&& eslint` de `pnpm lint` | `15 pass 1 fail` | `pnpm lint checks workflow modules...` |
| Saqué `&& tsc --project` de `pnpm typecheck` | `15 pass 1 fail` | `pnpm typecheck checks workflow modules...` |
| Puse `checkJs: false` en el tsconfig | `15 pass 1 fail` | `pnpm typecheck checks workflow modules...` |
| Vacié el `include` del tsconfig | `15 pass 1 fail` | `pnpm typecheck checks workflow modules...` |
| Restaurado | **`16 pass 0 fail`** | — |

Cada rotura hace fallar exactamente la prueba que le corresponde, y el árbol queda limpio.

### La ampliación de la ficha es legítima

`package.json` entró a «Archivos permitidos» en esta misma PR. Eso está bien y no es un desvío:

- **`package.json` y `.github/` son la misma zona**, P1 · Lautaro073 (`docs/implementation-plan.md:46`). No hay cruce de zona, a diferencia del H16 de la #49.
- La línea 106 del plan dice que los archivos raíz «son de Lautaro073. Otras zonas los tocan solo si la ficha lo dice». T-003 es P1 y la ficha ahora lo dice.
- **El permiso está acotado y el diff respeta el límite:** «solo scripts de calidad para cubrir los workflows; sin dependencias nuevas». Cambió 3 scripts, 0 dependencias, `pnpm-lock.yaml` intacto.
- La bitácora declara **autorización expresa de Lautaro073**. Eso no lo puedo verificar yo; queda registrado como declarado.

## 🟡 H06 · Cerrado y verificado en rojo

`check-bundle-budget.mjs` ahora devuelve `routeCount` y separa los dos estados: 0 rutas → `::error::` y `exit 1`; rutas medidas con alguna sobre 180 kB → `::warning::` y exit 0, que es lo que pide el DoD.

Revertí el arreglo al comportamiento anterior y la suite cayó a **`15 pass 1 fail`**, en `bundle budget fails when no route can be read from the build output`.

Y la mejor evidencia de que el arreglo no rompe nada es el CI real: el job midió **dos rutas de verdad**.

```
## First Load JS por ruta (límite 180 kB)
| / | 87.2 kB | OK |
| /_not-found | 88 kB | OK |
```

Esto contesta la pregunta que dejó abierta la ronda 2: el regex **sí** parsea la salida real de `next build`, así que el `exit 1` nuevo no va a disparar por sorpresa. Si alguna vez dispara, será porque Next cambió el formato — que es exactamente cuando hay que enterarse.

---

## 🟡 H07 · El tercio de `lint` corre, lee los archivos y no puede fallar

**`package.json` · medio**

El comando existe y no es un no-op: pedí el informe en JSON y **inspecciona los 3 archivos**.

```
archivos inspeccionados: 3
   approval-policy.mjs        msgs=0
   check-bundle-budget.mjs    msgs=0
   verify-workflows.test.mjs  msgs=0
```

El problema es la configuración que resuelve. `eslint --print-config` sobre uno de los `.mjs` da **55 reglas activas** y ninguna puede dispararse sobre un módulo de Node:

| Familia | Por qué no aplica |
|---|---|
| `@next/next/*`, `react/*`, `react-hooks/*`, `jsx-a11y/*` | son de React y de Next |
| `boundaries/*` | `boundaries/include` es `src/**/*`, `middleware.ts`, `tools/lint-fixtures/**/*`. `.github/` no está: las reglas quedan inertes |
| `cadeapp/*`, `no-restricted-imports` | apuntan a las capas de `src/` |

**No hay `eslint:recommended`**, así que no hay `no-unused-vars`, ni `no-undef`, ni `no-unreachable`, ni `no-debugger`. Planté cinco defectos clásicos en `check-bundle-budget.mjs` —variable sin usar, función sin usar, código inalcanzable, bloque vacío, `debugger`— y:

```
$ pnpm lint
✔ No ESLint warnings or errors
LINT_EXIT=0
```

Lo único que lo hace fallar es un error de sintaxis (`53:0 error Parsing error`), y eso ya lo atrapa `tsc`. O sea: el tercio de lint de H05 **no agrega ninguna cobertura sobre la que ya da el typecheck**. Y la prueba nueva afirma que el comando está en `package.json`, lo que se lee como «cubierto».

**Cómo arreglarlo, sin salir de la ficha.** Igual que el `tsconfig.json`: un `.eslintrc.json` **dentro de `.github/workflows/`**, que cascadea sobre el raíz. Lo probé y con los mismos cinco defectos plantados da:

```
  53:10  error  'muerta' is defined but never used   no-unused-vars
  55:3   error  Unreachable code                     no-unreachable
  57:5   error  Unexpected constant condition        no-constant-condition
  57:11  error  Empty block statement                no-empty
  58:1   error  Unexpected 'debugger' statement      no-debugger
✖ 7 problems
ESLINT_EXIT=1
```

Con `{ "extends": ["eslint:recommended"], "env": { "node": true, "es2022": true }, "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" } }`. El `env: node` hace falta o `no-undef` marca `process` y `console`.

**Ojo con el séptimo problema**, que es real y ya está en el árbol: `no-regex-spaces` en `verify-workflows.test.mjs:23`. Los dos espacios del regex son a propósito (la indentación de YAML), pero se escriben `{2}`, que además dice lo que quiere decir.

Aparte, y menor: la prueba nueva fija el diseño con un `assert.match` sobre el literal `eslint --no-ignore --ext .mjs`. ESLint 9 elimina `--ext`, así que el día de la actualización el test va a impedir el arreglo. Es la misma observación que hice en la ronda 1 sobre el `assert` que fijaba `github.actor`.

## 🟡 H08 · El informe del cuerpo no pasa el control que esta PR construye

**cuerpo del PR · medio · verificado ejecutando**

`approval-policy.mjs:23` exige que la sección «Informe de revisión de agy» traiga seis cadenas literales, las que emite la skill (`.agents/skills/revisar-pr/SKILL.md:40`):

```
Informe revisar-pr — T-xxx — <fecha> — generado por <persona>
Resultado: SIN BLOQUEANTES
Checks locales: ...
BLOQUEANTES:
MEJORAS:
No revisado / dudas para Lautaro073:
```

Hoy esa sección es prosa. Corrí el módulo real contra el cuerpo real del PR y las reviews reales (que son cero):

```
--- tal como está el PR #51 hoy ---
{ ok: false, reason: 'El PR de Lautaro073 requiere aprobación de otra persona.' }

--- suponiendo que P2 ya aprobó ---
{ ok: false, reason: 'Falta el informe completo de revisar-pr sin bloqueantes.' }

--- con el informe en el formato que exige la skill ---
{ ok: true, reason: 'Aprobación externa e informe completos.' }
```

**No bloquea a esta PR:** `pull_request_target` usa la definición de la rama base, y `origin/develop` todavía no tiene `.github/workflows/` (lo comprobé con `git ls-tree`). Por eso `approval-policy` no aparece en `gh pr checks 51`. Bloquea **desde la PR siguiente**, empezando por T-004.

Importa por algo que no es formato: el template dice *«Si el PR es de Lautaro073, lo genera quien aprueba»*, y mis informes de ronda **no tienen ese formato**. De acá en adelante, quien apruebe una PR de P1 tiene que pegar el bloque literal de la skill, no un resumen.

## 🟡 H09 · La política exige para P1 algo que §2 no pide, y eso ata el verde a un re-run

**`approval-policy.mjs:41` · medio · a verificar en la demostración en vivo**

El plan describe el check así (`docs/implementation-plan.md:60`):

> falla si un PR de P2 o P3 no tiene la aprobación de Lautaro073, **o si un PR de Lautaro073 no tiene la sección de informe de agy completa**.

Para un PR de P1 el script exige **dos** cosas: el informe (lo que dice §2) y además una review `APPROVED` de otra persona. La aprobación de par ya la pide la protección de rama (`docs/implementation-plan.md:197`), así que acá es una segunda copia — y trae una dependencia que la versión de §2 no tenía: **el check queda rojo hasta que llegue la aprobación, así que el verde depende de un re-run posterior al review.**

El workflow lo previó: dispara con `pull_request_review: [submitted, edited, dismissed]`. Lo que hay que confirmar es **dónde queda ese run**: un workflow disparado por `pull_request_review` corre sobre la rama base, y si su check run se adjunta al commit de la base en vez de al head del PR, no sirve para poner en verde un check requerido del PR. El camino de repuesto existe (`pull_request_target` también dispara con `edited`, así que editar el cuerpo refresca el check), pero conviene no depender de que alguien lo sepa.

No lo puedo comprobar acá porque el workflow no está en la base. **Va en la demostración en vivo que el DoD ya pide**, con este caso explícito: PR de P1 → check rojo → llega la aprobación de P2 → *¿el check del PR pasa a verde solo?* Si no, lo más simple es sacar la aprobación de par del script y dejársela a la protección de rama, que es lo que §2 describe.

## 🔵 H10 · El checklist de seguridad del cuerpo no es el del template

**cuerpo del PR · bajo**

El cuerpo escribió sus propios cuatro ítems en vez de los cinco del template, y el que quedó afuera es el ítem 5: *«Ningún check, regla de lint o umbral de CI debilitado»*. Es justo el que aplica a esta ronda, porque la PR **edita los tres scripts de check** y en la ronda 2 `bundle-budget` pasó de bloquear a avisar.

La respuesta es buena, y por eso conviene que esté escrita: no se debilitó nada en silencio. Los tres scripts solo **sumaron** comandos, y la relajación de `bundle-budget` es la decisión de H04 —la letra del DoD dice «avisa»— compensada con un `exit 1` nuevo cuando no se puede leer la salida.

Falta también la sección **«Dependencias nuevas»**, que diría `ninguna`: es la confirmación en una línea del límite que la ficha se puso a sí misma. Y la casilla «Cada prueba nueva se demostró fallando» está cubierta en prosa en «Evidencia de checks», pero sin la casilla.

«Rutas de otra zona» está bien omitida: `package.json` y `.github/` son zona P1, la propia.

Por qué ningún control lo atajó: `approval-policy` lee el cuerpo, pero solo mira la sección del informe de agy. El checklist de seguridad no lo verifica nada — lo verifica quien aprueba, que es el punto 3 de §2.

## 🔵 H11 · «Prettier ✅» no es reproducible (nivel repo, no de T-003)

**bajo · fuera del alcance de T-003**

La bitácora anota `Prettier ✅` en cinco entradas. No se reproduce:

```
$ npx prettier --check <los 7 archivos de la ronda>
[warn] .github/workflows/check-bundle-budget.mjs
[warn] docs/tasks/T-003.md
[warn] docs/tasks/log/T-003.md
```

Pero también falla en archivos que esta PR **nunca tocó** (`ci.yml`, `middleware.ts`, `docs/onboarding.md`, `docs/tasks/T-002.md`), y el diff contra la salida de Prettier es `1,50c1,50` con el contenido idéntico: **lo único que difiere son los fines de línea.** `core.autocrlf=true`, no hay `.gitattributes`, y `.prettierrc` no fija `endOfLine`, cuyo default es `lf`. En un checkout de Windows, `prettier --check` no puede pasar nunca.

No afecta ninguna compuerta: Prettier no es un job de CI. Lo anoto porque es una casilla que cinco bitácoras dan por verificada y no lo está. Se arregla con `* text=auto eol=lf` en `.gitattributes` o `"endOfLine": "auto"` en `.prettierrc`, los dos fuera de T-003.

---

## Alcance

13 archivos, **0 fuera de la ficha** — quinta ronda consecutiva en cero. `package.json` cuenta como dentro porque la ficha lo declaró en esta misma PR, acotado y sin dependencias nuevas.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H07** — `.eslintrc.json` dentro de `.github/workflows/` con `eslint:recommended` + `env: node`, y `{2}` en el regex de la línea 23 | agy |
| 2 | **H08** — pegar el informe en el formato literal de la skill en «Informe de revisión de agy» | quien apruebe |
| 3 | **H10** — ítem 5 del checklist de seguridad con la justificación de `bundle-budget`, y «Dependencias nuevas: ninguna» | agy |
| 4 | **H09** — ¿la aprobación de par se queda en el script o se la deja a la protección de rama? | **@Lautaro073** |
| 5 | **H11** — `.gitattributes` o `endOfLine: auto` | **@Lautaro073**, en otra tarea |

Fuera de la revisión, y es lo que de verdad falta: `SUPABASE_PRODUCTION_PROJECT_REF` en Actions, revisores obligatorios en los environments (`protection_rules: []` en los dos), la sincronización de `database.types.ts` (T-004) para que `db-types` pase, y las demostraciones en vivo del DoD —migración vacía en staging, dos merges seguidos, y la política sobre PRs reales con el caso de H09 incluido.
