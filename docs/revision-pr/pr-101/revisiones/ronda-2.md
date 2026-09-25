# Informe de revisión — PR #101 / CC-007 — Ronda 2

**SHA revisado:** `35d139d9fe934703da539cf709a9629edc0397bc`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (6)**

## Evidencia DB independiente

Se inspeccionó el job `db-tests` del run **36183744739** (permitido para verificación Supabase aun con bloqueantes estáticos):

- aplica `20260925170000_cc007_consent_enforcement.sql`;
- `supabase/tests/cc007_consent_enforcement.sql .. ok`;
- **Files=9, Tests=1463, Result: PASS**;
- `pnpm db:types --local` genera tipos exitosamente.

Esto confirma que la suite actual pasa; no demuestra los caminos que faltan abajo.

## Hallazgos de R1 cerrados

### H01 — CERRADO
Contrato y body ya preservan D1, usan P2 `@KiraK72` y describen la frontera real `updateSession/evaluateRouteGuard`.

### H04 — CERRADO
Contrato/migración implementan `pending | active | reconsent_required`, admin exento y backfill determinista.

### H05 — CERRADO
PR #101 ya no es docs-only: incluye migración, RLS/RPC, tipos, dominio, auth server/guards y pruebas.

---

## H02 · 🔴 Bypass por `app_private.request_cycle()`

CC-007 endureció RLS y redefinió cinco RPCs, pero el ciclo principal de solicitudes sigue teniendo una autoridad `SECURITY DEFINER` sin `consent_status`.

En `20260924010124_rpc_requests_v1.sql`, `app_private.request_cycle()`:
- obtiene `auth.uid()`;
- lee únicamente `role`;
- no lee ni valida `profiles.consent_status`.

Siguen delegando directamente a ese helper:
- `cancel_request`;
- `mark_picked_up`;
- `mark_delivered`;
- `report_no_show`;
- `courier_cancel_match`;
- `republish_request`;
- `report_incident`.

Son wrappers `SECURITY DEFINER`, por lo que RLS de tablas no es sustituto del gate. `publish_request` sí fue redefinida en CC-007 con chequeo previo, pero las otras siete no.

### Arreglo
Redefinir centralmente `app_private.request_cycle()` en la migración CC-007 para leer `role, consent_status` y rechazar merchant/courier distintos de `active` con `UNAUTHORIZED_ACTOR`, preservando admin donde corresponda.

Agregar pgTAP conductual al menos para:
- acción merchant pendiente/reconsent;
- acción courier pendiente/reconsent;
- active sigue funcionando según contrato.

---

## H03 · 🔴 “service-role-only” no está demostrado de forma determinista

`activate_account_consents` ahora es `SECURITY DEFINER` y revoca `PUBLIC/anon/authenticated`, correcto.

Pero:
- la migración no hace `GRANT EXECUTE ... TO service_role` explícito;
- el test positivo resetea a superusuario y lo llama como superuser;
- no existe una aserción de privilegio/ejecución como `service_role`.

Supabase puede dar grants por defecto según configuración del proyecto, pero el contrato declara una frontera **service-role-only** y no debe depender implícitamente de defaults.

### Arreglo
- `GRANT EXECUTE ON FUNCTION public.activate_account_consents(uuid,text,text) TO service_role;`
- pgTAP: `authenticated=false`, `anon=false`, `service_role=true` mediante privilegios y/o ejecución bajo ese role.

---

## H06 · 🔴 La prueba de mutación no demuestra rojo real y la API TS sigue fail-open

`src/server/rpc/cc007.test.ts` llama “mutaciones” a reemplazos de strings y luego comprueba que una regex ya no está. No ejecuta pgTAP/unit tests sobre el código mutado; por tanto no demuestra que la protección funcional mate la regresión.

Además:
- `AuthSession.consentStatus?` es opcional;
- `evaluateRouteGuard` bloquea solo si el campo existe;
- tests históricos construyen merchant/courier sin estado y obtienen `allow`;
- `getServerSession()` sigue leyendo solo `role`;
- `loginAction()` llama `resolvePostLoginRedirect(..., role)` sin estado.

El middleware principal sí usa `updateSession` y carga el estado, así que no se marca esto como bypass DB; pero la API de auth incumple la segunda barrera D06 y queda fail-open para consumidores server-side.

