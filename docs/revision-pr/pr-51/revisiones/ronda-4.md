# PR #51 · Ronda 4 — `17b7661`

| | |
|---|---|
| **SHA revisado** | `17b7661` |
| **Commits nuevos** | `33ebe3c` (H07 + el regex `{2}`), `17b7661` (bitácora) · cuerpo del PR reescrito (H10) |
| **Base** | `75d00cc` |
| **Tamaño** | 17 archivos |
| **Fecha** | 2026-09-21 |

## Veredicto

**Los tres hallazgos que T-003 podía cerrar están cerrados.** H07 verificado en rojo tres veces, H10 cerrado en el cuerpo, y H09 resuelto por decisión — con una razón que **corrige mi premisa**, no que la esquive.

Queda una sola cosa de esta revisión, y no la puede hacer el agy: **H08 es mío**, el bloque literal de la skill para el cuerpo. Está más abajo, listo para pegar. H11 es de nivel repo y vive en otra tarea.

| | |
|---|---|
| Cerrados y verificados | **9 de 11** |
| Abiertos | 2 (H08, mío · H11, nivel repo) |
| Bloqueantes de código | **0** |
| Alcance | 17 archivos, **0 fuera de la ficha** — sexta ronda |

**El código de T-003 está terminado.** Lo que falta para mergear es de afuera: `db-types` rojo hasta que T-004 sincronice `database.types.ts`, la PR en Draft, y las demostraciones en vivo que solo se pueden hacer con los workflows ya en la rama base.

## Checks en `17b7661`

| Comando | Resultado |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm test` | **72/72 Vitest · 17/17 workflows** |
| CI (run 35680668110) | **7 pass**, `db-types` fail (drift de T-004) |
| `unit` en CI, en Linux | **17/17** — la prueba nueva del lint corre también allá |
| Árbol después de `pnpm test` | limpio |
| Alcance | 17 archivos, **0 fuera** |

---

## 🟡→✅ H07 · El lint dejó de ser decorativo

El arreglo es el que propuse, y **sumó algo que yo no había pedido: una prueba de conducta.**

```json
{
  "extends": ["eslint:recommended"],
  "env": { "node": true, "es2022": true },
  "parserOptions": { "ecmaVersion": 2022, "sourceType": "module" }
}
```

Y en `verify-workflows.test.mjs`, en vez de afirmar que el comando está en `package.json`, la prueba **escribe un `.mjs` con un defecto real, corre ESLint de verdad y exige que falle**:

```js
writeFileSync(probe, 'const unused = 1;\ndebugger;\n');
assert.notEqual(result.status, 0, result.stderr);
assert.match(result.stdout, /no-unused-vars/);
assert.match(result.stdout, /no-debugger/);
```

Eso es exactamente `AG-26`. El contraste con la ronda 3 es el dato: ahí los tres controles de H05 se probaron con `assert.match` sobre `package.json`, y el único que quedó mal fue justo el que ningún defecto plantado había ejercitado.

### Las tres demostraciones en rojo

| Qué rompí | Suite | Quién falló |
|---|---|---|
| Borré `.github/workflows/.eslintrc.json` | `16 pass 1 fail` | `workflow lint rejects unused code and debugger statements` |
| Cambié `eslint:recommended` por `no-unused-vars: off` | `16 pass 1 fail` | idem |
| Borré `environment: production` de `migrate.yml` | `16 pass 1 fail` | `migration workflow serializes staging and production pushes` |
| Restaurado | **`17 pass 0 fail`** | — |

La tercera no es sobre H07: es para comprobar que el cambio de `/\n  [\w-]+:\n/` a `/\n {2}[\w-]+:\n/` **no debilitó el recortador de jobs** que cerró H03. Sigue atrapando el borrado de la compuerta de producción.

### Y la prueba de punta a punta

Los mismos cinco defectos que en la ronda 3 pasaban en verde:

```
  52:7   error  'noUsado' is assigned a value but never used  no-unused-vars
  53:10  error  'muerta' is defined but never used            no-unused-vars
  55:3   error  Unreachable code                              no-unreachable
  57:5   error  Unexpected constant condition                 no-constant-condition
  57:11  error  Empty block statement                         no-empty
  58:1   error  Unexpected 'debugger' statement               no-debugger
