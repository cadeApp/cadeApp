# PR #501 — T-391 · Cabeceras de seguridad y CSP

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/501 |
| Autor | Lautaro073 |
| Base | develop |
| Rama | `feat/T-391-security-headers` |
| SHA de código revisado | `bbc4b4f1423efc3b14795d261d2f018bbce5d59f` |
| Resultado de ronda 1 | **CON BLOQUEANTES (1 de evidencia)** |

## Rondas

| Ronda | SHA | Hallazgos | Informe |
|---|---|---|---|
| 1 | `bbc4b4f1423efc3b14795d261d2f018bbce5d59f` | PR501-H01 (evidencia), abierto | [ronda-1](revisiones/ronda-1.md) |

**D01=A, decidida por Lautaro073:** el test debe cargar **Google Maps real** en el Preview. En este SHA el código ya pulsa «Fijar en mapa interactivo» antes de comprobar la respuesta y la región `Map` (inspección, no ejecución).

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Pendiente

Actualizar la bitácora con los resultados **reales** del nuevo E2E y su mutación negativa RED→GREEN, más el estado final del CI y las violaciones Report-Only realmente observadas. No inventar salidas ni alterar tests. La revisión independiente debe verificar después de esos resultados. No se aprueba ni mergea.
