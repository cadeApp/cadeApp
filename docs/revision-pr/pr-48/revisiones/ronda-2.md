# Ronda 2 — verificación de los arreglos · PR #48 / T-001

**Head SHA revisado:** `d359aec0c2709a9000254f9a62d97a663aed0b40`
**Anterior:** `fb7398ae4c39de0858778e29110e2d5950830d03`
**Fecha:** 2026-09-21

---

## Veredicto

**Los 5 hallazgos y la decisión de alcance están cerrados y verificados.** Quedan dos cosas menores, ninguna bloqueante: un falso positivo nuevo en la regex del guard y un archivo de una línea fuera de alcance.

```
pnpm typecheck  → exit 0
pnpm lint       → ✔ No ESLint warnings or errors
pnpm test       → 53/53 en 7 archivos   (eran 38)
```

Los 15 tests nuevos son en buena medida los **casos negativos** que faltaban. Es `AG-07` aplicado sin que hiciera falta insistir.

---

## Lo verificado

### H01 · El comodín `.env*` ya no esquiva el bloqueo

```js
- const SECRET_FILE = /(^|[\\/\s"'=:])\.env(?!\.example)(\.[\w-]+)*(?=$|[\s"'\\/,;)])/i;
+ const SECRET_FILE = /(^|[^a-zA-Z0-9_])\.env(?!\.example($|[\s"'\\/,;:)&|<>\]}`]))/i;
```

| Caso | Antes | Ahora |
|---|---|---|
| `cat .env.local` | deny | deny ✅ |
| `cat .env` | deny | deny ✅ |
| `cat .env*` | **ask** | deny ✅ |
| `cat .env.*` | **ask** | deny ✅ |
| `cp .env* /tmp/x` | **ask** | deny ✅ |
| `cat .env.example` | ask | ask ✅ (sin falso positivo) |

### H02 · `git push` pelado ya se bloquea

Se agregó una regla que deniega el push cuando **no** se nombra remoto y rama no protegida.

| Caso | Antes | Ahora |
|---|---|---|
| `git push` | **ask** | deny ✅ |
| `git push origin HEAD` | **ask** | deny ✅ |
| `git push origin develop` | deny | deny ✅ |
| `git push origin feat/T-001-kit` | ask | ask ✅ |
| `git push -u origin feat/x` | ask | ask ✅ |
| `git push origin fix/T-002-algo` | ask | ask ✅ |

Los tres últimos importan tanto como los primeros: la regla nueva es amplia y podría haber bloqueado el trabajo normal. No lo hace.

### H03 · Sin referencias muertas

`grep -c "agy-kit" docs/implementation-plan.md` → **0**. El verificador de enlaces sobre `docs/`, `.agents/` y los `AGENTS.md` → **0 rotos** (antes 1). También se corrigió el comentario de `tools/verify-approved-packages.test.ts:4`.

### H04 · Rutas de P3 con revisor efectivo

Las nueve rutas pasaron de `@Lautaro073` a `@Lautaro073 @KiraK72`, alineadas con el resto del archivo. Un PR de Lautaro073 sobre `(admin)`, `/public/` o `/e2e/` ahora sí le pide revisión a alguien que no es el autor.

### H05 · El test de CODEOWNERS valida contra colaboradores

```ts
const VALID_COLLABORATORS = new Set(['@Lautaro073', '@KiraK72']);
```

Un `@fantasma` ahora falla. Es la opción local de las dos que propuse; sigue sin detectar que a alguien le quiten el acceso al repo, pero eso es lo que cubriría el check de CI de T-003.

### A01 · Resuelto ampliando la ficha

La fila T-001 del plan ahora lista `tools/verify-t001.test.ts` entre los «Archivos permitidos». Es la opción (a), la que recomendé: el DoD exigía verificar comportamientos y la ficha no le había dado dónde ponerlos.

---

## Los tests nuevos se demuestran en rojo

Revertí `SECRET_FILE` a la versión con el hueco y corrí la suite:

```
Tests  4 failed | 23 passed (27)
```

Restaurada, vuelve a verde. Los tests protegen el arreglo de verdad — principio 8 cumplido, igual que en la ronda 4 de la #47.

---

## H06 · 🔵 Falso positivo nuevo (bajo)

**Archivo:** `.agents/scripts/agent-guard.mjs:26`

Al cerrar H01, la lookahead pasó a excluir únicamente `.example`, sin exigir un límite de palabra después de `.env`. Cualquier nombre que empiece con `.env` queda dentro:

```
cat docs/.environment-setup.md   ->  deny
```

Es el intercambio clásico de `AG-07`: se cerró el falso negativo y se abrió uno falso positivo, más angosto.

**Lo importante no se rompió.** Comprobé los dos casos que habrían dolido de verdad:

```
editar un archivo cuyo contenido tiene process.env.NEXT_PUBLIC_APP_URL  ->  ask ✅
grep -rn process.env src/                                                ->  ask ✅
```

Si se hubieran bloqueado, el guard habría hecho inusable el trabajo sobre `src/lib/env.public.ts` y todo el código que lee `process.env`.

### Arreglo

Exigir que tras `.env` no venga otra letra:

```js
const SECRET_FILE = /(^|[^a-zA-Z0-9_])\.env(?![a-zA-Z0-9_-])(?!\.example($|[\s"'\\/,;:)&|<>\]}`]))/i;
```

`.env.local` y `.env*` siguen coincidiendo (`.` y `*` no son alfanuméricos); `.environment` queda fuera. Conviene sumar un fixture negativo.

**Prioridad baja:** hoy no existe ningún archivo así en el repo. Es deuda, no un bloqueo.

---

## A02 · 🔵 DECISIÓN — un archivo de una línea fuera de alcance

Arreglar H03 implicó tocar `tools/verify-approved-packages.test.ts` para corregir el comentario que citaba `docs/agy-kit/`. Ese archivo no está en los «Archivos permitidos» de T-001, ni siquiera tras ampliarlos con `tools/verify-t001.test.ts`.

El cambio es **una línea de comentario**, así que la sustancia es trivial. Lo registro igual porque el criterio que acordamos en la #47 es que un desvío se acepta explícitamente o se resuelve, no que se calle si es chico.

Opciones: **(a)** ampliar la ficha a `tools/**`, que evitaría repetir esta conversación en cada PR; **(b)** aceptarlo y registrarlo en la aprobación.

---

## Patrón que se repite

`P10-desvio-de-ficha-sin-consultar` va **cinco apariciones en dos PRs**, y dos de ellas (`PR48-A01`, `PR48-A02`) aparecieron *arreglando* hallazgos. Mientras no exista el check que `AG-13` viene pidiendo —leer los «Archivos permitidos» de la fila y fallar si el diff los excede— va a seguir apareciendo en cada revisión.

---

## Metodología

Verificado contra `d359aec` con el árbol limpio. El guard se ejerció con su formato real (`toolCall.args.CommandLine`), con casos positivos **y negativos**. `SECRET_FILE` se revirtió temporalmente para comprobar que los tests fallan, y se restauró. Comandos en [`../evidencia/comandos.md`](../evidencia/comandos.md).

No verificado por ejecución: H04 y H05 (lectura de configuración y del test).
