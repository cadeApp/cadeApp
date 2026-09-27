# PR #109 — T-116 · Componente de mapa

> ❌ Ronda 2 independiente: CON 2 BLOQUEANTES · 0 decisiones pendientes

| Campo | Valor |
|---|---|
| PR | #109 |
| Tarea | T-116 |
| Autor | @asako669 · P2 |
| SHA revisado | df73adac155a3b34db60d6a126ac85e53209e8e5 |
| develop actual | 47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a |
| CI | #487 · verde sobre merge sintético con develop actual |
| Decisiones | ninguna pendiente |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | 9acf2ac6 | 9 bloqueantes |
| 2 | df73adac | **2 bloqueantes** |

## Cierre parcial

Verificados: H01, H02, H03, H04, H06, H08 y H09.

Pendientes:
- **H05:** tests corregidos y verdes, pero falta la mutación roja reproducible `onChange={() => {}}` pedida explícitamente.
- **H07:** la evidencia visual/axe no proviene de la app real; `offline` muestra el mapa activo y los reportes usan `localhost:4567`.

El branch figura behind 1, pero CI #487 chequeó el merge sintético `df73adac + develop@47d65c41` (`a9a69b2...`), por lo que no se abre hallazgo de sincronización.

No hay decisiones nuevas para Lautaro073.

Ver revisiones/ronda-2.md.
