# Informe de revisión independiente — PR #476 / T-389 — ronda 1

**Fecha:** 2026-10-21  
**PR:** https://github.com/cadeApp/cadeApp/pull/476  
**HEAD del código revisado:** `2fe4935d233a0ade030f8adc1072304571e9a5d2`  
**Base develop:** `214404e0a2baca7ba7e4c87c35ef78c3de3d2109`  
**Resultado:** **CON BLOQUEANTES (1, solo evidencia E2E).** No se detectó una falla de implementación demostrable por inspección; el gate E2E necesario para habilitar el merge sigue sin validarse.

## Alcance y evaluación

- **Alcance:** los 11 archivos cambiados pertenecen a los «Archivos permitidos» de `docs/tasks/T-389.md` leído desde develop. La ficha no fue modificada en esta PR. No hay contratos, RPC, migraciones, `src/ui`, dependencias ni `.env` cambiados.
- **Arquitectura:** `TripDetailPage` mantiene el botón de incidentes en el servidor, con `actorRole`, estado del viaje, fecha e instante real; lo inyecta como `incidentAction` en `TripCourierContainer` y `TripCourierView`. La vista comercio y `canReportIncident` (D05-A) no cambian.
- **Posición visual:** `TripCourierView` ubica el slot a continuación de «No puedo hacer este viaje», en el nodo con `pb-32`, antes del CTA fijo. El botón `ghost` conserva ícono y texto. Con `in_transit` no hay cancelación y sí puede aparecer el slot. La función preexistente `canReportIncident` evita mostrarlo al repartidor entregado.
- **ETA:** la opción `<option value={5}>5 min</option>` se convierte con `Number(e.target.value)` en `etaMinutes: 5`; el contrato existente acepta 1–240.
- **Cobertura disponible:** tests de vista `matched`/`in_transit`, wiring de la página por rol/estado, variante ghost, opción 5 y envío; E2E usa `elementFromPoint` del centro del botón real. La batería propia propuesta consta en evidencia, pero **no se ejecutó** en este entorno.

## PR476-H01 — 🔴 Bloqueo de evidencia E2E, no de código demostrado

**Fuente:** cuerpo de la PR; `docs/tasks/log/T-389.md:34-41`; job de GitHub Actions [39640417342](https://github.com/cadeApp/cadeApp/actions/runs/39640417342).  
**Severidad:** medio (bloqueante de DoD) · **Estado:** abierto · **Detección:** inspección de bitácora y logs remotos.

### Diagnóstico

El cuerpo de la PR dice que el E2E contra Preview ya tiene evidencia en la bitácora. Pero la última entrada de la bitácora declara explícitamente «E2E contra el Preview: pendiente» y «Falta: E2E contra el Preview». El workflow que correspondía al Preview terminó `cancelled` durante `Run preview E2E gate` tras comenzar Playwright, y publicó `e2e-preview = error` para el SHA de la PR. **No consta una aserción fallida ni una validación exitosa de ese gate.**

No se debe corregir el producto ni relajar el test a partir de una cancelación: hay que obtener una corrida concluyente del gate en el Preview de T-389. Si el gate falla con aserciones reales, abrir nueva ronda identificando el fallo concreto.

### Resolución exigida

- Obtener `e2e-preview = success` para el commit de la PR con las pruebas del nuevo recorrido `matched`. Si GitHub no lo relanza por un nuevo deployment, reejecutar manualmente el workflow cancelado desde la interfaz autorizada; no alterar el workflow ni forzar un check verde.
- Actualizar **solo** `docs/tasks/log/T-389.md` con URL del run, SHA probado y resumen de ejecución, sustituyendo los rótulos «pendiente» por hechos comprobados. El hecho de que CI esté verde para unitarios no sustituye E2E.
- La documentación de revisión pertenece exclusivamente a la revisión independiente.

### Cómo verificar

Abrir el job de `e2e-preview` y corroborar que ejecuta `main-flow.spec.ts` contra el Preview de **este SHA**, sin `skip`/filtrado que omita el caso de T-389. Registrar el resultado real, incluyendo número de pruebas cuando conste.

## Evidencia de checks del SHA inspeccionado

| Check | Observación |
|---|---|
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | `success` |
| `unit` | `success`; log del job: **155 archivos / 3158 tests passed** (suite completa, distinta de los 587 tests parciales declarados por el autor) |
| `db-tests` | Aún `in_progress` en el último acceso; no declarado verde |
| `e2e-preview` | `error` por corrida 39640417342 `cancelled` (no aserción fallida) |
| `approval-policy` | `failure` antes del informe independiente; no equivale a bug de aplicación |
| Vercel | deployment Preview disponible; no sustituye E2E |

**Checks locales independientes:** no ejecutados: el contenedor no tiene clon del repo y `git ls-remote` devolvió `Could not resolve host: github.com`. No se levantó Docker ni Supabase y no se lanzaron workflows.

## NO TOCAR — falsos positivos descartados

- **«Server Component como slot hacia cliente es inválido».** El patrón de pasar `ReactNode` desde Server a Client Component es compatible con App Router; el trigger mantiene su isla cliente. No convertir `ReportIncidentButton` en componente cliente.
- **«Debería haber botón del repartidor en `delivered`».** D05-A lo prohíbe. El test de la página usa un mock que devuelve un nodo en todos los estados; la autorización real se verifica por separado en `report-incident-button.test.tsx`.
- **«`pb-32` debe aplicarse al botón».** Se aplica al contenedor padre como reserva inferior; la posición del slot queda dentro de ese contenedor.
- **«La cancelación es un fallo del E2E de T-389».** Sin error de aserción visible, no hay causalidad demostrada.

## Metodología y límites

Consulta de la ficha original en develop, instrucciones `COMO-ENTREGAR`/README/skill, metadatos del HEAD, diff, fuentes relacionadas, tests, comentarios y logs de CI. Comparación de HEAD y develop por refs remotas, y `mergeable = true` según GitHub. No se ejecutaron `git merge-tree`, `pnpm` ni mutaciones RED→GREEN propias por falta de clon/ejecutor local. `verificado_en_sha` queda nulo. **No aprobar ni mergear** hasta cerrar H01 y confirmar los checks.
