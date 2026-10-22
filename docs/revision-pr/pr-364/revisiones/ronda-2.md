# Revisión independiente — PR #364 / CC-025 — Ronda 2

Fecha: 2026-10-15. HEAD auditado: 6e06e8ae7ade883d974644344f3597dcb526e2c2. Base actual develop: b5b9bf036c4c863c334948065a8780f76a88f758. PR: https://github.com/cadeApp/cadeApp/pull/364

## Dictamen: CON BLOQUEANTES. NO MERGEAR

La implementación de agy sí cambió desde la ronda 1. Dos nuevos hallazgos: PR364-R01 (alto, primera carga incompatible con privilegios de base) y PR364-R02 (medio, falsificación del campo de idempotencia al insertar). De H01–H07: cuatro corregidos por inspección y CI, tres parciales. Ninguno está marcado arreglado-verificado porque no ejecuté pruebas de mutación funcionales independientes. No hay decisiones de producto por consultar; siguen 1C, 2C, 3B, 4C y B (retención de 30 días desde reemplazo).

## CI exacto

GitHub Actions run https://github.com/cadeApp/cadeApp/actions/runs/38692082266 del SHA 6e06e8ae7ade883d974644344f3597dcb526e2c2: unit **133 archivos y 2228 tests PASS**, db-tests **Files=23, Tests=2245, Result=PASS**. Typecheck, lint, build, audit y bundle-budget SUCCESS. Migración cc025 aplicada en CI; tipos regenerados. Esos verdes no prueban el comportamiento de UPSERT sin UPDATE, dos conexiones concurrentes ni migración con duplicados preexistentes. Los RED/GREEN presentes en el job db-tests pertenecen a T-340/CC-024, no a CC-025.

## Seguimiento de H01–H07

- **H01 — arreglado-sin-verificar.** SQL ahora comprueba objeto Storage exacto y siempre (líneas 233–240). pgTAP contempla bucket vacío y ajeno. Falta RED mutando la condición en SQL real.
- **H02 — parcial.** Orden de lock courier->document uniforme en RPC courier (171–210) y admin (360–380). Falta control simultáneo en dos sesiones con ausencia de SQLSTATE 40P01 y una única versión vigente; pgTAP actual es una transacción.
- **H03 — arreglado-sin-verificar.** SQL revoca UPDATE y DELETE a autenticados (63) y elimina política admin FOR ALL (66); pgTAP prueba denegaciones. Ese arreglo introduce R01 por el writer existente.
- **H04 — arreglado-sin-verificar.** SELECT propio filtra is_current (74–82), pgTAP dueño/ajeno/admin PASS. Falta mutación independiente.
- **H05 — parcial.** Action hace SELECT antes de UPSERT, sin resolver requisito UPDATE ni carrera de dos peticiones. R01 confirma regresión del contrato por inspección.
- **H06 — parcial.** SQL backfill usa now()+interval '30 days', conforme decisión B. Pero pgTAP agrega una fila antigua después de migrar y ejecuta a mano otra copia del UPDATE de backfill; mutar SQL original a uploaded_at+30 no pondría esa prueba roja.
- **H07 — arreglado-sin-verificar.** SQL y fake conservan key, índice, replay posverified; pgTAP PASS. Falta mutación independiente y resolver nueva vía INSERT R02.

## PR364-R01 — ALTO — primera inserción documental puede fallar

- Migración: supabase/migrations/20261015020000_cc025_courier_document_replacement.sql línea 63: REVOKE UPDATE para authenticated.
- App: src/features/courier-onboarding/actions.ts, tramo 180–220: crea cliente de sesión, comprueba documentos y sigue usando queryBuilder.upsert(documentEntriesToInsert as never) sin ignoreDuplicates.
- Supabase/PostgREST resuelve UPSERT normal con ON CONFLICT DO UPDATE. PostgreSQL exige UPDATE privilege aunque todavía no exista conflicto. Fuentes: https://www.postgresql.org/docs/current/sql-insert.html, https://supabase.com/docs/reference/javascript/upsert y https://postgrest.org/en/v12/references/api/tables_views.html.
- Es un defecto contractual comprobado por documentación técnica y fuente del repo; **no se ejecutó la solicitud real sobre DB**. La prueba pgTAP inicial usa INSERT plano, no UPSERT. El mock unitario de upsert siempre retorna éxito. Este fallo **no lo advertí en ronda 1**.
- **Arreglo exigido:** mantener REVOKE y sustituir la escritura por INSERT que solo cree kinds inexistentes; para carrera (dos submits simultáneos), ante 23505 releer las filas vigentes y considerar idempotente solo si TODOS los storage_path coinciden; ante diferencia rechazar. Preservar aprobados/rechazados y no añadir service-role ni devolver éxito prematuro.
- **Pruebas exactas:** pgTAP con actor authenticated: INSERT ... ON CONFLICT (id) DO UPDATE ... sobre ID nuevo debe recibir 42501; INSERT simple autorizado sobre kind nuevo funciona; test de action asevera insert y prohíbe upsert; carrera entre dos requests con mismo payload converge a un current con error 23505 reconciliado; si paths distintos, rechaza. Mutación del writer insert→upsert causa RED con las mismas aserciones.

## PR364-R02 — MEDIO — INSERT inicial puede reservar una idempotency_key

- Policy courier_documents_insert_self (SQL 84–102) exige owner, submitted, current, rejection_code null, pero **no idempotency_key null**. El courier puede enviar su propia UUID en INSERT. Luego la RPC encuentra esa key/path y devuelve idempotent=true antes de comprobar que el previo fue rejected, aunque ningún reemplazo ocurrió.
- **Arreglo:** exigir AND idempotency_key IS NULL en policy autenticada de alta inicial; la RPC SECURITY DEFINER conserva permiso para asignar la key legítima. Tests pgTAP con INSERT directo clave UUID debe denegar por RLS, INSERT sin clave permitido, RPC posterior legitima sigue funcionando. Mutación quitando guard -> RED.

## Evidencia que todavía falta

- H02: prueba real de concurrencia en dos sesiones del mismo courier/documento; la justificación SQL es razonable, pero no hubo carrera medida en CC-025.
- H06: test que aplique **la migración real** a duplicados preexistentes; el test de post-migración que copia a mano el UPDATE no valida el archivo.
- H01/H03/H04/H07: cada prueba nueva sensible a mutación independiente real RED y GREEN; no basta las del autor ni las de otros CC.
- Rama ahead 9/behind 2 respecto de develop; GitHub indica mergeable=false. Necesita merge de develop sin rebase y revisión de conflictos/CI SHA nuevo.

## Alcance y prohibiciones

Ronda 2 no modifica código. No aflojar privilegios para que vuelva a funcionar upsert; no alterar mocks/tests, no inventar mutaciones o resultados. No modificar docs/revision-pr por parte del autor. E2E T-356 queda para fase funcional. No aprobar ni mergear. El prompt detallado de implementación se entrega en [prompt-agy-ronda-2.md](../prompt-agy-ronda-2.md) y en el mismo comentario de GitHub.