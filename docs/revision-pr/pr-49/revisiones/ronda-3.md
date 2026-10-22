# PR #49 · Ronda 3 — `17a0be4`

| | |
|---|---|
| **SHA revisado** | `17a0be4` |
| **Commits nuevos** | `fbe7054` (revert), `b0c4c4f` (H04 + H06), `17a0be4` (bitácora) |
| **Base** | `9f03018` |
| **Fecha** | 2026-09-21 |

## Veredicto

**No está para aceptar.** Cerraron H04 y el desvío de alcance A01 —este último por primera vez en las tres PRs—, pero la corrección de H06 no resolvió el problema, la de H03 estaba verificada a medias por mí, y aparecieron **cinco hallazgos nuevos**, uno de ellos crítico.

El crítico no es sutil: **el CLI de Supabase, que es el título de la tarea, no se puede instalar ni ejecutar.**

| | |
|---|---|
| Cerrados y verificados | 5 de 12 (H01, H02, H04, H05, A01) |
| Parciales | 1 (H03) |
| Abiertos | 6 (H06, H07, H08, H09, H10, H11) |

## Checks locales en `17a0be4`

| Comando | Alcance real | Resultado |
|---|---|---|
| `pnpm typecheck` | `tsc --noEmit`, todo el proyecto | exit 0 |
| `pnpm lint` | `next lint --dir src --file middleware.ts --max-warnings 0` | `✔ No ESLint warnings or errors` |
| `pnpm test` | `vitest run` | **65 passed (65)** en 8 archivos |
| **`pnpm install --frozen-lockfile`** | **no está en el DoD** | **exit 1 · `ERR_PNPM_OUTDATED_LOCKFILE`** |

Los tres checks del DoD están en verde. El cuarto comando —el primero que corre cualquiera que clone el repo, y el primer paso del CI de §6— falla. Ese hueco es el hallazgo H07 y explica por qué nada lo atajó.

---

## Lo que sí quedó cerrado

### H04 — `config.toml` formalizado ✅

Decisión tomada: el archivo se queda. Verificado en `17a0be4`:

```
grep -c "supabase/config.toml" docs/tasks/T-002.md          → 1
grep -c "supabase/config.toml" <fila T-002 de implementation-plan.md> → 1
```

En la ronda 2 esto estaba declarado como `arreglado-verificado` con el método «inspección: config.toml formalizado como configuración declarativa del proyecto en la ficha ampliada», y el mismo `grep` daba **0**. Ahora da 1 de verdad.

Residual sin bloquear: ni el onboarding ni `supabase/AGENTS.md` dicen para qué sirve `config.toml` si no se usa Docker local. El próximo que lo lea va a suponer que el stack local está soportado.

### A01 — 0 archivos fuera de alcance ✅

Primera de las tres PRs sin desvío. Los 16 archivos del diff caen todos dentro de la lista de la ficha:

```
BASE: 9f03018 · archivos cambiados: 16 · FUERA DE ALCANCE: 0
```

Dos cosas lo lograron: `supabase/config.toml` entró a los «Archivos permitidos» (H04) y `docs/revision-pr/` salió de la rama con el revert `fbe7054`. Lo segundo es lo correcto —era mi carpeta de revisión, y `COMO-ENTREGAR.md` dice que el dato estructurado va a la rama `docs/revisiones`, nunca a la rama revisada.

### H01, H02, H05 — revalidados en `17a0be4` ✅

No cambió código entre `04d77e9` y `17a0be4` (el diff es solo documentación), y las 65 pruebas siguen en verde. Los tres siguen cerrados, ahora con `verificado_en_sha: 17a0be4`.

---

## 🔴 H07 · El CLI de Supabase está declarado pero no existe

**`package.json:54` · crítico · `P15-entregable-declarado-pero-no-ejecutable`**

El título de la ficha es *«CLI de Supabase en devDependencies con versión exacta»*. La versión exacta está:

```json
"supabase": "2.116.0"
```

Lo que no está es el paquete. `pnpm-lock.yaml` no se regeneró, así que:

```
$ pnpm install --frozen-lockfile
 ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile" because
 pnpm-lock.yaml is not up to date with package.json
   Failure reason:
   specifiers in the lockfile don't match specifiers in package.json:
 * 1 dependencies were added: supabase@2.116.0
 exit 1

$ pnpm supabase --version
 ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL  Command "supabase" not found

$ ls node_modules/supabase
 No such file or directory
```

Consecuencias encadenadas:

- El **paso 2 del onboarding** (`pnpm install --frozen-lockfile`) falla para cualquiera que clone.
- `pnpm db:types` no puede correr (y cuando lo intenta, destruye los tipos — ver H08).
- La validación de drift que H06 prometió mover a CI tampoco podría correr ahí.
- El onboarding dice *«se usa la de `devDependencies` (`pnpm supabase`)»*: es la instrucción que no funciona.

