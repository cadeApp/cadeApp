# Ronda 2 — PR #711 · T-434 / CC-050 · SEC-09

**Revisión independiente:** 2026-11-12. **SHA inspeccionado:** `27dd41437b7910797d19d7eca3e6864e5e95936c` (bitácora). **Código ejecutado en CI:** `0eef5a0f10c2bfd9b2fe9e44deb2efc812e928f3`. **Base:** `develop@c41129d321ccdcd1cd4ab8664d942af63c82d402`. **R1:** `0d6ee1fc`. **Resultado: CON BLOQUEANTES (2), nuevos H06 y H07.**

## Informe revisar-pr

~~~text
Informe revisar-pr — T-434 — 2026-11-12 — generado por revisión independiente
Resultado: CON BLOQUEANTES (2)
Checks locales: typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db no ejecutado localmente
Evidencia CI del autor cotejada: 0eef5a0f, run 43214418100: lint ✅, unit 209 archivos/3951 tests ✅, db-tests 47 archivos/3950 pgTAP ✅ (cc050 92), typecheck ✅, build ✅, audit ✅, bundle-budget ✅, tipos generados sin diff. No equivale a ejecución local independiente.
BLOQUEANTES:
- [src/features/admin/components/dispute-candidates.tsx:34-55,75-80,97-100] H06 ALTO: cambiar teléfono o DNI no invalida resultados previos, y una petición anterior puede sobrescribir la búsqueda vigente → invalidar AMBOS resultados al editar y descartar respuestas asincrónicas obsoletas mediante contador de versión por búsqueda; probar cambio en pantalla y resolución tardía.
- [supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql:219-225; src/domain/testing/rpc-fake.ts:3497-3518; supabase/tests/cc034_admin_reinstate_courier.sql:102-105,319-327] H07 ALTO: admin_reinstate_courier todavía aprueba un rejected/suspended sin enviar si tiene vehículo y el DNI es null; un test existente considera este caso éxito → exigir application_submitted antes de cualquier reactivación, preservar 0 updates/audits en rechazo y corregir fixtures positivas para que representen un alta enviada.
MEJORAS:
- Ninguna nueva bloqueante; H05 de R1 corregida en código/fake, sin reejecución funcional independiente.
No revisado / dudas para Lautaro073:
- No hay decisiones de producto abiertas. H06 y H07 son correcciones de seguridad/correctitud del flujo aprobado.
- H01, H02, H03 y H05: corregidos por inspección en 0eef5a0f y con GREEN del autor; estados estructurados arreglado-sin-verificar (sin test DB/Vitest propio sobre ese SHA).
- Los 6/6 mutantes SQL tienen jobs db-tests rojos contrastados en GitHub; las 5 mutaciones TS sólo figuran en bitácora local, no repetidas por el revisor.
- Aceptada como prueba de regresión pertinente la ampliación declarada de supabase/tests/rpc_admin.sql en ficha/CC/plan de la PR; no se alteraron ni quitaron sus 111 aserciones. La ficha leída desde develop no incluye aún este archivo: dejar constancia de la diferencia hasta el merge.
- E2E Develop postmigración; merge-tree real y checks locales no ejecutados desde esta sesión (sin clon ni pnpm).
~~~

## Seguimiento R1

- **H01 — corregido en código y CI GREEN del autor; sin reproducción funcional independiente:** SQL `admin_decide_courier` con `FOR UPDATE` y `or not v_application_submitted` antes de update/audit; consulta de la columna real en el detalle, ocultamiento de Aprobar/Rechazar; fake alineado. `cc050` aserciones 75-80 y caso enviado positivo. El test `rpc_admin.sql` ahora marca enviados sus pendientes con contexto del dueño de `finalize`: 111 aserciones de la suite original siguen en CI.
- **H02 — corregido en código y CI GREEN del autor:** página sin `searchParams.q`; dos formularios `method="post"`, preventDefault y llamadas a Server Actions con sesión; entradas sensibles fuera de la URL. Sigue abierta **otra propiedad distinta**, H06, sobre coherencia temporal de los resultados.
- **H03 — implementado en código y CI GREEN del autor:** `admin_find_courier_dni_reservation(text)` con `assert_admin_aal2()`, HMAC de 64 hex, filtro por hash, objeto estricto con cuenta/estado o null, log `courier_dni_reservation_searched` con actor/booleano, sin hash; secreta normalización compartida con el alta. No libera de forma automática. La acción comprueba aal2 antes de usar `DNI_HMAC_SECRET`.
- **H05 — corregido en código y CI GREEN del autor:** fake usa `hasAnyDocument` sin `isCurrent` para elegibilidad; contador sólo vigentes. Fixture de sólo históricos. Mutación del autor deja rojo ese caso.
- **H04 — retirado en R1** (commit del revisor `f9741d34`), sin revert ni atribución al agy.

