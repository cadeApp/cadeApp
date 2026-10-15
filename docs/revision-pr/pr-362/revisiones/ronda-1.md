# Informe de revisión — PR #362 / T-353 — Ronda 1

**Fecha:** 2026-10-15. **HEAD exacto inspeccionado:** `1a433728edcd8e7d6a5e89f27e07763fe330083a`. **Base:** `develop@14c28ed3`. **Autor:** asako669.
**Resultado:** **CON BLOQUEANTES (7)**. La PR está Draft. No se aprueba ni mergea.
**Modalidad:** revisión del diff GitHub completo y archivos de referencia (ficha leída desde develop), más control Node aislado para expresiones JS. El entorno no pudo resolver github.com mediante git: no hubo clon, `pnpm`, ejecución de Vitest ni mutaciones reales sobre el módulo. No se declara "verificado-runtime" ni GREEN de CI como propio.

## Resumen
| Hallazgo | Severidad | Ubicación | Qué falta |
|---|---|---|---|
| PR362-H01 | alto | `src/features/requests/schemas.ts:68` | Límite monetario contrario a decisión 1B |
| PR362-H02 | alto | `src/features/requests/schemas.ts:52` | Teléfonos aceptados sin persistencia normalizada y sintaxis permisiva |
| PR362-H03 | medio | `src/features/courier-onboarding/schemas.test.ts:147` | Prueba walk/bike da verde aunque el onboarding rechace la operación |
| PR362-H04 | medio | `src/features/requests/schemas.ts:75` | El filtro de controles rechaza saltos de línea legítimos en notas |
| PR362-H05 | alto | `src/features/requests/actions.test.ts:1` | Faltan pruebas en la frontera real de Server Actions |
| PR362-H06 | alto | `e2e/specs/multi-drop.spec.ts:1` | E2E Preview y validación de UI por campo pendientes |
| PR362-H07 | medio | `docs/tasks/log/T-353.md:36` | La bitácora declara RED→GREEN sin salida roja reproducible |

## Diagnóstico, evidencia y corrección exacta

### PR362-H01 — Montos
**[ANÁLISIS]** `src/features/requests/schemas.ts:68,146` limita ambos montos a 10_000_000. Decisión 1B: reemplazar por `2_147_483_647` en `cashChangeAmount` y `fixedPriceArs`, y mensajes asociados. El SQL de CC-024 valida `<1`, `>2147483647` y fracciones: alinear Zod, sin tocar SQL. Tests para 10_000_001, 2_147_483_647 (acepta); 2_147_483_648, 0, fracciones y valores no finitos (rechaza) en ambos campos y los flujos legacy/multi-drop. Mutación independiente pendiente: restituir límite de 10M y obtener RED de los casos de borde.

### PR362-H02 — Teléfonos sin canonización
**[ANÁLISIS + CONTROL AISLADO]** `src/features/merchants/schemas.ts:30`, `src/features/requests/schemas.ts:52` validan con `.refine(isValidArgentinePhone)` sin transformar el output; ambas Actions persisten/envían `parsed.data.phone` y `drop.recipientPhone` literalmente. La implementación de `extractValidArgentineTenDigits` elimina cualquier signo permitido donde esté: el control aislado acepta `++54 9 3865 123456` y `3865 +123456`. Mantener formatos legítimos nacionales/internacionales, pero validar `+` solo al inicio de prefijo internacional `+54` y paréntesis balanceados, no símbolos internos arbitrarios. Tras validar, transformar `phone` y `recipientPhone` a los 10 dígitos nacionales antes de enviarlos a Actions/RPC. Afirmar salida parseada, no solo `success`; usar mocks de escritura para comprobar valores recibidos. Mutaciones pendientes: restaurar solo `.refine` sin `.transform` y permitir `++54`; la prueba nueva debe quedar RED.

### PR362-H03 — Test que acepta falla
**[ANÁLISIS]** `src/features/courier-onboarding/schemas.test.ts:147-159`: si el parser falla, el test acepta `expect(res.success).toBe(false)`, de modo que una implementación que rechace `walk` siempre podría pasar. Reemplazar por `expect(res.success).toBe(true)`, comprobar `res.data.vehiclePlate === null` para `walk` y `bike`, con placa maliciosa, válida y omitida. Añadir caso de integración Action que inspeccione `couriers.update` y garantice `vehicle_plate: null`. El transform de producción ya realiza la normalización pedida en 2A; no modificarlo salvo defecto probado. Mutación: forzar error del parser en walk/bike, nueva prueba debe fallar.

