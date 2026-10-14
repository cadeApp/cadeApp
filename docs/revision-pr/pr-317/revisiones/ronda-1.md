# Revisión independiente — PR #317 / T-340 — ronda 1

- Fecha: 2026-10-10.
- Autor: @asako669 (P2); revisión independiente de la PR por el asistente, sin aprobación ni merge.
- SHA inspeccionado: `cf69ffd6a99d65418894c57868db86d8e28822fe`. Base comparada: `develop` (SHA `7cf1a653dfa193f254d41611b47ae65930435b84`), merge-base `8ebd5e21`.
- Alcance: 6 archivos, 1801 líneas de migración y 246 líneas de pgTAP. Ficha leída de `develop`, CC-022 §10 y bitácora/comentarios consultados.
- **Resultado: CON BLOQUEANTES (5)**. Todos `abierto`. **NO MERGEAR**.

## Hallazgos

### PR317-H01 — BLOQUEANTE ALTO · Migración no aplica (`supabase/migrations/20261009200000_t340_multi_drop.sql:1755`)

El backfill consulta `public.zones where is_active`, columna inexistente: el esquema actual usa `active`. **CI real**, SHA `cf69ffd6`, job `db-tests` 114324632186: `ERROR: column "is_active" does not exist (SQLSTATE 42703)`, statement 83, `exit code 1`. La migración abortó; no alcanzó a correr pgTAP. **Arreglo:** retirar el fallback a una zona arbitraria y resolver datos legacy incompletos con política explícita de conservación/salto o error controlado (H02); no hacer únicamente un reemplazo textual `is_active→active`.

### PR317-H02 — BLOQUEANTE ALTO · Backfill inventa datos privados y consentimiento (`migration:1755-1790`)

El backfill asigna zona elegida sin relación con la solicitud, `package_type='chico'`, `recipient_payment_method='cash'`, dirección `'Sin dirección'`, nombre `'Sin nombre'`, teléfono `'+543865000000'` y consentimiento `coalesce(c.recipient_consent_declared, true)`. Un borrador legacy incompleto se convierte en destinatario y consentimiento falsos; está prohibido inventar estos datos. **Arreglo:** backfillear solo registros con datos legacy consistentes y consentimiento real; no asignar zonas ni inventar destinatarios. Conservar borradores incompletos sin drops (el puente validará al publicar), y documentar los históricos no-draft inconsistentes para tratamiento verificable. El backfill debe ser idempotente y no modificar notas/cambio legacy.

### PR317-H03 — BLOQUEANTE ALTO · Tests adulterados mediante `pass()` (`supabase/tests/t340_multi_drop.sql:220-242`)

Hay **22** `select pass('pruebas adicionales ...')` que no ejecutan ningún comportamiento del producto. La descripción en PR/bitácora declara 38 aserciones “exhaustivas” y RED→GREEN, sin evidencia de rojo real para los invariantes. Falta verificar con pruebas genuinas las carreras, los seis casos de pago/cambio, N+1, backfill, idempotencia, escritura RPC, privacidad positiva post-match y lectura legacy. **Arreglo:** eliminar TODOS los pass triviales y reemplazar por pruebas ejecutables específicas; no sustituirlos con `ok(true)`, asserts tautológicos, mocks ni ajustar `plan()` para ocultar faltantes. Para cada control nuevo, probar mutación propia RED→GREEN y conservar evidencia. Este es el patrón P04/P08 que la revisión debe frenar.

### PR317-H04 — BLOQUEANTE ALTO · Fixtures y conteo pgTAP no ejecutables (`supabase/tests/t340_multi_drop.sql:4,52-60,74-182,218`)

`plan(38)` contra **39** invocaciones de aserción contadas por la revisión (incluye 22 `pass()`): discrepancia. El seed hace `insert into public.zones (id,name,code,is_active,polygon)`, aunque `zones` realmente tiene `name, centroid_lat, centroid_lng, active`; las tablas `delivery_requests` de las fixtures omiten `pickup_zone_id` obligatorio. El supuesto test del helper no cambia al rol `authenticated` inmediatamente antes de invocarlo (se ejecuta desde la conexión del suite, inicialmente `postgres`), así que no verifica su denegación a clientes. **Arreglo:** seeds válidos para esquema real, pickup zone y filas vinculadas obligatorias, sets de actor correctos por caso, plan exacto al final y casos exitosos que demuestren el camino positivo. Validar `db-tests` en CI después de corregir H01: esta suite todavía no se ejecutó en el job fallido.

### PR317-H05 — BLOQUEANTE MEDIO · Lector adelantado fuera del paso 1 (`migration:1557-1735`)

La migración redefine `public.get_trip_details` para leer `drop_contacts` como parte declarada del “paso 2”, aunque la decisión A publicada en la ficha y CC-022 exige **4 PR separadas**: paso 1 solo esquema/puente/backfill; paso 2 todos los lectores con despliegue posterior. Además el cuerpo asegura expresamente que no modifica lectores. **Arreglo:** sacar esta redefinición de la migración del paso 1 y llevarla a la PR de lectores; el `get_trip_details` actual debe seguir devolviendo `deliveryNotes` y `cashChangeAmount` desde las columnas legacy que NO se borran en este paso.

## Cobertura y CI

- `db-tests`: ❌ falló **durante migración**, antes de pgTAP. Resultado real, no deducción.
- `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: ✅ éxito asociado al SHA revisado, sin demostrar comportamiento DB.
- `approval-policy`: ❌ fallo, no confundir con revisión técnica.
- `e2e-preview`: estado externo `error` asociado al workflow; no hay E2E de T-340 sobre migración aplicada comprobado.
- **Checks locales propios:** no corridos: este entorno no tiene clon montado ni acceso de red del contenedor, y se prohíbe levantar Supabase/Docker local. Revisión por lectura del SHA + logs reales de CI. No declarar `test:db` verde ni “verificado en runtime” para código que CI no alcanzó.
- No se han demostrado mutaciones RED→GREEN de forma independiente en pgTAP; se aporta en `evidencia/comandos.md` un harness de inspección reproducible y pruebas concretas exigidas al autor.

## Alcance y coordinación

- Ficha actual en `develop` y ficha modificada por autorización previa de Lautaro073 comparadas: el marcador multi-PR y la anotación documental en CC-022 son cambios autorizados por Lautaro073, no un desvío nuevo del autor.
- `src/types/database.types.ts` está dentro de permitidos; sin acusación sin evidencia independiente.
- HEAD de trabajo debe actualizarse con este commit de revisión: **`git pull`**, sin rebase/force/amend, antes de aplicar arreglos; la verificación apunta exclusivamente a `cf69ffd6`.
- **No hay decisiones de producto pendientes**: opción A ya la resolvió Lautaro073. Ni aprobación ni merge hasta ronda 2 sin bloqueantes y checkpoint tras merge.

### Informe revisar-pr (formato skill)
Informe revisar-pr — T-340 — 2026-10-10 — generado por revisión independiente  
Resultado: CON BLOQUEANTES (5)  
Checks locales: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (CI db-tests ❌)  
BLOQUEANTES: H01 migración inválida; H02 backfill inventa destinatarios/consentimiento; H03 22 pass tautológicos; H04 fixtures/plan inválidos; H05 lector prematuro.  
MEJORAS: ninguna separada; primero corregir bloqueantes.  
No revisado: ejecución SQL completa y concurrencia, no alcanzadas por CI.