**Alcance:** comparación `661991e2..27dd4143`: 2 commits (implementación + bitácora), 28 paths. No se tocaron los cinco entregables del revisor desde R1 (SHA blob idéntico). La inclusión adicional de `supabase/tests/rpc_admin.sql` está declarada en ficha de rama, CC-050 y plan; no se han borrado aserciones. La ficha publicada en `develop` todavía no lo autoriza literalmente: diferencia registrada, no se usa la bitácora para ocultarla. Si se requiere autorización formal previa al merge, lo decide el responsable; el archivo es una suite de regresión necesaria para los cambios de la RPC.

## H06 — NUEVO BLOQUEANTE ALTO: resultados de disputa obsoletos

**Hechos comprobados por lectura de SHA:** `src/features/admin/components/dispute-candidates.tsx` almacena `lookup` y `dni` por separado (34-37); `onChange` en 77-80 y 97-100 sólo cambia el texto, sin invalidar `candidates`/`reservation`. `onSearch*` guarda el resultado del `await` directamente (41-55), sin comprobar si el dato o caso sigue siendo el mismo. Los links quedan en 117-167.

**Caso concreto (sin asumir una fuga externa):** el admin busca el DNI A y ve la cuenta A; cambia el campo a DNI B. Aunque todavía no consultó B, permanece el link a la cuenta A, al lado del formulario B. Si el request A termina después de escribir B, vuelve a pintar la cuenta A. Al operar la liberación humana en el detalle, puede actuar sobre el sujeto equivocado. También se pueden mezclar reclamante A con reservante B.

**Arreglo acotado y recomendado:** guardar `requestVersion`/`epoch` independiente por formulario con `useRef`, incrementarlo al editar cualquier entrada para invalidar solicitudes en vuelo, reiniciar **ambos** resultados a `idle` al cambiar cualquiera de los campos; en cada submit capturar una copia inmutable del valor y la versión de ESA búsqueda; cuando resuelve `await`, aplicar resultado solamente si sigue siendo la versión vigente. El submit del segundo formulario no debe invalidar la búsqueda válida del primero. Mantener POST/aal2/errores/loading sin eco de los datos sensibles.

**RED real a exigir en Vitest** (nuevo en `dispute-candidates.test.tsx`): luego de obtener la cuenta A, cambiar DNI a B → A desaparece de inmediato; lo mismo con teléfono. Deferred Promise para búsqueda A, cambiar el valor mientras espera, resolver A → jamás vuelve la cuenta A. Dos respuestas en orden inverso → gana sólo la más reciente; cambiar cualquiera de las entradas invalida los dos paneles para que no se mezclen casos. **Mutantes:** quitar reset tras editar y quitar chequeo de versión después del `await`; cada uno debe hacer fallar un test específico. No usar fake de red ni sleeps para dar el test por verde.

## H07 — NUEVO BLOQUEANTE ALTO: rehabilitación de cuentas sin alta enviada

**SQL y fake:** `admin_reinstate_courier` (migración lines 219-225) comprueba el vehículo, estado y `(v_application_submitted and v_dni_hmac is null)`. Por lógica booleana, si `application_submitted=false` y `dni_hmac=null`, esa última cláusula **es falsa** y deja pasar la reactivación de un `rejected/suspended` con vehículo, convirtiéndolo en `approved` y escribiendo auditoría. El fake `rpc-fake.ts:3510-3518` reproduce el hueco; la UI del detalle ofrece Reactivar/Reconsiderar por status, independientemente de `applicationSubmitted`.

**Prueba anterior que confirma el comportamiento, no sólo hipótesis:** `supabase/tests/cc034_admin_reinstate_courier.sql` inserta nuevos couriers después de CC-043 (campo `application_submitted` default false), marca `courier_rej` rejected y `vehicle_type='bike'` (102-105) **sin haber llamado a finalize ni marcado el envío**, y más tarde exige que `admin_reinstate_courier(courier_rej())` lo apruebe (319-327). Esa aserción forma parte del GREEN de `db-tests`. La existencia en producción de tales filas no fue medida; el defecto del permiso de transición sí se demuestra.

**Relación con la R1:** H01 protegió el camino `admin_decide_courier`, pero la revisión previa no enumeró el otro camino que también deja el status `approved` (`admin_reinstate_courier`). Error de cobertura de la revisión independiente anterior, no un defecto necesariamente introducido en esta ronda.

