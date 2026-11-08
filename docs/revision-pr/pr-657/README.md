# PR #657 — T-408 / CC-047 · Hardening administrativo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/657 |
| Issue | CC-047 #656 · Bloquea T-408 #495 |
| Autor | @Lautaro073 |
| Rama | `cc/CC-047-admin-hardening` → `develop` |
| Base | `4e700aa2d5f3edb362446675a736903fbb55dd35` |
| Estado | **CON BLOQUEANTES (2)** en ronda 2 |
| Decisiones | D1=A · D2=B · D3=B (cerradas) |

## Rondas

| Ronda | SHA revisado | Estado | Informe |
|---|---|---|---|
| 1 | `f4878f8814f0002a758545d6e9617ae2da7299b7` | 4 bloqueantes iniciales | [ronda 1](revisiones/ronda-1.md) |
| 2 | `ec341a04939b9cc9ae24b574c440a19d6690e591` | H01–H04 corregidos por inspección; 2 bloqueantes nuevos | [ronda 2](revisiones/ronda-2.md) |

## Estado de los hallazgos

| ID | Situación |
|---|---|
| PR657-H01 | Arreglado en contrato, sin pruebas SQL ejecutadas |
| PR657-H02 | Arreglado en contrato, sin pruebas SQL ejecutadas |
| PR657-H03 | Arreglado en contrato, sin pruebas SQL ejecutadas |
| PR657-H04 | Arreglado en contrato, sin pruebas SQL ejecutadas |
| PR657-R01 | **Abierto / alto** — 10 rutas de suites y una ruta real de migración fuera del parser de «Archivos permitidos» |
| PR657-H05 | **Abierto / alto** — contradicción grants/autoservicio y checklist de concurrencia |

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Próximo paso

Arreglo exclusivamente documental de `CC-047.md` y `T-408.md` según [ronda 2](revisiones/ronda-2.md). No tocar la carpeta de revisión desde el agente. Solo tras nueva revisión independiente sin bloqueantes se podrá valorar merge del CC. La implementación y pgTAP corresponden a T-408.

**Operación humana posterior (D2):** Lautaro073 ejecuta el SELECT de candidatos en cada ambiente y resuelve los casos antes de promover. Nada de esto fue ejecutado en ronda 2.
