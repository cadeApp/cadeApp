# Ronda 1 — PR #711 — T-434 / CC-050 / SEC-09

**Fecha:** 2026-11-12. **Revisor:** revisión independiente ChatGPT. **SHA:** `0d6ee1fc4b395bd7e2a560e131700a04e1e51704`. **Base:** `develop@c41129d3`. **Código:** `6beb2104`.

## Informe revisar-pr

```text
Informe revisar-pr — T-434 — 2026-11-12 — generado por revisión independiente
Resultado: CON BLOQUEANTES (3)
Checks locales: typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db no ejecutado localmente
Evidencia CI del autor contrastada: GREEN 6beb2104 (run 43200528662), unit 3926/3926, pgTAP 3932/3932, typecheck/lint/build/tipos correctos.
BLOQUEANTES:
- [src/features/admin/components/applicant-detail-view.tsx:801; supabase/migrations/20260924013700_rpc_admin_v1.sql:61-82] H01: vista de reclamante pending sin enviar permite aprobar/rechazar y la RPC decide por status, no por application_submitted → nueva guarda SQL transaccional, sin update/audit, y ocultar botones.
- [src/features/admin/components/dispute-candidates.tsx:35-40; src/app/(admin)/admin/applicants/disputes/page.tsx:14-18] H02: teléfono completo pasa al query string vía GET → POST/Server Action, sin PII en URL ni logs.
- [docs/contracts/CC-050.md:§3b; supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql:104-165] H03: búsqueda sólo identifica reclamante; no permite determinar cuenta que reservó DNI si no se conoce → D2-B, consulta administrativa por HMAC generado server-side, aal2 y audit sin DNI/hash, sólo cuenta+estado.
MEJORAS:
- [src/domain/testing/rpc-fake.ts:3543-3546; supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql:152-155] H05: fake exige un documento vigente mientras SQL admite cualquiera → unificar con CC y probar caso sólo históricos.
No revisado / dudas para Lautaro073:
- Ninguna decisión abierta. D1-A y D2-B seleccionadas automáticamente bajo autorización permanente, no expresamente por Lautaro en esta sesión.
- E2E contra Develop requiere migración posmerge; no correr migrate-develop desde revisión.
- 3 mutaciones locales TS: declaradas por autor, sin reproducción independiente.
- merge-tree real y checks locales no ejecutados (sin clon autenticado en este entorno).
```

## Hechos y alcance

- GitHub PR head `0d6ee1fc`; `develop` base `c41129d3`. Se revisaron diff, ficha de `develop`, CC-050, bitácora T-434, migración, TS/UI, tests y logs relevantes.
- El catálogo del diff tiene 48 archivos. Los tres E2E añadidos al alcance (spec, manifest, patch) aparecen expresamente anunciados por el solicitante y registrados en ficha/CC/plan de la **rama**, aunque no figuran en el texto de la ficha original de `develop`. Esta diferencia de alcance se documenta, no se oculta. Las ampliaciones de D1-A/D2-B requieren reconciliación explícita de ficha/CC/plan por el autor.
- RED `2989aaeb` / run 43196349049: `cc050` falla por función inexistente, 41 Vitest fallidos. GREEN `6beb2104` / run 43200528662: `cc050` PASS, 47 archivos / 3932 pgTAP PASS y 208 archivos / 3926 Vitest PASS; tipos regenerados y comparados sin diff. Typecheck, lint, build, audit, budget exitosos en esa corrida.
- 15/15 jobs `db-tests` de mutaciones SQL #712–#726 terminaron en error; se cotejaron aserciones nominadas en las salidas. Dos mutaciones (UUID cast, columna c.created_at) provocan excepción SQL en vez de una aserción pgTAP: esto prueba detección del fallo, no el assertion id anunciado. 3 mutaciones TS locales reportadas por autor, no repetidas por este revisor.
- La batería **independiente** disponible aquí es inspección estática dirigida de los cuatro hallazgos; cinco predicados ausentes en el SHA y tres controles de sensibilidad sobre variantes en memoria. Ver [evidencia/comandos.md](../evidencia/comandos.md). No se llama ejecución independiente RED→GREEN de pgTAP.

## Hallazgos

### PR711-H01 — BLOQUEANTE ALTO — aprobación de alta incompleta

