# PR #105 · T-106 — Ronda 2

- **SHA revisado:** `e275613eb0b022932ab17c4333ddc1cf8625b105`
- **Base:** `develop@6ac32e77f6995bec82a0c2957d6b59739cbe096b`
- **Merge ref:** `058a373f1c93736e8832251fef1d4bc08ba09d19`
- **Resultado:** **SIN BLOQUEANTES**
- **Decisiones 🔵:** ninguna nueva. Se aplicó la autorización explícita de Lautaro073 para modificar solo el test 11 de `supabase/tests/rls_matrix.sql`.

## Resumen

Los dos bloqueantes de Ronda 1 quedan cerrados y no aparecen regresiones nuevas en la clase revisada.

### PR105-H01 — CERRADO / VERIFICADO

El arreglo hace las dos cosas que faltaban:

1. elimina `merchants_select_courier`, por lo que un courier deja de tener una policy de lectura directa sobre la fila completa;
2. convierte `merchant_public` en la superficie courier con filtro explícito de actor/relación y solo cuatro columnas públicas.

El contracaso fue demostrado antes del arreglo en el commit `2c696d7b7eb603186d7073b2efefe8ba62925ffc`:

```text
Run 36217637214 · db-tests 108336688266
rls_coordinates.sql
# Failed test 18: "approved courier cannot directly query public.merchants table"
Failed 1/24 subtests
Files=12, Tests=1529
Result: FAIL
```

En el SHA revisado:

```text
Run 36218778268 · db-tests 108339947304
rls_coordinates.sql ... ok
rls_matrix.sql ......... ok
rpc_distance.sql ....... ok
Files=12, Tests=1529
Result: PASS
database.types.ts regenerado sin diff
```

La corrección preserva el acceso directo del merchant dueño y del admin. El test funcional heredado de T-005 ahora consulta `merchant_public`, exactamente dentro de la excepción de alcance autorizada por Lautaro073.

También se barrió el consumo actual: las vistas courier existentes no leen `public.merchants` directamente; las lecturas directas encontradas son del propio comercio y siguen cubiertas por `merchants_select_self`.

La elección de `security_barrier` es coherente con el rol de la vista como frontera de filtrado; el acceso del courier por la vista queda probado independientemente de la ausencia de acceso directo a la tabla.

### PR105-H02 — CERRADO / VERIFICADO

La sesión histórica original no se reescribió. El diff desde el commit de revisión R1 agrega una entrada nueva que deja constancia de:

- run `36215443077`;
- job `108330380086`;
- `INVALID_SIGNUP_ROLE`;
- 0 aserciones ejecutadas en ambas suites nuevas;
- conclusión explícita de que ese rojo no fue una demostración válida del comportamiento.

El body del PR mantiene desmarcada la afirmación global «Cada prueba nueva se demostró fallando al romper la regla» y distingue el RED real posterior de H01.

No hay falsificación retroactiva de la evidencia.

## Cambio autorizado en `rls_matrix.sql`

El cambio se limita al test 11:

- antes exigía visibilidad courier a través de `public.merchants`;
- ahora exige la misma semántica de comercio activo/ocioso a través de `public.merchant_public`.

No se modificaron fixtures, expectativas de negocio ni otros tests de la matriz. Es una adaptación de superficie, no un debilitamiento del control.

## CI del SHA revisado

| Check | Resultado |
|---|---|
| typecheck | ✅ |
| lint | ✅ |
| unit | ✅ 55 archivos / 601 tests |
| build | ✅ |
| audit | ✅ |
| bundle-budget | ✅ |
| db-tests | ✅ 12 archivos / 1529 tests |
| approval-policy | ✅ run 36219348596 |

El `approval-policy` estaba rojo antes del cierre únicamente porque el body conservaba el informe de R1 con `CON BLOQUEANTES (2)`. Tras reemplazarlo por el informe independiente de R2 `SIN BLOQUEANTES`, el run `36219348596` terminó `success`.

## Alcance y proceso

- Desde el commit de revisión R1 `d8b8523`, el autor tocó solo: migración T-106, `rls_coordinates.sql`, bitácora y el test 11 de `rls_matrix.sql`.
- No tocó `docs/revision-pr/**`.
- `docs/tasks/T-106.md` se contrastó contra `develop`; no hubo ampliación silenciosa de ficha.
- La rama sigue mergeable contra el `develop` actual; GitHub generó y probó el merge ref indicado arriba.
- No se levantó Supabase/Docker local: la evidencia DB proviene del job `db-tests`, conforme al procedimiento del proyecto.

## Corrección documental adicional del cierre

El rollback del body decía que la migración era «puramente aditiva». Eso dejó de ser cierto al cerrar H01, porque ahora se elimina una policy. La revisión corrigió el body:

- antes de aplicar la migración, revertir el merge evita desplegarla;
- después de aplicarla, un `git revert` no revierte el esquema y hace falta una migración compensatoria;
- no se debe restaurar `merchants_select_courier`, porque reabriría PR56-H13.

## Resultado

**T-106 queda apta para merge por decisión de Lautaro073.** La revisión no aprueba ni mergea automáticamente.
