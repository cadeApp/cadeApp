# Revisión independiente — PR #318 / T-340 — Ronda 8

**Fecha:** 2026-10-12 · **SHA del código de Asako auditado:** `c50f5dfa1c723378bbe1a657a460a025b0cf6bd6` · **Rama:** `feat/T-340-lectores` → `develop` (Draft, mergeable, sin atraso respecto de la base observada). **Delta desde R7:** commits `51397167` (código) y `c50f5dfa` (bitácora); **6 archivos**: `queries.ts`, `queries.test.ts`, `privacy-checker.ts` (nuevo), `privacy-checker.test.ts` (nuevo), `multi-drop.spec.ts`, bitácora. Ningún cambio del autor a `docs/revision-pr/**`. 

## Dictamen R8 — CÓDIGO CORREGIDO; CHECKPOINT Y EVIDENCIA DE MUTACIÓN PENDIENTES

**No se detectaron nuevos bloqueantes de código en este delta por inspección.** Los defectos R7 H06, H11 y H12 fueron corregidos en fuente y tienen pruebas positivas y negativas que pasan en CI real. El Paso 2 **NO está habilitado todavía para merge sin condiciones**: falta reproducir/adjuntar un RED→GREEN adversarial de los controles nuevos, cerrar esta verificación independiente y obtener autorización expresa de Lautaro073. El E2E real de 3 drops **no corrió en Preview** por el diseño de migraciones; Lautaro073 eligió R8 **opción A: merge controlado y checkpoint obligatorio posterior**. No interpretar el bloqueado como aprobado.

### Decisión de Lautaro073, ronda 8 — Opción A CERRADA

**Queda autorizada la excepción de ORDEN del E2E para Paso 2/4**, no su eliminación: revisión de código sin bloqueantes + todos los checks técnicos verdes + evidencia de controles adversariales + autorización explícita de merge → integrar PR #318 → esperar **migrate-develop** automático sobre el SHA mergeado → desplegar código compatible → ejecutar realmente el spec E2E de 3 drops y el checkpoint legacy **antes** de comenzar Paso 3 de Kira. Si no pasa, congelar rollout y corregir Paso 2 con PR independiente.

**Hallazgo operativo verificado sobre workflows:** `.github/workflows/e2e-preview.yml` solo escucha `repository_dispatch` de Vercel para PR **abierta** y `.github/workflows/e2e-preview-target.mjs:110–118` exige una PR abierta contra Develop con HEAD del deployment; no corre automáticamente sobre un commit ya mergeado. Además `gatePreview` bloquea cualquier PR que incluya una migración. **Para ejecutar E2E posterior sin modificar pipelines**: crear **después de la migración** una **PR temporal de checkpoint** derivada de Develop ya migrado, con cambio documental mínimo y sin archivos `supabase/migrations/**`; su propio Vercel Preview hace que el workflow existente ejecute los specs del HEAD compatible contra Supabase Develop. Guardar run/job/SHA y cerrar esa PR temporal **sin mergearla**. No crearla hoy ni desplegar migraciones manuales. **Esta estrategia quedó registrada por el revisor en `docs/tasks/T-340.md`, commit `d55e71df9bcb589d0d49a25a9618ca040ef284f6`.** No se autoriza modificar workflows ni bypass de seguridad, no staging ni producción.

### H06 — Código corregido en R8; cobertura de fuente y CI

`src/features/requests/queries.ts:242–299` añade `assertAndMapMerchantDrops(requestId,status,declaredDropsCount,children)`. Para cualquier estado post-draft valida mínimo 1 drop, cardinalidad real `children.length===declaredDropsCount` cuando se declara y posiciones consecutivas desde 1; lanza error ante inconsistencias (no fabrica `chico/cash` para publicados). Conserva draft incompleto explícitamente; `mapRawMerchantRequests` y `getMerchantRequestWithOffers` usan la misma función, y las listas/historial/detalle ya consultaban children por lotes desde R7. **Inspección favorable:** cuando `cancel_request` corre sobre SQL de Paso 1, `draft` no puede convertirse directamente a `cancelled` (`INVALID_STATE_TRANSITION`); el tratamiento de estados distintos de draft como materializados es coherente con esta vía de transición.

**Tests del SHA:** `src/features/requests/queries.test.ts` llama por separado a `getMerchantRequests` (3/3, positivo) y `getMerchantHistoryRequests` con `delivered` (3/3, positivo); casos negativos 3/1, 3/0, 1/0, hueco 1/3 en positions, además de fallo de detalle y drafts. `unit` CI pasa **2116 pruebas**. **Pendiente documental de calidad:** el autor no publicó salida RED auténtica del test al mutar el guard ni GREEN posterior (solo afirma una batería de tests verde); el criterio DoD de la ficha exige RED verificable. No confundir "`it` espera que una excepción sea lanzada" con una ejecución de suite en rojo cuando se elimina el control. Pedir reproducción local/runner efímero al autor con mutación temporal no pusheada.

### H11 — El test 3/1 inválido de R7 fue corregido en R8

En `queries.test.ts`, ahora el positivo de listado **instancia 3 filas distintas** `drop-1/2/3`, exige `dropsCount=3` y `drops.length=3`; otra prueba **llama realmente al historial** de un request `delivered` y exige 3 drops. También se añadieron negativos 3/1 y 3/0. Queda eliminada la incoherencia objetiva (antes: 3 declaradas, una preparada, una esperada). **No se atribuye mala fe** por el defecto anterior. Pruebas efectivamente ejecutadas en job unit verde.