La RPC `admin_find_courier_dispute_candidates` devuelve `pending`, `application_submitted=false` y documentación. La nueva UI enlaza al detalle estándar; allí `applicant.status === 'pending'` habilita **Aprobar / Rechazar**. La RPC preexistente `admin_decide_courier` comprueba sólo `status=pending`, sin comprobar envío. El esquema y el trigger de CC-043 no prohíben pasar a `approved` con `application_submitted=false`.

**Decisión D1-A** (automática): solucionar en esta PR tanto SQL como UI. En la migración CC-050, reproducir el cuerpo vigente de `admin_decide_courier(uuid,text,text)` conservando permisos, actor aal2, motivo y audit, seleccionar `status, application_submitted` con `FOR UPDATE`, rechazar cualquier `pending` no enviado mediante `INVALID_STATE_TRANSITION` **antes del UPDATE y audit**, para aprobar Y rechazar. Mostrar acciones de aprobación/rechazo sólo cuando `applicant.applicationSubmitted === true`, leído desde la columna real. No usar `submittedAt != null` como único proxy (históricos sin fecha). Actualizar el fake y tests pertinentes.

**Test/RED exigido:** sembrar un pendiente sin enviar, con documentos, y llamar directamente a la RPC como admin aal2 con decisión approved y rejected: ambos deben retornar `INVALID_STATE_TRANSITION`; comprobar status sin cambios y 0 audits. Remover únicamente la guarda `not v_application_submitted` en mutación efímera: la prueba debe fallar. Caso positivo de un pending enviado preservado.

### PR711-H02 — BLOQUEANTE ALTO — teléfono en URL de búsqueda

`DisputeCandidates` envía GET con `name=q` y la página procesa `searchParams`. Esto coloca un teléfono completo en URL/historial, aun cuando la lista devuelve teléfono enmascarado. No se afirma que existan logs concretos con PII sin inspeccionar la infraestructura.

**Corrección acordada:** dos formularios privados en la misma pantalla, búsqueda de reclamante (UUID o teléfono) y búsqueda de reserva (DNI), con **POST/Server Actions**, estado local y sin `?q=` ni log de DNI, teléfono o HMAC. La página ya no deriva la búsqueda sensible de `searchParams`. Mantener validaciones, alerta de error y loading; no imprimir el valor en texto de resultado, HTML de enlace ni redirección.

**Test/RED:** probar que ambos formularios no usan GET y que sus acciones reciben los datos por POST; mutar la búsqueda otra vez a GET/`?q=` y exigir fallo. Test E2E de URL limpia cuando el ambiente Develop esté migrado; no convertir indisponibilidad de ese ambiente en CI verde falso.

### PR711-H03 — BLOQUEANTE ALTO — falta resolver quién reservó el DNI

CC-050 §3b sólo contempla la búsqueda del **reclamante** por UUID/teléfono. No hay una vía fiable de hallar la cuenta del reservante usando el DNI acreditado por soporte. Es un vacío **de la especificación aprobada**, expuesto por el flujo nuevo, no un permiso para mostrar hashes a la UI.

**Decisión D2-B** (automática): formulario privado con DNI verificado; Server Action exige admin aal2, valida DNI con el mismo formato del onboarding, normaliza y calcula HMAC-SHA256 con `DNI_HMAC_SECRET` **en servidor**. RPC `admin_find_courier_dni_reservation(p_dni_hmac text)`, `SECURITY DEFINER` + `set search_path=public, pg_temp` + `assert_admin_aal2()` + REVOKE a public/anon y GRANT sólo a authenticated, devuelve `{ reservation: { courierId, status } | null }`; nunca el DNI, hash, teléfono, paths o URL. Audit por búsqueda (también sin coincidencia) únicamente con actor, resultado encontrado/no encontrado y referencia segura; no incluir el HMAC en `before/after/target_id`. Liberación separada, nunca automática, con verificación humana, motivo y auditoría existentes. Mantener UI con error/estado vacío y enlace al detalle seguro.

**Test/RED:** PostgreSQL: admin aal2 encuentra una reserva sembrada; admin aal1 y courier la rechazan; anon sin execute; no encontrada devuelve `null` y se audita sin hash. Verificar estrictamente claves JSON de salida y columnas `audit_log`, sin HMAC/DNI. Mutaciones independientes: quitar aal2, filtrar mal el hash, agregar hash a salida/audit o permitir auto-release; cada una debe ser detectada por un control específico. Extender contrato, fake, wrapper, tests, tipos y ficha; no agregar dependencia.