**Aviso importante, para no cargarle a esta PR lo que no es suyo.** Reproduje el check en un directorio aislado con el `package.json` y el `pnpm-lock.yaml` de `origin/develop`: **también da exit 1**, con 28 especificadores desalineados (el lock tiene `^0.5.2` donde el manifest tiene `0.5.2`, etc.). Eso viene de T-000 y está mergeado hace rato — **se me pasó en la revisión de la #47**. O sea:

- El lockfile roto es deuda heredada, no la causó esta PR.
- Esta PR suma el motivo número 29 y, a diferencia de las otras, **depende** de que el CLI se instale para entregar su propio título.

Por qué pasó los checks: el DoD corre `typecheck`, `lint` y `test` sobre un `node_modules` que ya estaba instalado. Ninguno instala nada. Y `tools/verify-approved-packages.test.ts` sí mira `devDependencies`, pero solo comprueba que el **nombre** esté en la lista aprobada —`'supabase'` ya estaba ahí desde T-000—: valida el permiso, no la instalabilidad.

**Cómo arreglarlo.** Regenerar el lockfile. Dos trabas de ficha:

1. `pnpm-lock.yaml` **no está** en los «Archivos permitidos» de T-002. Hay que ampliarla, igual que se hizo con `config.toml`.
2. La ficha dice **«Dependencias nuevas permitidas: ninguna»** mientras su propio título pide agregar el CLI. Hay que resolver esa contradicción explícitamente.

Conviene decidir si se regenera solo la entrada de `supabase` o todo el lock (que arreglaría de paso los 28 de T-000). Lo segundo es más ruidoso pero deja `--frozen-lockfile` funcionando por primera vez.

---

## 🟠 H08 · `db:types` borra los tipos commiteados cuando falla

**`package.json:18` · alto · `P01-contrato-de-framework-no-verificado`**

```json
"db:types": "supabase gen types typescript --project-id cadeapp-staging > src/types/database.types.ts"
```

La shell **abre y trunca** el destino de `>` antes de ejecutar el comando. Si el comando falla, el archivo ya quedó vacío. Demostrado, sin querer, corriéndolo:

```
$ ls -la src/types/database.types.ts   → 405 bytes
$ pnpm db:types
  "supabase" no se reconoce como un comando interno o externo
  ELIFECYCLE Command failed with exit code 1
$ ls -la src/types/database.types.ts   → 0 bytes
$ git status --porcelain               →  M src/types/database.types.ts
```

Lo restauré con `git checkout -- src/types/database.types.ts`; la rama quedó limpia.

No es teórico: hoy el comando **siempre** falla (H07), y cualquier persona que lo corra se lleva puesto el archivo de tipos. Con un `git commit -am` después, desaparece toda la capa de tipos del repo.

Por qué pasó los checks: el test comprueba que el script exista y contenga `supabase gen types`. Nunca lo ejecuta, ni siquiera para ver cómo falla.

**Cómo arreglarlo.** Escribir a un temporal y mover solo con exit 0 y salida no vacía. Ojo: en Windows los scripts de pnpm corren por `cmd`, así que `mv` no sirve. Lo limpio es un `tools/db-types.mjs` —`tools/**` ya está permitido— que corra el CLI, valide el resultado y recién entonces escriba el archivo.

---

## 🟡 H06 · El drift de tipos quedó sin dueño

**`docs/tasks/T-002.md:31` · medio · sigue abierto**

La corrección cambió el DoD de *«tipos generados con `pnpm db:types` sin diff»* a *«en CI se valida que no haya drift de tipos (`db:types`)»*, y lo dejó marcado `[x]`.

```
$ ls .github/workflows
 No such file or directory
```

No hay CI. Eso por sí solo sería tolerable —es T-003—, salvo que **T-003 no se compromete a construirlo**. Su DoD, en `docs/implementation-plan.md:277`, dice *«Un PR con error de tipos queda bloqueado»*, que es `tsc`, no drift de `database.types.ts`. Son cosas distintas: un `database.types.ts` viejo typechequea perfecto.

`grep "drift" docs/` devuelve exactamente tres líneas, y las tres **prometen** la validación; ninguna la **asume como trabajo**:

- `docs/implementation-plan.md:276` (fila T-002)
- `docs/onboarding.md:23` — en presente, sobre un `ci.yml` que no existe
- `docs/tasks/T-002.md:31` — con el `[x]` puesto

El arreglo no resolvió H06: le cambió el domicilio. Antes era una obligación imposible de cumplir; ahora es una obligación de nadie.

**Cómo arreglarlo.** Sacar la cláusula del DoD de T-002 (o dejarla sin marcar y decir que se difiere) y **agregarla al DoD de T-003** como criterio demostrable: *«`ci.yml` falla si `db:types` deja diff, demostrado plantando un diff»*. `docs/implementation-plan.md` está entre los «Archivos permitidos», así que se puede hacer en esta misma PR.

---

## 🟡 H09 · `--project-id` recibe un nombre, no un ref

