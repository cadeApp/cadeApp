# PR #112 · T-123 — Ronda 4

- **SHA revisado:** `b1a48e908f83a604496bd1168bb1e152763c74b2`
- **Estado:** Draft
- **Resultado:** **SIN BLOQUEANTES**
- **Cerrado:** PR112-H04
- **Decisiones vigentes:** D05-B, D06-A, D07-A

## Alcance de esta ronda

Desde el commit documental de Ronda 3 (`f03c877`) hay un único commit funcional:

`test(admin): cover plan dialog focus return [T-123]`

Modifica solamente:
- `src/features/admin/components/merchants-table.test.tsx`;
- `docs/tasks/log/T-123.md`.

Es exactamente el alcance autorizado por el prompt de Ronda 3. No se tocó `merchants-table.tsx` porque el código existente ya devuelve correctamente el foco.

## PR112-H04 ✅

El test agregado es válido y no trivializa la propiedad:

```text
focus trigger
→ click trigger
→ dialog visible
→ Escape
→ dialog ausente
→ document.activeElement === trigger
```

Usa el Dialog real de A03, no mocks de foco.

La mutación definida por la revisión (`blur()` antes de abrir) quedó registrada por el agy como:

```text
Tests  1 failed | 6 passed (7)
```

y el GREEN restaurado:

```text
Tests  7 passed (7)
```

La causa del RED coincide con el objetivo: el foco queda en `<body>` en vez de regresar al botón.

La revisión intentó reejecutar esa mutación en un checkout propio, pero el entorno continúa sin resolver `github.com`. No se fabrica una segunda ejecución. Se verificaron directamente el diff, el test y el CI del SHA exacto.

## CI

Run `36305816327`:

```text
typecheck       PASS
lint            PASS
unit            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS

Test Files      73 passed (73)
Tests           887 passed (887)
db-tests        Files=12, Tests=1529, Result: PASS
```

Los tres routes de T-123 compilan y se generan correctamente.

## Decisiones

### D06-A

Se mantiene A06 con tipo de entidad + ID corto, sin lookups de nombres.

### D07-A

Las seis capturas 1280/1024 y la comprobación visual de foco/contraste continúan **diferidas a T-300/staging con sesión admin AAL2 real**. No se consideran verificadas en T-123.

## Resultado

**SIN BLOQUEANTES DE REVISIÓN.**

H01–H04 están cerrados. La PR puede salir de Draft/mergearse cuando Lautaro073 lo decida, sin requerir otra ronda técnica de T-123.

No se aprobó ni mergeó la PR desde esta revisión.
