# PR #618 — CC-045 · T-423: MapPicker Geocoding

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/618 |
| Tarea | T-423 (ficha creada por CC-045, issue #616; el CC es #615) |
| Autor | @Lautaro073 |
| Rama | `cc/CC-045-map-geocoding` → `develop` |
| Base observada | `a7c6d809f87804415499d7fc70aaf06349717c16` |
| Tamaño original | 5 archivos, +282/-2 líneas, solo documentación |
| Estado | CC documental apto tras correcciones; implementación futura condicionada a #619 |

## Rondas

| Ronda | SHA inicial revisado | Correcciones documentales | Informe |
|---|---|---|---|
| 1 | `d35138babfd6133eefa986e27f25f806aafb461c` | `6af7ca5` y `03420fe` | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Síntesis | Severidad | Estado |
|---|---|---|---|
| PR618-H01 | DoD no concordaba con la fila del plan (CI unit rojo) | alto | arreglado-sin-verificar (CI nuevo pendiente al registrar ronda) |
| PR618-H02 | `bounds` usa campos incompatibles con Geocoder | alto | arreglado-sin-verificar (contrato corregido) |
| PR618-H03 | `RANGE_INTERPOLATED` se clasificaba como exacto | medio | arreglado-sin-verificar (contrato corregido) |
| PR618-H04 | Una búsqueda en vuelo podía pisar un pin movido manualmente | alto | arreglado-sin-verificar (contrato y DoD corregidos) |
| PR618-H05 | El aviso legal no individualiza a Google como receptor de direcciones | medio | abierto para rollout T-423: issue #619 |

Estructura: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Qué queda por hacer

- Para **CC-045**: ningún cambio de comportamiento pendiente; comprobar CI del SHA final antes del merge.
- Para **T-423**: implementar código y pruebas de la ficha; no habilitar a usuarios reales antes de resolver #619 y versionar los avisos conforme al proceso legal.
- No se inspeccionaron claves, consola Google Cloud, secretos ni producción. Las configuraciones de Google declaradas «hechas» por la ficha **no fueron verificadas por la revisión**.
