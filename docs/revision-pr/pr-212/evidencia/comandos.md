# Evidencia — PR #212 / ronda 1

## SHAs

```text
PR head: 494e4ace3af2ab8d547a6657c8b3ad7f49b49b16
develop:  19e25afd58ec78b88bfb834bb4f340ae25393a47
ahead: 3
behind: 0
mergeable: true
```

## Identidad con el código ya mutado/revisado

```text
actions.ts:
129e72aaf972cb17eb3e007a58ea0319bd60cc4f == PR210

actions.test.ts:
4a1673005560dc7eada01af642230adf77410416 == PR210

create-request-form.test.tsx:
1ef97357d06bd1fa5b4cd770134ee20b13df80dd == PR210
```

La evidencia de mutación independiente de PR #210 corresponde a esos mismos blobs exactos.

## CI

```text
run 37045443623 / CI #910
build          success
lint           success
unit           success
audit          success
db-tests       success
typecheck      success
bundle-budget  success
```

## Vercel

```text
Vercel: success
```

## E2E Preview

Run `37045670491`:

```text
Running 9 tests using 1 worker

✓ DoD: teléfono no visible antes de aceptación
✓ DoD: no doble aceptación concurrente
✓ Flujo 1: publicación con datos/paquete/pago
✓ Flujo 1b: transferencia
✓ Flujo 2: oferta con piso mínimo
✓ Flujo 3: retiro de oferta
✓ Flujo 4: ordenamiento por documentación y precio
✓ Flujo 5: viaje refleja pago y aviso
✓ smoke

9 passed (2.6m)
```

El Flow 4 había fallado en PR #210 por CC-016 y ahora pasa con CC-016 ya presente en la base.
