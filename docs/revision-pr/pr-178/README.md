# Revisión PR #178 — CC-014

- **PR:** #178
- **Rama:** `cc/CC-014-map-picker-hardening`
- **SHA funcional final:** `3f80a276fb936de6c06ed81030fe6ccedbad4242`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 4
- **Resultado:** **APTO PARA MERGE — SIN BLOQUEANTES**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR178-H01 | alto | arreglado-verificado |
| PR178-H02 | medio | arreglado-verificado |
| PR178-H03 | medio | arreglado-verificado |
| PR178-H04 | bajo | arreglado-verificado |

## Resumen

CC-014 queda consistente con el contrato propuesto y con el flujo real de los consumidores controlados.

La sincronización de cámara quedó modelada como una orden explícita versionada:
- drag/click actualizan selección sin recentrar;
- el eco controlado no emite orden;
- un cambio externo genuino sí emite orden incluso si vuelve al target anterior;
- rerenders numéricamente iguales no resetean selección ni generan pans redundantes;
- GPS y teclado siguen recentrando;
- `mapId` opcional degrada de `AdvancedMarker` a `Marker`;
- `gm_authFailure` conserva lifecycle seguro;
- API pública sin helpers de testing.

Issue #171 permanece `bloqueada` y sin `en-curso` hasta que CC-014 se mergee y T-323 sea retomada por el flujo normal.

CI exact-head `36956307854`: typecheck/lint/unit/build/audit/db-tests/bundle-budget verdes, **1599/1599** unitarios y **1614/1614** DB.

No se realizó merge: corresponde a Lautaro073.
