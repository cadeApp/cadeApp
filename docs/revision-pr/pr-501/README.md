# PR #501 — T-391 · Cabeceras de seguridad y CSP

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/501 |
| Autor | Lautaro073 |
| Base | develop |
| Rama | `feat/T-391-security-headers` |
| SHA de código revisado | `bbc4b4f1423efc3b14795d261d2f018bbce5d59f` |
| Resultado de ronda 1 | **Ronda 2: SIN BLOQUEANTES técnicos (CI pendiente; RED no reproducido independientemente)** |

## Rondas

| Ronda | SHA | Hallazgos | Informe |
|---|---|---|---|
| 1 | `bbc4b4f1423efc3b14795d261d2f018bbce5d59f` | PR501-H01 (evidencia), abierto | [ronda-1](revisiones/ronda-1.md) |

**D01=A, decidida por Lautaro073:** el test debe cargar **Google Maps real** en el Preview. En este SHA el código ya pulsa «Fijar en mapa interactivo» antes de comprobar la respuesta y la región `Map` (inspección, no ejecución).

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Resultado de ronda 2

La bitácora aporta GREEN 7/7, RED del mapa con bloqueo de Google y retorno GREEN 1/1, más 4 reportes Report-Only atribuibles a Vercel Live. La revisión ejecutó comprobaciones documentales 9/9 y comparó 4 blob SHA de código idénticos. No pudo repetir Playwright ni la mutación del autor, por lo que **no falsifica** el estado verificado: PR501-H01 = arreglado-sin-verificar.

Sin nuevos bloqueantes técnicos. CI y e2e-preview oficiales todavía sin resultado final confirmado; no se aprueba ni mergea.