### PR711-H05 — MEJORA MEDIO — fake diverge del predicado SQL

La SQL usa `exists courier_documents` sin filtro de `is_current`. El fake usa `documentsOf() > 0`, con `documentsOf` filtrando `doc.isCurrent`. Una cuenta con **sólo documentos históricos** es elegible en SQL y no en el fake. El conteo de salida puede seguir siendo cero por contar documentos vigentes; no es contradictorio si se explicita.

**Corrección acordada:** conservar la elegibilidad de CC-050 (al menos un documento histórico o vigente), cambiar el predicado del fake para que coincida y agregar prueba con documentos exclusivamente históricos, `candidates` con ese courier y `documentsCount=0`. Mutación que reintroduce `doc.isCurrent` en el filtro de elegibilidad debe poner esa prueba en rojo. No cambiar el SQL ni el CC por conveniencia del mock.

### H04 — RETIRADO (rectificación)

La edición de los cinco archivos de `docs/revision-pr/pr-709/` procede de `f9741d34` (autor Git Lautaro Emanuel Jimenez, mensaje «precisar conteo de 19 columnas en R4») y se incorpora en `5baba42f`. No se pide revert; no se cuenta entre los bloqueantes ni en el JSONL.

## Decisiones y atribución

- **D1-A:** guarda `admin_decide_courier` y UI en esta PR.
- **D2-B:** resolución segura del reservante con DNI en POST, HMAC sólo servidor y RPC aal2.
- Ambas: **selecciones automáticas de opciones recomendadas bajo autorización permanente**, no fueron decisiones expresas del usuario aquí.
- H02 y H05: el usuario confirma que se aplicarán. No quedan preguntas abiertas.

## Para el agy — prompt exacto de corrección

**Tarea:** T-434, PR #711, rama `feat/T-434-sec09-dni-oracle`.

**0.** `git pull origin feat/T-434-sec09-dni-oracle` (trae el commit de R1). No rebase, amend, force push, merge ni cambios remotos de infraestructura.

**Archivos habilitados sólo para estas correcciones** (aparte de su bitácora):
- `supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql`; `supabase/tests/cc050_courier_dni_hardening.sql`.
- `src/domain/rpc-contracts.ts`, `src/domain/testing/rpc-fake.ts`, `src/domain/cc050-courier-dni-hardening.test.ts`; `src/types/database.types.ts`.
- `src/server/rpc/admin-applicants.ts` y `src/server/rpc/admin-applicants.test.ts`; `src/server/rpc/admin.ts` y `src/server/rpc/admin.test.ts` sólo si la guarda de decisión exige wrapper/test.
- `src/features/admin/{actions,actions.test,copy,queries,queries.test,schemas,types}.ts`.
- `src/features/admin/components/{applicant-detail-view,applicant-detail-view.test,dispute-candidates,dispute-candidates.test}.tsx`.
- `src/app/(admin)/admin/applicants/disputes/{page,page.test}.tsx`.
- `src/features/courier-onboarding/actions.ts` (sólo extraer HMAC común sin alterar flujo).
- `src/server/dni-hmac.ts` y `src/server/dni-hmac.test.ts` (**nuevos, autorizados sólo para compartir HMAC sin duplicarlo**, registrar en ficha/CC/plan).
- `docs/contracts/CC-050.md`, `docs/tasks/T-434.md` y `docs/implementation-plan.md` (**excepción expresa: ampliar sólo D1-A y D2-B y reconciliar impacto**).
- `docs/tasks/log/T-434.md` (bitácora del autor).

**Prohibido:** `docs/revision-pr/**`, editar `pr-709/`, añadir dependencias, secretos, tests falsos/adulterados, quitar aserciones o usar `.only`, `.skip` y sleeps; crear otros archivos, cambiar flows no nombrados o tocar Supabase remoto. No afirmar «verificado por revisor».

**Pasos exactos:**