**Arreglo acotado y recomendado:** en la SQL de `admin_reinstate_courier`, para estados rechazado/suspendido, reemplazar `or (v_application_submitted and v_dni_hmac is null)` por `or not v_application_submitted or v_dni_hmac is null`, **antes de update/audit**, conservando lock, razonamiento de release y ruta idempotente ya aprobada. En el fake repetir la guarda `!courier.applicationSubmitted || !courier.hasDni` y conservar estados. En la UI ocultar Reactivar/Reconsiderar si `applicationSubmitted=false`, sin ocultar una eventual liberación de DNI de una reserva existente (esa acción es independiente).

**RED real a exigir en pgTAP:** construir una cuenta `rejected` sin alta enviada, vehículo `bike`, DNI hash `null`; admin aal2 → `INVALID_STATE_TRANSITION`, status unchanged, 0 audits de `admin_reinstate_courier`; análogo para `suspended`. Caso positivo de un rechazado *enviado y con DNI* sigue pasando. Cambiar el test histórico `cc034_admin_reinstate_courier.sql` para que su **fixture positiva** represente un envío real/histórico autorizado (`application_submitted=true`, DNI existente con el método de fixture acordado), **sin quitar sus aserciones**. Mutación efímera: eliminar sólo `or not v_application_submitted` en la guarda nueva → falla la prueba negativa.

## Verificación y límites