**`package.json:18` · medio · `P15`**

`--project-id cadeapp-staging` pasa una etiqueta donde el CLI espera el ref del proyecto. De la referencia del CLI:

| Lo que dice la doc | |
|---|---|
| `gen types --project-id <string>` | *Generate types from a project ID* |
| `link --project-ref <string>` | *Project ref of the Supabase project* |
| `supabase init` | *«A `supabase/config.toml` file is created… This configuration is specific to each local project»* |
| `stop --project-id <string>` | *Local project ID to stop* |

El `project_id` de `config.toml` es un identificador **local**; el ref remoto es la cadena de 20 caracteres de la URL del dashboard, no un nombre con guion. Usar el mismo string para las dos cosas es señal de que se confundieron.

Detección por documentación, **no por corrida**: no pude ejecutarlo porque el CLI no está instalado (H07). Queda como `analisis`, no como `verificado-runtime`.

Por qué pasó los checks: el test hace `expect(pkg.scripts['db:types']).toContain('supabase gen types')` — mide el prefijo del comando, no sus argumentos.

---

## 🟡 H10 · La vinculación remota no está entregada

**`docs/tasks/T-002.md:9` · medio · `P15`**

El objetivo de T-002 tiene dos mitades: los clientes y *«vinculación al proyecto remoto (`cadeapp-staging`)»*. La segunda no existe:

```
$ grep -rn "supabase link|project-ref|project_ref" docs/ package.json supabase/ .env.example
 (NINGUNA aparición)

$ find supabase -type f
 supabase/AGENTS.md
 supabase/config.toml
```

No hay paso de vinculación, no está documentado el ref del proyecto, ni quién lo tiene. Y el primer ítem del DoD de la fila del plan —*«Variables de entorno validadas con `cadeapp-staging`»*— no trae evidencia de haberse hecho.

Esto es la misma contradicción estructural que H06 y por eso lo clasifico como **origen: ficha**: vincular exige un access token, y el onboarding declara en su propia sección *«Qué NO hay en tu máquina»* que no hay tokens de Supabase en ninguna máquina del equipo.

**Decisión tuya, no del agente.** Si la vinculación es solo de CI, hay que sacarla del objetivo de T-002 y ponerla en T-003 junto con el secreto. Si tiene que poder hacerse en una máquina, hay que decir quién tiene el token y cómo se consigue.

---

## 🟡 H11 · `.env.example` sigue entregando el flujo con Docker

**`.env.example:10` · medio · `P14-referencia-muerta-tras-mover`**

Se reescribió la sección 3 del onboarding y no se tocó `.env.example`, que es el archivo que la persona **copia** en el paso 2 y que está entre los «Archivos permitidos».

Lo que sigue diciendo:

- línea 10: *«Para desarrollo local con Docker (Supabase local), los valores por defecto ya coinciden con la salida estándar de `pnpm supabase status`»*
- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`
- las dos claves: *«(Valor por defecto provisto por `pnpm supabase start` en desarrollo local)»*

Y `docs/onboarding.md:20`, que tampoco se tocó, manda completarlo *«con valores locales (los imprime `pnpm supabase status`)»* — comando que la doc del CLI define como *«Requires the local development stack to be started by running `supabase start`»*.

Resultado: quien siga el onboarding nuevo no tiene de dónde sacar los valores de staging.

### Sobre H03 — mi verificación estaba a medias

H03 decía dos cosas: que el onboarding *describía base local con Docker* y que *llamaba a un script inexistente*. En la ronda 2 lo di por cerrado con `grep -c test:db → 0`, que verifica **solo la segunda mitad**. La primera seguía viva en la línea 20, y encima se extiende a `.env.example`.

Lo bajo a **`parcial`**. Es el mismo error que el `verificado_metodo` en prosa que detecté en H04, pero cometido por mí: verifiqué el comando que era fácil de correr en vez del que cerraba el hallazgo.

---

## Lo que hay que hacer

| # | Qué | Quién |
|---|---|---|
| 1 | **H07** — regenerar `pnpm-lock.yaml`, ampliar la ficha con `pnpm-lock.yaml` y resolver «Dependencias nuevas permitidas: ninguna» | agy + decisión de alcance |
| 2 | **H08** — `tools/db-types.mjs`: escribir el archivo solo con exit 0 y salida no vacía | agy |
| 3 | **H06** — sacar el drift del DoD de T-002 y ponerlo en el de T-003, demostrable | agy |
| 4 | **H11 + H03** — `.env.example` y `docs/onboarding.md:20` al flujo remoto | agy |
| 5 | **H09** — `--linked` o ref por variable de entorno, según lo que se decida en H10 | agy, después de (6) |
| 6 | **H10** — ¿la vinculación es de CI o de máquina? ¿quién tiene el token? | **@Lautaro073** |

El orden importa: (6) condiciona a (5), y (1) es condición para poder probar cualquiera de los dos.
