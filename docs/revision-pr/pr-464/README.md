# PR #464 — T-376 · Alta de documentos opcionales desde el perfil

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/464 |
| Autor | @Lautaro073 |
| Rama | `feat/T-376-optional-documents-profile` → `develop` |
| SHA de código revisado | `9988b50b5ede65a13677f732c090c2826ac4d325` |
| Base | `04f11839c659e67dbf32e8a80fa5da37819ce8d0` |
| Diff | 12 archivos · +791 / -12 |
| Estado | Ronda 1 CON 2 BLOQUEANTES, 1 MEJORA |

## Rondas
| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `9988b50` | 2 bloqueantes, 1 mejora | [ronda-1](revisiones/ronda-1.md) |

## Hallazgos
| ID | Descripción | Severidad | Estado |
|---|---|---|---|
| PR464-H01 | PDF anunciado pero no admitido por UI ni compresión | medio · bloqueante | abierto |
| PR464-H02 | NOT_FOUND no restablece subida: reintento no puede recuperar objeto ausente | medio · bloqueante | abierto |
| PR464-H03 | E2E usa RPC del admin, no el visor ni el botón de la UI | bajo · mejora | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencias, limitaciones y comandos: [evidencia/comandos.md](evidencia/comandos.md).

## Siguiente paso
El autor corrige H01 y H02 en la misma rama y prueba RED→GREEN con nuevos casos; H03 se sugiere completar.
Por la decisión del propietario, las rondas usan Playwright local contra Preview + Supabase Develop, y la corrida completa `e2e-preview` de CI se reserva para el último push sin bloqueantes.
`audit` sigue fallando por GHSA-587h-7wmj-h5pm tanto en esta PR como en `develop` (preexistente; issue [#466](https://github.com/cadeApp/cadeApp/issues/466)). PDF integral se separó en [#465](https://github.com/cadeApp/cadeApp/issues/465); aquí se exige que el copy no prometa PDF cuando la UI solo admite imágenes.
Esta ronda NO certifica E2E, mutaciones propias ejecutadas ni test local: el entorno revisor no dispone de clon accesible ni conexión Git externa.