- Run GREEN **[43214418100](https://github.com/cadeApp/cadeApp/actions/runs/43214418100)** tiene head exacto `0eef5a0f`, resultado success, 7/7 jobs exitosos. `db-tests` reporta `Files=47, Tests=3950, Result: PASS` con `cc050 ... ok` (92). `unit` reporta `209 passed (209)` y `3951 passed (3951)`.
- Mutaciones SQL: 6/6 runs fallan en `db-tests`; se contrastó en logs la falla de aserciones de `cc050`: #727 `75,77`; #728 `82,83,85,89,91`; #729 `87`; #730 `90`; #731 `87,88,91`; #732 `92`. Ver [evidencia/comandos.md](../evidencia/comandos.md). Son pruebas del **autor**, con evidencia remota contrastada.
- Cinco mutaciones locales TS descritas en bitácora y no ejecutadas por revisión.
- Inspección estática independiente de los archivos exactos por GitHub: 8 invariantes H01-H05 PASS; 4 predicados H06/H07 RED. Siete **mutaciones in-memory** independientes sobre el detector llevan los controles antiguos de PASS a FAIL; se probó en memoria cómo detectar una guarda de H07 y limpieza de inputs de H06. Esto **no sustituye pruebas funcionales**.
- No se ejecutaron pnpm, test:db, pnpm tools, merge-tree, Docker, Supabase remoto ni E2E desde este entorno. `mergeable=true` de la API no prueba `git merge-tree --write-tree`. No se usan secretos ni entornos remotos del proyecto.
- No exigir otro CI GREEN por el commit **documental del revisor**; sí se debe verificar el SHA de **código** posterior a H06/H07.

## Prompt para el agy — copiá completo

Tarea: **T-434**, PR **#711**, rama **`feat/T-434-sec09-dni-oracle`**.

0. Hacé `git pull origin feat/T-434-sec09-dni-oracle` antes de editar; trae el commit de revisión R2. **Sin rebase, --force, amend, merge ni lanzar workflows manuales.**

**Podés tocar SOLO**:
- `src/features/admin/components/dispute-candidates.tsx` y `src/features/admin/components/dispute-candidates.test.tsx` (H06);
- `supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql`, `supabase/tests/cc050_courier_dni_hardening.sql`, `supabase/tests/cc034_admin_reinstate_courier.sql` (H07);
- `src/domain/testing/rpc-fake.ts`, `src/domain/cc034-admin-reinstate-courier.test.ts` (H07);
- `src/features/admin/components/applicant-detail-view.tsx`, `src/features/admin/components/applicant-detail-view.test.tsx` (H07);
- `docs/tasks/log/T-434.md`, sólo para el registro de cambios/pruebas. No tocar `rpc_admin.sql`: su fixture H01 ya es pertinente y GREEN.

**Prohibido**: `docs/revision-pr/**` (propiedad exclusiva del revisor); editar ficha/CC/plan o `pr-709`; crear nuevos archivos o dependencias; tests falsos/adulterados para obtener verde, borrar aserciones, marcar `.only`/`.skip`, usar sleeps, introducir secretos o PII en audit, URLs y logs; marcar hallazgos como «verificados». Los scripts auxiliares son sólo en `/tmp`.

1. **H06 — UI y concurrencia**. En `dispute-candidates.tsx` agregá dos contadores con `React.useRef(0)`: uno por formulario. Al editar cualquiera de las entradas, incrementá **ambos** contadores, establecé ambos resultados en `{kind:'idle'}` y luego actualizá el input. Al enviar un formulario, capturá `const requestId = ++...current` y la copia `const submittedValue = lookup/dni`. Después del `await find...Action({lookup/dni:submittedValue})`, hacé `if (requestId !== ...current) return;` antes de `setCandidates/setReservation`. **No** invalidez el contador del otro formulario por el mero hecho de enviarlo; deben mostrarse resultados de los dos formularios de un mismo caso hasta cambiar una entrada. Añadí tests RTL en `dispute-candidates.test.tsx`: desaparece link antiguo al editar DNI y al editar teléfono; Deferred Promise A resuelve tras cambio de campo y no revive link A; dos requests resueltos fuera de orden sólo admiten el vigente; cambiar una entrada borra ambos paneles. Demostrá RED por separado con mutantes **sin reset de resultados** y **sin guard post-await de requestId**; GREEN restaurado. No alteres POST, MFA ni texto sensible.
2. **H07 — SQL con lock**. En el `IF` de `admin_reinstate_courier` en la migración de CC-050 sustitui la condición `or (v_application_submitted and v_dni_hmac is null)` por `or not v_application_submitted or v_dni_hmac is null`, antes de `UPDATE` y auditoría. El `FOR UPDATE` y el retorno idempotente de approved siguen intactos. Fake: en `admin_reinstate_courier` hacer `if (!courier.applicationSubmitted || !courier.hasDni) return err('INVALID_STATE_TRANSITION');` (detrás de control status/vehicle). UI: para rejected/suspended **sin envío**, mostrar nota neutral y ocultar Reactivar/Reconsiderar; el botón de liberar DNI, si hay reserva, conserva su propia condición. Tests UI en `applicant-detail-view.test.tsx` para ambos estados `applicationSubmitted=false` y su contraparte enviada.
3. **H07 — pgTAP de seguridad**. Agregá en `cc050_courier_dni_hardening.sql`, tras las 92 pruebas actuales y antes de `finish()`, una fixture de cuenta ya sembrada no enviada como `c5`, con `status='rejected'`/`vehicle_type='bike'`/`dni_hmac null` por el dueño de la base (prueba de estado histórico); como admin aal2, `admin_reinstate_courier(c5,'Revisión administrativa')` debe devolver `INVALID_STATE_TRANSITION`, sin transición ni audit. Repetí para `suspended`. Mutación RED **quitando sólo** `or not v_application_submitted` (sin modificar pruebas), GREEN restaurada. `cc034_admin_reinstate_courier.sql` debe conservar todas las aserciones: su `courier_rej` positivo hoy es `application_submitted=false` por defecto. Marcá **sólo esa fixture positiva** como enviada y con un DNI HMAC de prueba usando el mismo contexto de finalize autorizado en CC-043 (como se hizo con `rpc_admin.sql`), sin introducir datos reales ni debilitar el assert; añadí negativo de cuenta rechazada sin enviar. En `cc034-admin-reinstate-courier.test.ts` agregá negativa con `applicationSubmitted:false, vehicleType:'bike',hasDni:false` y preservá la positiva con `applicationSubmitted:true,hasDni:true`.
4. **Checks**. Corré `pnpm typecheck && pnpm lint && pnpm test`, `pnpm exec vitest run tools` y `node --test .github/workflows/verify-workflows.test.mjs`. Para SQL, el runner `db-tests` de CI debe informar los tests `cc050` y `cc034`, total PASS y comparación de tipos (sin Docker/Supabase local). Capturá el resumen exacto de RED y GREEN con test id y SHA; no afirmes «RED→GREEN» sin el fallo real de cada mutante. No dispares CI nuevo sólo por la bitácora.
5. **Cierre del autor**. Actualizá la bitácora en tres apartados `hecho / pruebas / falta`, sin tocar la carpeta del revisor ni declararte «verificado». Commit con Conventional Commits + `[T-434]` y push normal; pegá `git ls-remote origin feat/T-434-sec09-dni-oracle`. Solicitá ronda 3 independiente del SHA final.

No hay decisiones nuevas de producto pendientes para H06/H07. H01/H02/H03/H05 no deben reescribirse ni «simplificarse» durante estos arreglos.
