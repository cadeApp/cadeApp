# Evidencia y reproducciones — PR #126

## Ronda 1 — HEAD `acccd45b4b6d3ec5d3c84e2c6d6165ddd5e52186`

### Run que origina CC-013

`migrate` run `36535421202`, staging SHA `08b4b4d1550501289a817c3c00e1e570411abd5a`.

```text
Apply migrations to staging                  success
Detect committed types drift against staging failure
```

El log muestra:

```text
pnpm db:types
supabase gen types typescript --schema public --project-id <staging-ref>
```

y luego un diff únicamente de:

- `__InternalSupabase / PostgrestVersion`;
- `Tables`;
- `TablesInsert`;
- `TablesUpdate`;
- `Enums`;
- `CompositeTypes`.

### Blobs reales

```text
base/develop:
51a224df8ffe7ad8a42336aaf4e390cf0e2d36a0
size 31822

salida remota preservada en d52c4e7:
caa03af8699d85eb9660aa8e178b94e72c98afa5
size 32039

HEAD actual database.types.ts:
51a224df8ffe7ad8a42336aaf4e390cf0e2d36a0
size 31822
```

### Reproducción de normalizeGeneratedTypes sobre blobs reales

Resultado independiente:

```text
baseLength: 31822
remoteLength: 32039
normalizedLength: 31822
exactEquality: true
firstMismatch: -1
internalSupabaseBlocks: 1
helperStartsMatched: 5
helperEndsMatched: 5
```

Helpers encontrados:

```text
TableName / Tables
TableName / TablesInsert
TableName / TablesUpdate
EnumName / Enums
CompositeTypeName / CompositeTypes
```

Mutación de esquema:

```text
+ reviewer_probe: boolean
```

Resultado:

```text
mutationPreserved: true
mutationStillDiffersFromBase: true
```

### PR126-H01 — false green demostrado

Mutación independiente de la implementación:

- conservar el bloque `__InternalSupabase`;
- conservar el regex final;
- hacer que el regex inicial normalice únicamente `EnumName`.

Resultados de los cuatro tests actuales:

```text
remote -> local                 true
idempotencia local              true
columna nueva visible           true
committed fixed point           true
```

```text
allFourWouldPass: true
```

Pero contra el remoto real:

```text
brokenMutationFailsRealRemoteEquality: true
remainingParenStarts:
- Tables
- TablesInsert
- TablesUpdate
- CompositeTypes
```

Conclusión: la suite actual no protege cuatro de los cinco helpers.

### Board T-300

Issue #96 está en `en-review` porque PR #123 está abierta.

`board-sync.mjs` aplica:

```js
if (openPr) {
  targetState = openPr.isDraft ? 'en-curso' : 'en-review';
}
```

Por eso no se pide un cambio manual a `bloqueada`.

### CI

No consultado como criterio final de aprobación porque PR126-H01 sigue abierto.