### H12 — Privacidad del JSON HTTP crudo corregida en fuente y unidad

`e2e/specs/multi-drop.spec.ts:195–245` inspecciona `rawItem` **ANTES** de `liveFeedResponseSchema.parse(rawLiveFeed)` y exige status 200, presencia de request, ausencia recursiva de claves sensibles y valores centinela, 3 drops tipados públicos, y actor foráneo `P0001 UNAUTHORIZED_ACTOR` post-match. Nuevo helper server-only `src/server/live/privacy-checker.ts`: `FORBIDDEN_PRIVATE_KEYS` y recorrido recursivo de JSON crudo; `privacy-checker.test.ts` inyecta `recipientPhone`, `notes`, `cash_change_amount` top-level y claves privadas anidadas en `drops[]`; comprueba que Zod habría eliminado esas claves del objeto parseado pero el detector crudo **lanza excepción**, y que JSON legítimo pasa. **Es un test adversarial verde que espera error**, no un registro de ejecución Vitest realmente roja bajo un mutante; no se inventa esa evidencia.

**Nota:** el helper genera detalles de valores en mensajes de excepción. Se usa como oráculo de testing y recibe valores sintéticos; no introducirlo como logger de payloads reales de usuarios ni enviar PII a logs/Discord. No se detectó una fuga real de datos en la respuesta HTTP por esta inspección; se corrigió el agujero del TEST.

### H09 — Único gate funcional que debe comprobarse después de migración

E2E `e2e/specs/multi-drop.spec.ts` está preparado con fixture temporal 3 drops, tres zonas, JSON crudo, autorización real de repartidor aceptado y denegación de tercero, WhatsApp/lectores de usuario; **no hay run Playwright real** del código integrado. GitHub status del SHA de Asako: `e2e-preview=error, BLOCKED / REQUIRES DEVELOP MIGRATION`, run https://github.com/cadeApp/cadeApp/actions/runs/38311311091. Por decisión A no bloquear el futuro merge **exclusivamente** por ausencia de este run pre-migración cuando todos los controles anteriores estén cerrados, pero tampoco declararlo verde ni iniciar Paso 3/Kira. **No** ejecutar `db push` manual ni reconfigurar pipelines.

### Estado acumulado y límite independiente

| IDs | R8 |
|---|---|
| H01/H02/H03/H04/H05/H07/H08/H10 | **arreglado-verificado** en rondas anteriores, sin regresiones observadas |
| H06 | **arreglado-sin-verificar**: código corregido + `unit` PASS, falta mutación RED independiente/documentada |
| H11 | **arreglado-verificado**: fixture 3/3 corregido, historial llamado realmente, `unit` PASS |
| H12 | **arreglado-sin-verificar**: JSON crudo verificado en fuente + unit PASS, falta mutación de control RED reproducida |
| H09 | **parcial / checkpoint postmerge pendiente**; opción A cierra decisión, NO test E2E |

**No se abre un hallazgo de producto por la falta de RED, pero se preserva como gate documental premerge exigido por la ficha**. Si el autor no puede reproducir RED de H06/H12 sobre controles nuevos, habrá nuevo hallazgo P08 con reproducciones exactas; por ahora no falsear la verificación. Para cerrar H06/H12 bastan evidencias RED→GREEN trazables (sin nuevos cambios de producción si no hay fallo).

## CI realmente observada para SHA auditado

- Run GitHub Actions https://github.com/cadeApp/cadeApp/actions/runs/38311146700: `CI success` sobre SHA `c50f5dfa`.
- `unit` job https://github.com/cadeApp/cadeApp/actions/jobs/115016906924: 129 suites Vitest, **2116 tests PASS**; `rpc-fake.ts` 95,32 % statements y 91,35 % branches (umbral 90). Workflows y tests ADR PASS.
- `db-tests` job https://github.com/cadeApp/cadeApp/actions/jobs/115016907262: **21 suites, 1995 tests, Result PASS**, pruebas H15 RED→GREEN en runner efímero (esto **NO** reemplaza RED faltante de H06/H12).
- Typecheck, lint, build, audit, bundle-budget, Vercel PASS; `approval-policy` FAIL; `e2e-preview` BLOCKED por migration.
- Revisor: inspección GitHub exact SHA y logs CI; **no** ejecutó Git clone (host no resolvible desde contenedor), Docker, Supabase local/remoto, Playwright ni mutaciones runtime propias. No reclamar checks locales o analyzer `analizar.mjs` como ejecutados.

## Informe revisar-pr

Informe revisar-pr — T-340 Paso 2/4 — PR #318 — 2026-10-12 — ronda 8.

**Resultado: CÓDIGO REPARADO, CON GATE DE EVIDENCIA PREMERGE Y E2E POSTMIGRACIÓN PENDIENTES.** Ninguna decisión nueva: Lautaro073 eligió R8 **A**, merge controlado solo tras revisión sin defectos, pruebas técnicas verdes, evidencia adversarial y autorización expresa. E2E postmerge es obligatorio. **Sin aprobación ni merge, PR sigue Draft.**

**Acción de Asako:** aportar RED→GREEN auténtico H06/H12 con comando, output, mutante y SHA base, sin tocar migración/workflows/contratos, registrar `docs/tasks/log/T-340.md`, pedir ronda 9; conservar los 2116 unit/1995 DB verdes. **Acción del usuario por ahora:** ninguna más. Cuando cierre la evidencia, se pedirá autorización explícita para merge y se ejecutará posteriormente el checkpoint E2E con PR temporal. **No empezar Paso 3 de Kira.**
