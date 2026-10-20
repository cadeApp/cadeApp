# PR #464 — T-376 · Alta de documentos opcionales desde el perfil

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/464 |
| Autor | @Lautaro073 |
| Rama | `feat/T-376-optional-documents-profile` → `develop` |
| SHA de código revisado | `9988b50b5ede65a13677f732c090c2826ac4d325` |
| Base | `04f11839c659e67dbf32e8a80fa5da37819ce8d0` |
| Diff | 12 archivos · +791 / -12 |
| Estado | Ronda 2 SIN BLOQUEANTES DE CÓDIGO DETECTADOS; CI final pendiente |

## Rondas
| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `9988b50` | 2 bloqueantes, 1 mejora | [ronda-1](revisiones/ronda-1.md) |
| 2 | `39aed042` (bitácora `16163488`) | Sin bloqueantes por inspección; tres corregidos sin ejecución independiente | [ronda-2](revisiones/ronda-2.md) |

## Hallazgos
| ID | Descripción | Severidad | Estado |
|---|---|---|---|
| PR464-H01 | PDF anunciado pero no admitido por UI ni compresión | medio · bloqueante| arreglado-sin-verificar |
| PR464-H02 | NOT_FOUND no restablece subida: reintento no puede recuperar objeto ausente | medio · bloqueante| arreglado-sin-verificar |
| PR464-H03 | E2E usa RPC del admin, no el visor ni el botón de la UI | bajo · mejora| arreglado-sin-verificar |

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencias, limitaciones y comandos: [evidencia/comandos.md](evidencia/comandos.md).

## Siguiente paso
Se constató en código y en los unit del SHA funcional la corrección H01/H02; el E2E del admin H03 cubre MFA/visor/auditoría. Falta solo CI oficial final y comprobar resultados, no cambios funcionales solicitados en esta ronda.
Por la decisión del propietario, las rondas usan Playwright local contra Preview + Supabase Develop, y la corrida completa `e2e-preview` de CI se reserva para el último push sin bloqueantes.
`audit` sigue fallando por GHSA-587h-7wmj-h5pm tanto en esta PR como en `develop` (preexistente; issue [#466](https://github.com/cadeApp/cadeApp/issues/466)). PDF integral se separó en [#465](https://github.com/cadeApp/cadeApp/issues/465); aquí se exige que el copy no prometa PDF cuando la UI solo admite imágenes.
Esta ronda NO certifica E2E, mutaciones propias ejecutadas ni test local: el entorno revisor no dispone de clon accesible ni conexión Git externa.

**Alcance de certificación:** H01–H03 quedan `arreglado-sin-verificar` porque este revisor no ejecutó las mutaciones/E2E, aunque sí contrastó el código, los tests y logs de CI. No se confunde con una ejecución independiente.
