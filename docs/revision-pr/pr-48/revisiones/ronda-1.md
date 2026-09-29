# Informe de revisión — PR #48 / T-001

**PR:** https://github.com/cadeApp/cadeApp/pull/48
**Head SHA revisado:** `fb7398ae4c39de0858778e29110e2d5950830d03`
**Base:** `develop` @ `f6dc070`
**Fecha:** 2026-09-21
**Alcance:** 64 archivos, +1079 / −204

---

## Veredicto

Sin bloqueantes de código: los cuatro checks están verdes y el DoD se cumple en lo literal. Pero **el guard tiene dos bypasses verificados** que vacían buena parte de la protección que T-001 dice instalar, y hay **siete referencias muertas** al directorio que esta PR borra.

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 38/38 en 7 archivos
```

> Alcance de `pnpm lint`: `--dir src --file middleware.ts`. **No** cubre `.agents/scripts/agent-guard.mjs` ni `tools/**`, que es donde está casi todo el cambio de esta PR.

| # | Sev. | Archivo | Problema |
|---|---|---|---|
| H01 | 🟠 | `.agents/scripts/agent-guard.mjs:26` | El comodín `.env*` esquiva el bloqueo de secretos |
| H02 | 🟠 | `.agents/scripts/agent-guard.mjs:37` | `git push` pelado no se bloquea |
| H03 | 🟡 | `docs/implementation-plan.md:4` | 7 referencias muertas a `docs/agy-kit/` |
| H04 | 🟡 | `.github/CODEOWNERS:38` | Las rutas de P3 quedan sin revisor efectivo |
| H05 | 🟡 | `tools/verify-t001.test.ts:81` | El test de CODEOWNERS no comprueba que los usuarios existan |
| A01 | 🔵 | `tools/verify-t001.test.ts` | Fuera de los «Archivos permitidos» de T-001 |

---

## Lo que está bien

Vale decirlo antes, porque es una mejora real respecto de T-000:

- **El test del guard ejerce el guard de verdad.** `tools/verify-t001.test.ts:103-170` lanza el proceso con `execSync`, le pasa un payload y comprueba la decisión. No es la aserción tautológica que tuvimos en `PR47-H04`.
- **CODEOWNERS es válido para GitHub.** `GET /repos/cadeApp/cadeApp/codeowners/errors?ref=feat/T-001-kit-agy-codeowners` devuelve `{"errors":[]}`, y `@KiraK72` figura como colaborador del repo. El DoD «GitHub no marca errores en CODEOWNERS» se cumple.
- **Las 27 fichas cubren Fase 0 y Fase 1 sin huecos.** Comparadas contra la sección 8 del plan: ninguna tarea sin ficha, ninguna ficha sin tarea (la única extra es `T-999-simulacro`, que es la evidencia del DoD). *La descripción del PR dice «26 fichas»; son 27.*
- **El hook resuelve bien.** `hooks.json` dice `node scripts/agent-guard.mjs` y el script está en `.agents/scripts/`. Parece roto, pero `.el-consejo/revision-2/evidence.md:38` documenta que el comando corre **desde la carpeta del `hooks.json`**, así que la ruta relativa es correcta. Lo comprobé antes de reportarlo: no es un defecto.

---

## H01 · 🟠 El comodín `.env*` esquiva el bloqueo de secretos

**Archivo:** `.agents/scripts/agent-guard.mjs:26`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```js
const SECRET_FILE = /(^|[\\/\s"'=:])\.env(?!\.example)(\.[\w-]+)*(?=$|[\s"'\\/,;)])/i;
```

La lookahead final exige que después del nombre venga fin de cadena o uno de `espacio " ' \ / , ; )`. **El asterisco no está en ese conjunto**, así que cualquier forma con comodín no coincide y el guard devuelve `ask` en vez de `deny`.

### Evidencia

Ejecutando el guard con el payload de agy:

| Comando | Decisión |
|---|---|
| `cat .env.local` | `deny` ✅ |
| `cat .env` | `deny` ✅ |
| `type .env.local` | `deny` ✅ |
| `cat .env*` | **`ask`** ❌ |
| `cat .env.*` | **`ask`** ❌ |
| `cp .env* /tmp/x` | **`ask`** ❌ |

`ask` no es inocuo: significa que el agente pide permiso con el texto normal de una lectura de archivo, sin el aviso de la regla 00. Quien opera agy sin saber programar —que es exactamente el perfil de P2 y P3 según §3.8— no tiene cómo distinguir eso de una lectura legítima.

### Arreglo

Agregar el comodín y los separadores que faltan a la lookahead:

```js
const SECRET_FILE = /(^|[\\/\s"'=:])\.env(?!\.example)(\.[\w-]+)*(?=$|[\s"'\\/,;)*?\[\]])/i;
```

Más robusto todavía: en vez de enumerar qué puede venir después, tratar cualquier token que empiece con `.env` y no sea exactamente `.env.example` como secreto. Es la lección `AG-05` — allowlist en vez de enumerar lo prohibido.

### Fixture obligatorio

Agregar los tres casos de la tabla a `tools/verify-t001.test.ts`, y comprobar que fallan antes del arreglo (principio 8).

---

## H02 · 🟠 `git push` pelado no se bloquea

**Archivo:** `.agents/scripts/agent-guard.mjs:37`
**Estado:** `[VERIFICADO]`

### Diagnóstico

```js
[/\bgit\s+push\b[^\n|&;]*\b(origin\s+)?(HEAD:)?(develop|staging|main)\b(?![\w/-])/i,
  'Regla 50: no se pushea a develop, staging ni main.'],
```

La regla exige que **el nombre de la rama aparezca literalmente** en el comando. Estando parado en `develop`, `git push` la actualiza sin nombrarla.

### Evidencia

| Comando | Decisión |
|---|---|
| `git push origin develop` | `deny` ✅ |
| `git push -u origin develop` | `deny` ✅ |
| `git push origin HEAD:develop` | `deny` ✅ |
| `git push` | **`ask`** ❌ |
| `git push origin HEAD` | **`ask`** ❌ |

### Por qué importa

§6 del plan define `develop` como rama protegida «sin push directo ni force push, **tampoco para administradores**». Y §3.8.6 le dice explícitamente a P2 y P3 que ante un corte de cuota corran `git add -A && git commit && git push` — es decir, **el flujo que el propio plan enseña es justamente la forma que el guard no ataja**.

El DoD nombra literalmente `git push origin develop`, así que la letra se cumple. La intención, no.

### Arreglo

El guard no puede saber la rama actual desde el comando, así que conviene invertir la carga: denegar `git push` cuando **no** se nombra explícitamente una rama no protegida.

```js
// Deny si es un push sin destino explícito: no podemos saber la rama actual.
[/\bgit\s+push\b(?![^\n|&;]*\b(?!develop|staging|main)[\w.-]+\s+[\w.\/-]+)/i,
  'Regla 50: push sin rama explícita; nombrá remoto y rama (nunca develop, staging ni main).'],
```

Conviene probar esa expresión contra los cinco casos de la tabla antes de adoptarla; si resulta frágil, la alternativa simple y defendible es **denegar todo `git push` que no nombre una rama**, y que el operador escriba el destino completo.

---

## H03 · 🟡 Siete referencias muertas a `docs/agy-kit/`

**Archivo:** `docs/implementation-plan.md`
**Estado:** `[VERIFICADO]`

La PR mueve el kit a la raíz y borra `docs/agy-kit/`, pero del plan solo actualizó la tabla del equipo (§2). Quedaron siete citas a rutas que ya no existen:

| Línea | Qué dice | Debería |
|---|---|---|
| 4 | `[docs/agy-kit/](agy-kit/README.md)` | **Enlace markdown roto** — el archivo fue borrado |
| 18 | `agy-kit/.agents/rules/20-arquitectura.md` | `.agents/rules/20-arquitectura.md` |
| 19 | `agy-kit/.agents/rules/40-testing.md` | `.agents/rules/40-testing.md` |
| 128 | «Subir a `main` … y `docs/agy-kit/`» | ya no existe |
| 129 | «que sigan `docs/agy-kit/docs/onboarding.md`» | `docs/onboarding.md` |
| 168 | `agy-kit/.agents/rules/20-arquitectura.md` | `.agents/rules/20-arquitectura.md` |
| 177 | «Todo está en `docs/agy-kit/` y se instala en T-001» | ya está instalado |

Corrí un verificador de enlaces sobre `docs/`, `.agents/` y los `AGENTS.md`: de 96 enlaces relativos, **el único roto es el de la línea 4**, y lo introduce esta PR. Las otras seis son texto plano, así que ningún verificador las atrapa, pero son instrucciones que alguien va a seguir.

**La 129 es la que más importa**: es la instrucción de onboarding para los dos operadores que no programan.

Hay además un comentario obsoleto en `tools/verify-approved-packages.test.ts:4`, que cita `docs/agy-kit/.agents/rules/25-stack-y-patrones.md`.

### Arreglo

Reemplazar las siete rutas y el comentario. Como el plan es el documento autoritativo del proyecto, conviene además que T-003 sume un check de enlaces a CI.

---

## H04 · 🟡 Las rutas de P3 quedan sin revisor efectivo

**Archivo:** `.github/CODEOWNERS:38-46`
**Estado:** `[ANÁLISIS]`

Las nueve rutas de P3 tienen como único dueño a `@Lautaro073`:

```
/src/app/(admin)/                 @Lautaro073
/src/features/admin/              @Lautaro073
/public/                          @Lautaro073
/e2e/                             @Lautaro073
...
```

**GitHub no pide revisión al autor de un PR.** Como T-003, T-201 y varias tareas de Fase 2 son suyas o pasan por esas rutas, un PR de Lautaro073 que las toque no le pide revisión a nadie — y §2 exige que sus PR los apruebe P2 o P3.

El resto del archivo ya resuelve esto bien: las zonas de P1 y P2 listan a los dos (`@Lautaro073 @KiraK72`), justamente para que siempre quede alguien que no sea el autor.

### Arreglo

Hasta que P3 se incorpore, agregar a `@KiraK72` como codueño de las rutas de P3, igual que en el resto del archivo:

```
/src/app/(admin)/                 @Lautaro073 @KiraK72
```

El comentario de la cabecera ya anticipa que P3 está pendiente; esto solo lo hace efectivo.

---

## H05 · 🟡 El test de CODEOWNERS no comprueba que los usuarios existan

**Archivo:** `tools/verify-t001.test.ts:80-99`
**Estado:** `[ANÁLISIS]`

```ts
for (const owner of owners) {
  expect(owner.startsWith('@'), `Dueño debe comenzar con @: ${owner}`).toBe(true);
}
```

El test se llama «sintaxis válida y **usuarios reales**», pero solo comprueba que la cadena empiece con `@`. Un `@fantasma` pasaría, y también pasaría un usuario que existe pero no es colaborador del repo — que es el caso que hace que GitHub marque error.

La autoridad real es `GET /repos/{owner}/{repo}/codeowners/errors`. La consulté y devuelve `{"errors":[]}`, así que **el DoD se cumple** — pero no gracias al test.

### Arreglo

Dos opciones, según cuánto quieras depender de la red en los tests:

- **En CI (recomendado):** que T-003 agregue un paso que consulte el endpoint de errores de CODEOWNERS y falle si devuelve alguno. Es la comprobación real y no cuesta nada.
- **En el test local:** mantener una lista de colaboradores conocidos y assertear contra ella, aceptando que hay que actualizarla al incorporar a P3.

En cualquier caso, conviene renombrar el test si va a seguir comprobando solo la forma.

---

## A01 · 🔵 DECISIÓN — `tools/verify-t001.test.ts` fuera de alcance

**Estado:** `[VERIFICADO]`

Los «Archivos permitidos» de T-001 son: `AGENTS.md`, `.agents/**`, `.github/CODEOWNERS`, `.github/pull_request_template.md`, `docs/**`, `supabase/AGENTS.md`, `src/domain/AGENTS.md`, `e2e/AGENTS.md`. Filtrando el diff por esa lista queda exactamente un archivo fuera:

```
tools/verify-t001.test.ts
```

Es el mismo tipo de desvío que `PR47-A01`, y el mismo hueco: **ningún check compara el diff contra los «Archivos permitidos» de la ficha**. Es el segundo PR consecutivo en que aparece.

Opciones: **(a)** agregar `tools/**` a la ficha de T-001 en el plan, ya que el DoD necesita pruebas automatizadas y no hay otro lugar razonable; **(b)** aceptar el desvío y registrarlo en la aprobación.

Recomiendo **(a)**: el DoD de T-001 exige verificar comportamientos, y la ficha no le dio dónde ponerlos. Es un error de la ficha, no del trabajo.

---

## Patrón que se repite

`P10-desvio-de-ficha-sin-consultar` ya va **cuatro apariciones** entre las dos PRs (H14, H15 y A01 en la #47, A01 en la #48). La causa es siempre la misma y ya está propuesta como control en `AG-13`: un check que lea los «Archivos permitidos» de la fila correspondiente y falle si el diff los excede. Con dos PRs de evidencia, cumple el criterio para llevarlo a `AGENTS.md`.

---

## Metodología

Verificado contra `fb7398a` con el árbol limpio. El guard se ejerció con su formato de payload real (`toolCall.args.CommandLine`), no con el de otro agente. Comandos reproducibles en [`../evidencia/comandos.md`](../evidencia/comandos.md).

No verificado por ejecución: H04 y H05 (razonamiento sobre configuración y lectura del test).
