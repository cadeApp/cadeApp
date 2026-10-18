# Ronda 1 — PR #410 / T-355 — 2026-10-18

**Informe revisar-pr — T-355 — 2026-10-18 — revisión independiente**  
**Resultado: CON BLOQUEANTES (6)**  
**SHA revisado:** `dfdee176761e6f580d0e56481595c8ce6a68f090`; **base:** `15c68d9ad57fdb6084483d0ba2702c09391aad7c`.

## Aciertos verificados por inspección

- `updateCourierPhoneAction` usa sesión Supabase, comprueba rol courier, Zod `.strict()`, payload `{phone}` y filtro `id=user.id` (sin service-role).
- La UI muestra nombre/email/legajo como lectura, precarga y edita teléfono; hay pruebas UI/action y un test E2E nuevo.
- La ficha en la PR solo tilda DoD, sin ampliar el alcance. Los once archivos están dentro de los globs permitidos.

## Bloqueantes

**PR410-H01 — ALTO — `src/features/courier-onboarding/actions.ts:528-531`.** `console.error('Error al actualizar teléfono de perfil:', updateError.message)` envía a logs un mensaje de PostgREST no controlado. No puede garantizar que esté libre del número de teléfono; el test actual usa un mensaje inocuo. Arreglo: log genérico/código sin datos personales; test con `error.message` que contenga el teléfono enviado, RED en implementación actual, GREEN después. *Riesgo por inspección, no fuga observada en runtime.*

**PR410-H02 — DECISIÓN B ADOPTADA, IMPLEMENTACIÓN PENDIENTE — `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:164-174`.** La RLS actual de `public.profiles` congela `role` y `consent_status`, pero permite al courier activo modificar su propio `display_name` por el cliente autenticado, sin pasar por Server Action. **Lautaro073 elige opción B**: congelar `display_name` para courier en RLS, conservando operaciones legítimas de merchant/admin. Se abrió [issue #412](https://github.com/cadeApp/cadeApp/issues/412) para **CC separado**, con pgTAP. No modificar SQL en PR #410. *Hecho contractual preexistente identificado por lectura de SQL; falta comprobar con pgTAP real.*

**PR410-H03 — ALTO — `src/features/courier-onboarding/actions.test.ts` (caso «inyectar campos ajenos»).** El test afirma `VALIDATION_ERROR` y `mockFrom` nunca en `couriers`, pero NO afirma `profiles.update` cero veces. Una escritura indebida previa al rechazo quedaría sin cobertura. Arreglo: spy/mock sobre `profiles.update`; `not.toHaveBeenCalled()` por cada input con extra. Mutación RED independiente: agregar una escritura indebida antes de devolver el error y demostrar fallo del test nuevo.

**PR410-H05 — ALTO — `docs/tasks/T-355.md` (DoD).** E2E y RED→GREEN figuran `[x]` pese a bitácora sin ejecución E2E con run/SHA ni evidencia reproducible de mutaciones. Despliegue Vercel del SHA `dpl_9nZh7PngG7tgui1gyPcqkyJB75wU` falla al procesar `next/font/google` Montserrat en `src/app/layout.tsx` (`TypeError: Cannot read properties of null (reading '1')`); GitHub CI build sí pasó. No atribuir origen del fallo a T-355 sin aislarlo. Corregir el marcado de E2E hasta tener run real sobre Preview READY y documentar RED→GREEN genuinos. No cambiar archivos prohibidos para hacer verde.

**PR410-H06 — MEDIO — `src/features/courier-onboarding/actions.ts:499-526`.** La acción comprueba el rol con un SELECT previo, pero el UPDATE solo hace `.eq('id', user.id)`. Si el rol cambia durante la operación, el predicado que autorizó la mutación ya no vale; escenario TOCTOU posible, aún no reproducido en ejecución. Arreglo: añadir `.eq('role', 'courier')` al UPDATE, tratar retorno de cero filas como rechazo sin efecto y demostrar prueba RED→GREEN del caso. El admin / otro actor no debe poder escribir por esta action.

**PR410-H07 — MEDIO — `src/app/(courier)/courier/profile/page.tsx:118`.** Se envía `dni_hmac.slice(0,8)` dentro de `profileData` al Client Component, aunque la UI solo consulta su presencia. Reducir a `hasDniOnFile:boolean`; adaptar contrato local y pruebas, confirmar ausencia de prefijo HMAC en props serializadas.

## Mejoras

**PR410-H04 — MEDIO — `e2e/specs/authorization.spec.ts:344-348`.** El E2E abre el diálogo pero no afirma precarga exacta desde la DB; tampoco prueba una sesión distinta. Agregar `toHaveValue(...)` y persistencia tras iniciar sesión con un contexto nuevo (fixture segregada).

**PR410-H08 — BAJO — `e2e/specs/authorization.spec.ts:315-321,374-379`.** La lectura inicial no comprueba `error`; `previousPhone=null` por error puede resultar en restauración errónea dentro de `finally`. Fallar antes de mutar si lectura falla y verificar restore.

## CI, pruebas y restricciones del revisor

- **CI del SHA revisado, workflow #39091997298:** `typecheck`, `lint`, `unit`, `build`, `audit`, `db-tests`, `bundle-budget` success. Unit: 145/145 archivos. DB: `Files=29, Tests=2764, Result: PASS` y `git diff --exit-code` concluido.
- **Estados no verdes:** `approval-policy` failure (PR de asako669 sin aprobación P1), Vercel Preview FAILURE, **no existe resultado e2e-preview** en el SHA. `Supabase Preview` skipped no significa fallos DB: el gate objetivo usa Supabase Develop compartido.
- **Comprobado solo por inspección:** archivos, RLS histórica, pruebas y flujo de acción. No se han corrido `pnpm`, mutaciones independientes, Playwright, `git merge-tree` ni lectura de Supabase remoto desde esta sesión: el contenedor carece de conexión DNS a GitHub. No inventar RED/GREEN ni `verificado_en_sha`.
- No se tocaron secretos ni `.env*`, no se arrancó Docker/Supabase y no se dispararon workflows. Comentarios iniciales: solo bot Vercel; hilos de code review: cero.

## Cierre

Ronda CON BLOQUEANTES. Sin decisiones pendientes del propietario: **H02=B**. Autor: `git pull` (sin rebase, amend ni force), arreglos acotados H01/H03/H06/H07; sumar H04/H08; corregir evidencia H05; registrar tests RED→GREEN y actualizar bitácora. El CC #412 se tramita separado antes del merge de T-355. Solicitar nueva ronda independiente tras cambios; **no aprobar ni mergear**.
