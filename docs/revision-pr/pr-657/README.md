# PR #657 — T-408 / CC-047 · Hardening administrativo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/657 |
| Issue | CC-047 #656; bloquea T-408 #495 |
| Autor | @Lautaro073 |
| Rama | `cc/CC-047-admin-hardening` → `develop` |
| Base revisada | `4e700aa2d5f3edb362446675a736903fbb55dd35` |
| Estado ronda 3 | **SIN BLOQUEANTES documentales**, con CI db-tests pendiente al cierre de la inspección |
| Decisiones | D1=A · D2=B · D3=B |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `f4878f8814f0002a758545d6e9617ae2da7299b7` | 4 bloqueantes | [ronda 1](revisiones/ronda-1.md) |
| 2 | `ec341a04939b9cc9ae24b574c440a19d6690e591` | 2 bloqueantes nuevos | [ronda 2](revisiones/ronda-2.md) |
| 3 | `09df17bc0be7bbdf4ef97a12f7bf32f849537c7d` | **SIN BLOQUEANTES** en el CC y la ficha | [ronda 3](revisiones/ronda-3.md) |

## Estado de los hallazgos

| ID | Estado de revisión | Próxima exigencia |
|---|---|---|
| H01 · SECURITY INVOKER | arreglado-sin-verificar | Ejecución del pgTAP real al implementar T-408 |
| H02 · RPC D1/CC-031 | arreglado-sin-verificar | pgTAP y concurrencia B/C reales en T-408 |
| H03 · rpc_admin.sql | arreglado-sin-verificar | Cambio concreto de test y SQL en T-408 |
| H04 · D2 sin backfill | arreglado-sin-verificar | Preservación real de datos y revisión manual por ambiente |
| R01 · rutas permitidas | **arreglado-verificado** en SHA de ronda 3 | Ninguna en el CC |
| H05 · coherencia de DoD | **arreglado-verificado** en SHA de ronda 3 | Ninguna en el CC |

Los cuatro primeros están corregidos **en el contrato** pero la ejecución del SQL futuro no puede verificarse en una PR que solo contiene documentación. No son bloqueantes nuevos del CC.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y harness independiente](evidencia/comandos.md) · [Lecciones](lecciones.md).

**Operación humana posterior (D2):** Lautaro073 ejecutará el SELECT de candidatos en cada ambiente, resolverá los casos y dejará constancia antes de promover T-408. **No se realizó ahora.**

La revisión no aprueba ni mergea la PR. La CI del commit revisado debe evaluarse por su SHA; no pedir una corrida nueva exclusivamente porque esta carpeta de revisión mueve el HEAD.