### PR362-H04 — Notas multilinea
**[ANÁLISIS + CONTROL AISLADO]** `CONTROL_CHARS_REGEX` incluye `\x09`, `\x0A`, `\x0D` en `src/features/merchants/schemas.ts` y `src/features/requests/schemas.ts`, por lo que rechaza tabulaciones y saltos de línea legítimos en los textarea de notas. Separar `NOTES_CONTROL_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/` para `notes`; dejar política más estricta en nombres/direcciones de una línea. Probar `'Portón azul\nPiso 2'` válido y `'Portón\x00azul'` inválido. Mutación: volver a usar regex estricto en notes, prueba debe fallar.

### PR362-H05 — Server Actions no ejercitadas con payload adulterado
**[ANÁLISIS]** El diff incluye nuevos tests Zod, pero no actualiza `src/features/{courier-onboarding,merchants,requests}/actions.test.ts`. Extender **esos tests existentes** con identidad autorizada, llamadas a las Actions reales y espías sobre sus escrituras/RPC. En merchants/courier, afirmar que un payload inválido retorna `VALIDATION_ERROR` y no hace `profiles.update`, `merchants.update`, `couriers.update` ni upserts; en requests, adulterar el segundo drop y afirmar que `create_and_publish_multi_drop` no se invoca. En casos válidos comprobar teléfono canonizado y vehicle_plate nula. No reemplazar Actions por un mock que sortee la validación. Mutación: omitir temporalmente `safeParse` en un scratch/ejecución aislada y comprobar falla del test de rechazo, sin commit ni push.

### PR362-H06 — E2E Preview y UI
**[ANÁLISIS]** DoD T-353 exige error específico, posibilidad de corrección y completar flujo válido en Vercel Preview + Supabase Develop. No hay cambios ni identificador de corrida en las specs E2E. Completar `e2e/specs/courier-onboarding.spec.ts`, `merchant-registration.spec.ts`, `multi-drop.spec.ts` o `main-flow.spec.ts` según el flujo real; usar fixtures segregadas, sin datos QA personales. Añadir test UI de DNI inválido en `src/features/courier-onboarding/components.test.tsx`. Registrar SHA, run, resultados y bloqueos verdaderos. No desplegar mutaciones inseguras ni disparar workflows manuales.

### PR362-H07 — Evidencia de RED→GREEN
**[ANÁLISIS]** La bitácora 00:23 menciona 2196 tests en verde y transición RED→GREEN, pero no incluye salida de los casos rojos ni comandos que reproduzcan esa transición. Es evidencia del autor, no comprobación del revisor. En su bitácora, el agente debe anotar exactamente qué SHA/árbol y qué comandos demuestran el RED previo; para nuevos controles, demostrar GREEN original → RED con mutación reversible → GREEN restaurado. Incluir líneas resumen `Tests …` y no fabricar datos si el test no se ejecutó. Las mutaciones de esta revisión se harán en ronda posterior, con worktree limpio.

## NO TOCAR / descartados
- **2A ya implementada parcialmente:** `courierOnboardingSchema.transform` anula la patente de `walk/bike`; el problema es la prueba débil, no el concepto.
- DNI de 7/8 dígitos y caso `ELA666`/`ELA 666` están cubiertos en matrices nuevas. No endurecer arbitrariamente formatos argentinos ni asignar formato exclusivo a vehículo sin respaldo del contrato.
- El servidor ya llama a los schemas Zod en las Actions; no hace falta duplicar la validación ni tocar `src/domain/**`, SQL o RLS.
- Los archivos del diff actual están dentro de la allowlist T-353. No se agregó dependencia nueva.

## Limitaciones de verificación
- **CI:** no auditada la corrida exacta mientras subsistan bloqueantes, conforme a reglas de revisión. La bitácora declara `typecheck/lint/test` verdes, sin atribuir esos checks a esta revisión.
- **Merge-tree / fetch:** `git fetch`/`git merge-tree` no ejecutables aquí, la resolución DNS de github.com falló. GitHub reportó `mergeable: true` al consultar el HEAD, que no equivale a la prueba local.
- **Pruebas independiente:** solo script Node aislado para patrones exactos de JS; no equivale a ejecutar Zod, Actions, pgTAP ni E2E.
- **Decisiones:** 1B y 2A confirmadas por Lautaro antes del cierre; sin decisiones abiertas.
- **Estado:** hallazgos abiertos, `verificado_en_sha=null` para todos. Repetir revisión exact-head tras push del agy.

Comandos y salida: [evidencia/comandos.md](../evidencia/comandos.md).