### Arreglo
1. Hacer `consentStatus: ConsentStatus` obligatorio en `AuthSession`.
2. `getServerSession`: seleccionar y validar `consent_status`.
3. `loginAction`: leer `role, consent_status` y pasarlo a `resolvePostLoginRedirect`.
4. Actualizar fixtures/tests antiguos con `active` o el estado explícito.
5. Mutaciones reales: modificar temporalmente fuente/migración, ejecutar la suite correspondiente y restaurar en `finally`; cada mutación debe terminar exit != 0.

---

## H07 · 🟠 Falta visto bueno P2

GitHub mantiene a `@KiraK72` como reviewer solicitada.

La revisión independiente consultó los reviews registrados y devuelve:

```text
[]
```

Todavía no existe review/visto bueno formal de P2 y `CC-007.md` sigue con su checkbox P2 `[ ]`.

Debe obtenerse antes del merge.

---

## H08 · 🔴 `consents_insert_self` permite fabricar evidencia legal desde el cliente

CC-007 protege la **activación**, pero deja intacta la policy previa:

```sql
create policy consents_insert_self on public.consents
  for insert to authenticated
  with check (profile_id = auth.uid() and accepted_at = now());
```

Esa policy no valida `document` ni `version`. Un cliente autenticado puede insertar directamente, por SDK, filas de consentimiento con versiones arbitrarias.

Eso contradice la frontera que CC-007/T-311 están construyendo: el servidor valida las versiones vigentes y la DB conserva evidencia verificable.

### Arreglo
Eliminar/restringir `consents_insert_self` en la nueva migración. Las escrituras de `public.consents` deben pasar por una frontera server confiable que valide documento/versión. Al retomar T-311, pilot/courier consents deberán usar esa frontera y no INSERT directo con sesión de usuario.

Agregar pgTAP:
- authenticated no puede INSERT directo;
- `activate_account_consents` sí persiste los dos consentimientos desde la frontera confiable.

---

## H10 · 🟠 `implementation-plan.md` arrastra cambios ajenos/incompletos

PR #101 modifica:
- DoD de **T-300**, sin relación con CC-007;
- solo una parte de T-311, dejando todavía frases de “revisado por abogado” y `T-312: abogado OK`.

Eso mezcla sincronizaciones de otras tareas dentro del contract-change y deja el plan semánticamente inconsistente.

### Arreglo
Revertir del PR #101 el cambio de T-300 y el parche parcial de T-311. La sincronización legal completa pertenece a T-311/#98 después de CC-007. Si CC-007 necesita una referencia documental, que sea mínima y específica al bloqueo/dependencia, no una corrección parcial de otros DoD.

---

## CI final

No se inspecciona el resto del CI como criterio de aprobación mientras H02/H03/H06/H07/H08/H10 estén abiertos. El job DB sí fue inspeccionado por la excepción de verificación Supabase.

## Prompt AGY

1. `git pull` en `cc/CC-007-consent-enforcement`.
2. No toques `docs/revision-pr/**`.
3. **H02:** redefiní `app_private.request_cycle()` en la migración CC-007 para exigir `consent_status='active'` a merchant/courier; preservá admin. Cubrí merchant y courier pending/reconsent con pgTAP.
4. **H03:** agregá `GRANT EXECUTE ... TO service_role` explícito para `activate_account_consents` y test de privilegios/ejecución como service_role; anon/authenticated siguen denegados.
5. **H08:** eliminá/restringí `consents_insert_self`; ningún authenticated puede fabricar filas con versiones arbitrarias. Agregá test directo.
6. **H06:** hacé `AuthSession.consentStatus` obligatorio; propagalo en `getServerSession` y `loginAction`; actualizá fixtures. Reemplazá las pseudo-mutaciones de strings por arnés que modifique fuente/migración, ejecute tests y restaure en `finally`, dejando exit != 0 como evidencia.
7. **H10:** revertí los cambios ajenos de T-300 y el parche parcial de T-311 en `docs/implementation-plan.md`.
8. **H07:** conseguí visto bueno explícito de `@KiraK72`; no marques el checkbox antes.
9. Corré tests dirigidos + `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. DB debe quedar verde en CI; no inventes local si Docker no está.
10. Actualizá contrato/body con evidencia real y push normal.

T-311 sigue bloqueada hasta mergear CC-007.
