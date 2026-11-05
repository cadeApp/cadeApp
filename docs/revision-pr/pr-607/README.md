# PR #607 — T-404 · Detalle del postulante según A02

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/607 |
| **Tarea** | T-404 (Fase 4, #485) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-404-detalle-postulante-a02` → `develop` |
| **Base de comparación** | `7d07fdf80d94bce49580ec84cc39722b5bff4756` |
| **SHA revisado** | `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc` |
| **Tamaño** | 16 archivos, +1101/-115 líneas |
| **Estado** | **ACEPTADA POR REVISIÓN INDEPENDIENTE — SIN BLOQUEANTES (0)**; CI y E2E del SHA de código completos en verde (2 flaky recuperados); PR aún Draft, sin merge |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e5ca27ad4040` | 2 bloqueantes + 1 ajuste de proceso | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `1d4fcc2900c8` | **Aceptada: 0 bloqueantes; H01/H02 verificados; H03 aceptado** | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR607-H01 | Recorte elimina eventos de registro/envío | alto | arreglado-verificado (CI unit, SHA código `1d4fcc29`) |
| PR607-H02 | «Ver todo» no trae auditoría completa de ese repartidor | alto | arreglado-verificado (CI unit + E2E, SHA código `1d4fcc29`) |
| PR607-H03 | Ficha/PR necesitan reflejar traslado del DoD a CC separado | medio | aceptado (D01=C y ficha reconciliada) |

**Decisión D01=C:** mensaje seguro para repartidor en un CC + tarea aparte, sin ampliar contratos en T-404. Issue abierto y asignado: [#609](https://github.com/cadeApp/cadeApp/issues/609). **D02=C:** filtro `?courier=<uuid>` para repartidor y documentos; la ficha puede incorporar los archivos de auditoría acordados. **D03=C:** 50 filas reales de auditoría + hasta 2 hitos, máximo 52.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia y procedimientos: [evidencia/comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Cierre definitivo de la revisión — 2026-11-04

**Código verificado:** `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc`. **HEAD anterior al cierre:** `ccc8965ad052f77917ebf9f5eaf043ad9fa99925`; su único commit posterior al código modificaba exclusivamente 5 archivos de `docs/revision-pr/pr-607/` (comparación GitHub: ahead 1, behind 0). El commit de este cierre también es exclusivamente documental. Los resultados de ejecución pertenecen al SHA **de código**, no se atribuyen falsamente al commit de documentación.

- **CI #41947713873**: todos los jobs concluyeron `success`; `unit`: **193 archivos, 3568/3568 tests**; `db-tests`: **42 archivos, 3396 tests, PASS**; typecheck, lint, build y audit verdes. Bundle budget job success con **warning existente** en `/admin/applicants/[id]` y `/admin/audit`: 267 kB frente al presupuesto 180 kB, valores iguales a los SHAs de R01.
- **E2E #41947878934**: `e2e-preview=success` publicado en el SHA de código. Runner hizo checkout explícito de `1d4fcc29`; Playwright Chromium: **114 passed + 2 flaky**, ambos recuperados; `global-settings`: **6 passed**. Pasó directamente el test T-404 de `courier-onboarding` con «Ver todo en Auditoría». El spec `admin-courier-reinstate` terminó pasando en retry #2; su falla inicial es selector `getByText('Aprobado')` en línea 100 **presente ya en develop**, anterior a las aserciones T-404.
- **Flaky restante:** T-410 `admin-trips` falló en la navegación una vez y pasó en retry #1. La línea 100 del T-380 se resuelve ambiguamente entre dos badges y pasó en retry #2. **No se atribuyen a T-404 ni se ocultan como «todo pasó al primer intento».**
- **Observaciones no bloqueantes:** el E2E nuevo no fuerza datos `courier_document` ni segunda página; el test unitario sí ejercita la construcción del OR y el cursor. La consulta de IDs documentales no pagina sobre `max_rows=1000`, lo cual queda como posible riesgo de escala, no defecto reproducido. El aviso de bundle es previo.
- **D01=C:** motivo de rechazo visible al repartidor en CC+tarea independientes, seguimiento [#609](https://github.com/cadeApp/cadeApp/issues/609). H03 aceptado con la ficha/bitácora/PR actualizadas.

**Estado:** revisión R02 cerrada y **aceptada sin bloqueantes**. No se ejecutaron mutaciones independientes en un clon local por restricción del entorno: la verificación independiente se basa en lectura del código más evidencia de tests oficiales ejecutados en GitHub Actions y E2E de Preview del SHA exacto. `approval-policy` había fallado porque el cuerpo del PR aún decía «Pendiente» en «Informe de revisión de agy»; el informe completo de aceptación se incorporará al cuerpo. No se aprueba ni mergea automáticamente. No se exige un nuevo E2E GREEN por commits de documentación.
