# PR #402 — T-369, paso 2/3 UI de créditos y planes

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/402 |
| Tarea | T-369, CC-029, issue #356 |
| Autor | Lautaro073 |
| Rama | `feat/T-369-ui` → `develop` |
| SHA ronda 1 | `81f277970928dc50ddb1fcea709bf0319f9e6f64` |
| SHA ronda 2 | `5e14b05c843fd8021881db5ef50a886e4d240a35` |
| SHA código ronda 3 | `cd573afbc4c7c6d895145eea26285ca0ee14ffad` |
| Estado | **Ronda 3: SIN BLOQUEANTES DE CÓDIGO**; pendiente la decisión de merge y gate externo E2E migration |

## Rondas

- [Ronda 1](revisiones/ronda-1.md): 4 bloqueantes, D01-B aprobada por Lautaro073.
- [Ronda 2](revisiones/ronda-2.md): H01/H03 arreglados según inspección, H02/H04 parciales.
- [Ronda 3](revisiones/ronda-3.md): H02/H04 reparados, evidencias RED→GREEN reales de PostgreSQL en CI, oráculo estático independiente y sin bloqueantes de código encontrados.

## Estado de hallazgos

- **PR402-H01** — `arreglado-sin-verificar`: La clave de idempotencia de acreditación/plan se pierde al remontar el diálogo o recargar la página.
- **PR402-H02** — `arreglado-verificado`: Un error al reportar no-show desde el diálogo solo se comunica con un toast genérico.
- **PR402-H03** — `arreglado-sin-verificar`: El catálogo está limitado a 100 planes sin paginación ni recuperación de registros restantes.
- **PR402-H04** — `arreglado-verificado`: La lectura con service role no satisface la arquitectura D01-B aprobada; falta RPC de listado con permisos DB.
- **PR402-D01** — `aceptado`: D01-B elegida expresamente por Lautaro073: listado RPC, no lectura service role.

**Distinción:** `arreglado-verificado` en H02/H04 refleja verificación estática instrumentada propia más inspección de CI auténtico del SHA, **no ejecución de DB local por revisor**. H01/H03 mantienen `arreglado-sin-verificar` por no haber ejecución independiente. Ningún hallazgo `abierto`, `parcial` ni `decision-pendiente`.

[Evidencia ronda 3](evidencia/ronda-3.md) · [script reproducible](evidencia/comandos.md) · [lecciones](lecciones.md) · [hallazgos](hallazgos.jsonl).

No se aprobó, mergeó ni cerró #356. Piloto sin cambios. El E2E Preview no está verde hasta migrar Develop; paso 3/3 posterior al checkpoint de UI.