1. **H01**: en la misma migración `cc050` sustituí `admin_decide_courier(uuid,text,text)` con cuerpo completo vigente y una guarda transaccional: `SELECT status, application_submitted ... FOR UPDATE`; `IF status <> 'pending' OR NOT application_submitted THEN RAISE EXCEPTION 'INVALID_STATE_TRANSITION'; END IF;` antes de UPDATE/audit, conservando auth+aal2, validación, permisos, efectos y salida de la RPC. En `getApplicantDetail` seleccioná `application_submitted` y mapeá a `ApplicantDetail.applicationSubmitted: boolean`; UI muestra Aprobar/Rechazar sólo si `pending && applicationSubmitted`. Ajustá fixtures y fake. En `cc050` test pgTAP: pending sin envío, con documentos, para approved/rejected → error, sin update ni audit; pending enviado aprobado conserva camino. Mutación RED real: quitar únicamente `OR NOT application_submitted`; documentá pruebas rojas y verdes.
2. **H02**: convertí `dispute-candidates.tsx` en componente cliente con estado local y `onSubmit` que invoque Server Action POST autenticada; eliminá `method="get"` y el tratamiento de `searchParams.q` de `page.tsx`. Añadí action `findDisputeCandidatesAction` en `features/admin/actions.ts` (o nombre equivalente descriptivo), con `requireAdminAal2` y validación de `adminFindCourierDisputeCandidatesInputSchema`, delegando al wrapper RPC con cliente de sesión, no service role. Mantené muestra de resultados sin imprimir lookup. Test con mocks `vi.mock` de acciones; comprobar llamada, pending, errores, éxito, que no se genera URL `?q=` ni método GET; mutación temporal a GET debe fallar.
3. **H03**: agregá `admin_find_courier_dni_reservation(p_dni_hmac text)` en la migración, verificación del argumento regex `^[0-9a-f]{64}$`, `assert_admin_aal2()`, `FOR?` no hace falta lock para consulta sólo lectura, `SECURITY DEFINER` con search_path fijo, REVOKE/GRANT explícitos. Buscar la fila `couriers.dni_hmac = p_dni_hmac`, devolver exclusivamente objeto con `reservation: {courierId,status} | null`; guardar en `audit_log` acción `courier_dni_reservation_searched` con `actor_id` y resultado booleano, ningún hash ni DNI en ningún campo ni errores. Si no hay resultado audit también; no devolver candidatos masivos ni filtrar por nombre. En `src/server/dni-hmac.ts` extraé la normalización y HMAC que ya hace `courier-onboarding/actions.ts` y reutilizá la misma función, conservando secreto sólo en servidor. En action admin validar `dniSchema` del onboarding (si importarlo genera ciclo, usar mismo esquema compartido sin duplicar validación) y `requireAdminAal2` **antes** de generar HMAC; usar `serverEnv.DNI_HMAC_SECRET`, sin imprimir el valor. Añadí RPC_CONTRACTS, database.types.ts, wrapper/fake+tests (semilla optativa `dniHmac`), caso hallado/no hallado/aal1/courier/anon/forma JSON/audit sin PII. Formulario DNI privado POST en misma pantalla, sin eco del documento y con enlace a detalle del reservante, pero liberación exige siempre acción humana separada. Mutaciones: quitar rol/aal2, devolver o auditar hash, quitar filtro de hash, activar liberación automática; comprobar RED por test específico y GREEN tras revertir mutación.
4. **H05**: el fake debe filtrar por `exists documents.courierId === c.courierId` **sin** `isCurrent` para elegibilidad. El contador `documentsCount` mantiene sólo vigentes como SQL. Sembrar sólo docs históricas y afirmar candidato incluido con contador 0; mutar el predicado añadiendo `&& doc.isCurrent` y capturar RED/ GREEN. No alterar la SQL para satisfacer el mock.
5. **Contratos y pruebas**: actualizar CC-050 y ficha T-434 únicamente para esas decisiones autorizadas, sus archivos y DoD; igual en plan, y anotar fecha/atribución automatizada correcta en bitácora. Sin inventar cobertura. Ejecutar `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm exec vitest run tools`, `node --test .github/workflows/verify-workflows.test.mjs`; `test:db` en CI local del runner como en PR, con salida pegada de `cc050` y comparación `db:types`. E2E de Develop se ejecuta sólo tras migración postmerge; no simular resultado. Registrar SHA, número de prueba, mutación, fragmento rojo y resumen GREEN por cada hallazgo.
6. **Final**: bitácora `hecho / pruebas / falta` sin marcar hallazgos «verificados», commit Conventional Commit con `[T-434]`, push normal, pegar `git ls-remote origin feat/T-434-sec09-dni-oracle`. No correr CI manualmente ni pedir nuevo GREEN sólo por cambios de bitácora. Pedir revisión independiente R2.

No se requieren decisiones nuevas ni modificación de `docs/revision-pr/pr-709/`.
