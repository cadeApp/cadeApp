# PR #126 — CC-013 — Ronda 1

**Fecha:** 2026-09-29  
**HEAD revisado:** `acccd45b4b6d3ec5d3c84e2c6d6165ddd5e52186`  
**Resultado:** **CON BLOQUEANTES (1)**

## Contexto verificado

CC-013 existe para resolver un drift falso entre:

- `db-tests` → `pnpm db:types --local`;
- `migrate-staging` → `pnpm db:types` con `--project-id`.

El run `migrate` 36535421202 sobre staging:

- aplicó migraciones correctamente;
- falló únicamente en `Detect committed types drift against staging`;
- mostró como diff:
  - bloque `__InternalSupabase/PostgrestVersion`;
  - paréntesis en `Tables`;
  - `TablesInsert`;
  - `TablesUpdate`;
  - `Enums`;
  - `CompositeTypes`.

El commit intermedio `d52c4e7` preserva esa salida remota real en Git.

## Verificación independiente de la idea central

Blobs:

```text
local  = 51a224df8ffe7ad8a42336aaf4e390cf0e2d36a0  size=31822
remote = caa03af8699d85eb9660aa8e178b94e72c98afa5  size=32039
head   = 51a224df8ffe7ad8a42336aaf4e390cf0e2d36a0  size=31822
```

Aplicando la implementación actual de `normalizeGeneratedTypes` sobre el contenido remoto real:

```text
exactEquality: true
internalSupabaseBlocks: 1
helperStartsMatched: 5
helperEndsMatched: 5
```

Los cinco helpers detectados son:

```text
Tables
TablesInsert
TablesUpdate
Enums
CompositeTypes
```

Mutación independiente de esquema:

```text
+ reviewer_probe: boolean
```

Resultado:

```text
mutationPreserved: true
mutationStillDiffersFromBase: true
```

Por tanto, la implementación propuesta sí resuelve el drift concreto observado y no oculta esa mutación de esquema.

---

## PR126-H01 — La suite nueva no cubre cuatro de los cinco helpers que la función normaliza

**Severidad:** alta  
**Categoría:** test-coverage  
**Patrón:** `P08-control-no-cubre-lo-que-dice`  
**Archivo:** `tools/db-types.test.ts`

### Problema

El contrato y `tools/db-types.mjs` normalizan cinco helpers generados:

1. `Tables`
2. `TablesInsert`
3. `TablesUpdate`
4. `Enums`
5. `CompositeTypes`

Pero `REMOTE_TEMPLATE` / `LOCAL_TEMPLATE` del test nuevo solo contienen **Enums**.

Eso significa que la suite no demuestra la regla completa que protege.

### Mutación independiente RED/false-green

Se mutó conceptualmente la implementación para que el regex inicial normalice **solo `EnumName`** y deje rotos:

- `Tables`;
- `TablesInsert`;
- `TablesUpdate`;
- `CompositeTypes`.

Con esa implementación rota, los cuatro tests actuales dan:

```text
remote -> local                 PASS
idempotencia local              PASS
columna nueva sigue visible     PASS
archivo commiteado punto fijo   PASS
```

Es decir: **4/4 seguirían verdes**.

Aplicando esa misma mutación al blob remoto real `caa03af...`:

```text
normalizeMutated(remoteReal) !== localReal
```

y quedan cuatro helpers con paréntesis.

La suite actual puede por tanto certificar falsamente una implementación que volvería a romper `migrate-staging`.

### Corrección requerida

Ampliar `tools/db-types.test.ts` para ejercer los cinco helpers.

Implementación correcta recomendada:

- fixture remoto/local que contenga los cinco helpers; o
- tabla parametrizada con un par remoto/local por cada helper.

Debe existir una prueba que falle al romper individualmente la normalización de cualquiera de:

```text
Tables
TablesInsert
TablesUpdate
Enums
CompositeTypes
```

No alcanza con comprobar solo el regex final `) = never`; hay que ejercer también el inicio de cada helper.

### RED obligatorio

Después de ampliar la suite, mutar temporalmente:

```js
.replace(/^( {2}\w+ extends )\((\w+ extends \{)$/gm, '$1$2')
```

por una versión que solo acepte `EnumName`.

Esperado: los casos de `Tables`, `TablesInsert`, `TablesUpdate` y `CompositeTypes` deben fallar.

Restaurar la implementación correcta y volver a verde.

---

## Decisión D01 — P1

Lautaro073 decidió **A**:

> CC-013 aprobado como P1, condicionado a corregir los bloqueantes.

Actualizar en `docs/contracts/CC-013.md`:

```md
- [x] P1 (dueño de esquema/RPC)
```

No cambiar las otras dos líneas de aprobación, que siguen n.a.

---

## T-300 / board

`docs/contracts/CC-013.md` declara T-300 bloqueada.

Issue #96 aparece `en-review` porque PR #123 de T-300 sigue abierta. Se verificó que `board-sync` fuerza `en-review` cuando una tarea tiene PR abierto, por lo que **no se crea un hallazgo contra CC-013 ni se pide relabel manual**: la automatización lo revertiría.

T-300 sigue materialmente sin poder cerrarse hasta que CC-013 se resuelva y `migrate-staging` pase.

## CI

No se usa CI final como criterio de aprobación mientras H01 siga abierto.

## Estado

**No aprobar ni mergear todavía.**

Para una Ronda 2:

1. ampliar los tests a los cinco helpers;
2. demostrar RED individual de la clase cubierta;
3. marcar la aprobación P1 decidida;
4. actualizar body/evidencia sin afirmar más de lo reproducido;
5. volver a revisión.
