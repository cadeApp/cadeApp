# Evidencia y reproducciones — PR #126

## Ronda 1

Ver `revisiones/ronda-1.md` para blobs reales, run de staging 36535421202 y false-green original.

## Ronda 2 — HEAD funcional `80155e4fea27e6a906fcbd59da73b266683ff832`

### H01

Fixture corregido contiene:

```text
Tables
TablesInsert
TablesUpdate
Enums
CompositeTypes
```

Mutación independiente: regex inicial limitado a `EnumName`.

```text
correctPasses: true
mutationWouldFailFirstTest: true
remainingCount: 4
remainingBrokenHelpers:
- TableName / Tables
- TableName / TablesInsert
- TableName / TablesUpdate
- CompositeTypeName / CompositeTypes
```

H01 queda arreglado-verificado.

### CI técnico #601

```text
build          success
unit           success
db-tests       success
lint           success
audit           success
typecheck      success
bundle-budget  success
```

### approval-policy

Runs sobre el mismo SHA:

```text
#752 failure
#753 failure
```

Log:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

Causa en `.github/workflows/approval-policy.mjs`:

```js
/Informe revisar-pr\s*—\s*T-\d{3}/
```

El control no acepta `CC-013`.

Decisión P1:

```text
B — aceptar approval-policy rojo para esta PR y seguir igual.
```

No se altera el workflow ni se usa un ID falso.

### Estado GitHub

```text
mergeable: true
mergeable_state: unstable
```

No se pudo consultar branch protection (403 de la integración).