✖ 6 problems   LINT_EXIT=1
```

Y el `no-regex-spaces` que el arreglo destapaba quedó resuelto en la misma pasada, con `{2}`.

**Un detalle del diseño, que está bien resuelto y vale decirlo.** La prueba escribe el probe *dentro* de `.github/workflows/`, no en un temporal, y tiene que ser así: la configuración nueva cascadea por directorio, así que un archivo en `/tmp` no la recibiría y la prueba mediría otra cosa. El `try/finally` lo borra y el árbol queda limpio; el nombre lleva el pid para que dos corridas no se pisen. El único residuo posible es un `lint-probe-<pid>.mjs` si alguien corta la corrida con Ctrl-C, y en ese caso `lint` y `typecheck` fallan con el nombre del archivo a la vista. Una línea en `.gitignore` lo cerraría del todo, pero está fuera de la ficha y no vale abrir alcance por eso.

## 🔵→✅ H10 · El cuerpo ya trae los cinco ítems

El ítem 5 está, con la justificación:

> **Ningún check ni regla de lint debilitados.** Los scripts sumaron controles; `bundle-budget` mantiene el límite de 180 kB, avisa si se supera según el DoD y falla si no puede leer rutas.

Es la respuesta correcta y es verificable: los tres scripts solo sumaron comandos, y la relajación de `bundle-budget` es la decisión de H04 compensada con el `exit 1` de H06. También entraron «Dependencias nuevas: ninguna» —la confirmación en una línea del límite que la ficha se puso— y la casilla «Cada prueba nueva se demostró fallando».

## 🟡→✅ H09 · La decisión corrige mi premisa

Yo argumenté que la aprobación de par en el script era una copia de lo que ya pide la protección de rama. **No lo es, porque la protección de rama no existe:** el plan del repo privado no la habilita y `gh api` devuelve 403 sobre `develop`, `staging` y `main`. Con eso, la línea del script no es una segunda copia — es **la única** que hace cumplir §2 hoy.

Decisión registrada: se queda mientras la protección no esté disponible. Es la correcta, y el §2 que yo citaba describe el reparto de aprobaciones, no un límite a lo que el check puede exigir.

Lo que sigue abierto de H09 es la otra mitad, y la bitácora la anota: **verificar con una PR real que el run disparado por `pull_request_review` actualiza el check del PR**, no el de la rama base. Va en las demostraciones en vivo, que ya estaban pendientes.

---

## 🟡 H08 · Sigue abierto y es mío

El agy hizo lo correcto: **no inventó el informe.** El cuerpo dice que el bloque literal lo pega quien apruebe, que es lo que manda el template. Yo soy quien produce la revisión, así que el bloque va acá abajo.

No lo publico todavía, por dos razones: `db-types` sigue rojo y hay dos ítems abiertos, así que la PR no está para aceptar; y el bloque lleva fecha, por lo que si entran commits antes del merge hay que refrescarlo contra el SHA final (ver la regla de `verificado_en_sha`).

Para pegar en «Informe de revisión de agy» cuando la PR pase a Ready:

```
Informe revisar-pr — T-003 — 2026-09-21 — generado por quien apruebe
Resultado: SIN BLOQUEANTES
Checks locales: typecheck ✅ · lint ✅ · test ✅ (72/72 Vitest, 17/17 workflows) · test:db n.a.
BLOQUEANTES:
- ninguno
MEJORAS:
- ninguna pendiente en el código de T-003
No revisado / dudas para Lautaro073:
- db-types falla por el drift real de src/types/database.types.ts; lo sincroniza T-004
- SUPABASE_PRODUCTION_PROJECT_REF todavía no existe en Actions
- Los environments staging y production siguen con protection_rules: []
- Demostraciones en vivo pendientes: migración vacía en staging, dos merges seguidos, política de aprobación sobre PRs reales (incluyendo si el run por pull_request_review actualiza el check del PR)
- .gitattributes / endOfLine para que prettier --check sea reproducible en Windows
```

Comprobado ejecutando: con ese bloque y una aprobación de otra persona, `evaluateApprovalPolicy` devuelve `{ ok: true }`; sin la aprobación, `ok: false` con el motivo correcto.

De paso quedó contestada una duda que tenía sobre el script: **la API de GitHub devuelve el cuerpo con `\r\n` y `hasCompleteReport` no normaliza los fines de línea.** Lo probé con el mismo cuerpo en LF y en CRLF y da `ok: true` en los dos casos — las seis expresiones son de una sola línea y el `[^\n]*$` del split absorbe el `\r`. No hay problema ahí.

## 🔵 H11 · Sigue abierto, nivel repo

La bitácora lo atendió con honestidad: corrió Prettier con `--end-of-line auto` y lo anotó así, en vez de dejar un `Prettier ✅` que no se reproduce. El arreglo de fondo —`.gitattributes` con `* text=auto eol=lf`, o `endOfLine: auto` en `.prettierrc`— sigue fuera de T-003.

---

## Alcance

17 archivos, **0 fuera de la ficha**. Sexta ronda consecutiva en cero. `.github/workflows/.eslintrc.json` entra por el glob de la ficha, igual que el `tsconfig.json`.

## Para cerrar

| # | Qué | Quién |
|---|---|---|
| 1 | **H08** — pegar el bloque de arriba en el cuerpo cuando la PR pase a Ready | **quien apruebe** |
| 2 | Sincronizar `database.types.ts` para que `db-types` pase | **T-004** |
| 3 | `SUPABASE_PRODUCTION_PROJECT_REF` y revisores obligatorios en los environments | **@Lautaro073**, configuración |
| 4 | Las demostraciones en vivo del DoD, con el caso de H09 incluido | **@Lautaro073**, después del merge |
| 5 | **H11** — `.gitattributes` o `endOfLine: auto` | **@Lautaro073**, otra tarea |

Nada de esto es código de T-003. **La tarea, como código, está terminada.**
