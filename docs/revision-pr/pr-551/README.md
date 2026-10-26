# PR #551 — T-415 · Repartidores conectados ahora

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/551 |
| Autor | Lautaro073 |
| Rama | `feat/T-415-online-couriers` → `develop` |
| Contrato | CC-041 (mergeado previamente) |
| HEAD de ronda 2 | `b72e2bfad3fdae55843326fce61a72b17d66b4e8` |
| Código de las nuevas pruebas | `f77d86c67baec208bae3f350faeee0ea2293502a` |
| Ronda 1 | 4 bloqueantes; autorización A01 |
| Ronda 2 | H01–H04 corregidos por inspección, CI de código verde; no ejecutados independientemente |
| Situación para merge | **NO APTA:** `audit` global rojo (Zod; T-416/#555), evidencia ejecutable independiente pendiente, PR Draft |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `a3f349817426a4d1940abea547e9d391da0d03b0` | 4 bloqueantes y A01 aceptada | [ronda-1](revisiones/ronda-1.md) |
| 2 | `b72e2bfad3fdae55843326fce61a72b17d66b4e8` | Sin nuevos bloqueantes técnicos; H01–H04 arreglados sin ejecución independiente; audit externo rojo | [ronda-2](revisiones/ronda-2.md) |

## Hallazgos

| ID | Estado tras ronda 2 |
|---|---|
| H01 | `arreglado-sin-verificar` (consentimiento por perfil y nuevos tests) |
| H02 | `arreglado-sin-verificar` (observer real y error con cache) |
| H03 | `arreglado-sin-verificar` (4 mutaciones SQL RED confirmadas en CI de ramas del autor, no generadas por la revisión) |
| H04 | `arreglado-sin-verificar` (valor 27, extremos, paridad formulario/RPC) |
| A01 | `aceptado`, sin nueva decisión |

**Límite de evidencia:** inspección independiente del código, hashes, diffs de mutaciones y logs del CI sí; **mutaciones ejecutadas por este revisor: ninguna**, no había clon/dependencias. No convertir evidencia del autor en `arreglado-verificado`. El test SQL de código en `f77d86c67baec208bae3f350faeee0ea2293502a` pasó **Files=40, Tests=3252** y unit del HEAD `b72e2bfad3fdae55843326fce61a72b17d66b4e8` pasó **184/184 archivos, 3411/3411 tests**. El último commit de código es `f77d86c67baec208bae3f350faeee0ea2293502a`; `b72e2bfad3fdae55843326fce61a72b17d66b4e8` solo documenta resultados.

No se levanta Supabase/Docker local. El E2E real será tras `migrate-develop`; T-416 corrige el audit global ajeno a esta PR. No se aprueba, no se mergea ni se exigen CI verdes nuevos solo por revisar/editar bitácora.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y arneses](evidencia/comandos.md) · [Lecciones](lecciones.md).
