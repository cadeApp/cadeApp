# PR #402 — T-369, paso 2/3 UI de créditos y planes

| Dato | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/402 |
| Autor | Lautaro073 |
| Base | `develop` |
| Rama | `feat/T-369-ui` |
| Ronda 1 (código) | `81f277970928dc50ddb1fcea709bf0319f9e6f64` |
| Ronda 2 (código) | `5e14b05c843fd8021881db5ef50a886e4d240a35` |
| Estado | **Ronda 2 CON BLOQUEANTES (2)**, H02 y H04 parcialmente cerrados |

## Rondas

- [Ronda 1](revisiones/ronda-1.md): cuatro bloqueantes; D01-B elegida por Lautaro073.
- [Ronda 2](revisiones/ronda-2.md): implementación D01-B presente y CI de código verde observado, pero falta catch de excepción de no-show y RED real de permisos/cursor SQL.

## Hallazgos

- **PR402-H01** — `arreglado-sin-verificar`: La clave de idempotencia de acreditación/plan se pierde al remontar el diálogo o recargar la página.
- **PR402-H02** — `parcial`: Un error al reportar no-show desde el diálogo solo se comunica con un toast genérico.
- **PR402-H03** — `arreglado-sin-verificar`: El catálogo está limitado a 100 planes sin paginación ni recuperación de registros restantes.
- **PR402-H04** — `parcial`: La lectura con service role no satisface la arquitectura D01-B aprobada; falta RPC de listado con permisos DB.
- **PR402-D01** — `aceptado`: D01-B elegida expresamente por Lautaro073: listado RPC, no lectura service role.

D01-B es una **decisión cerrada**, no una consulta abierta. Los hallazgos H01 y H03 están `arreglado-sin-verificar` por el revisor (se analizaron código y logs externos); H02 y H04 permanecen `parcial` hasta próxima ronda. Ninguno se marca `arreglado-verificado` sin verificación independiente reproducible.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/ronda-2.md) · [Lecciones](lecciones.md).

**No aprobar ni mergear.** No cerrar issue #356, no apagar el piloto, no iniciar paso 3/3.