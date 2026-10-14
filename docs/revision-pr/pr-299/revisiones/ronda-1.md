# Informe independiente — PR #299 / T-339 — Ronda 1

**Fecha:** 2026-10-08 · **SHA del código revisado:** `6fbde29f48cc502ff497d18c4488fcd442246bf6` · **Base:** `develop` @ `a773c05cc488a1fc60bfb36512cdca35d12d1271`.

**Resultado: CON BLOQUEANTES (9); NO MERGEAR.** Revisión independiente asistida por ChatGPT; no es la autorrevisión de asako669. Decisión **A** de Lautaro073: se acepta exclusivamente `src/ui/ui-system.test.tsx` dentro de «Archivos permitidos»; no pedir que se revierta el cambio 27→29.

## Evidencia comprobada y límites

- El HEAD remoto coincidió con la PR al revisar, sin commits adicionales y sin hilos inline pendientes. Ficha leída desde `develop`. El cambio de ficha no amplía el comportamiento; la excepción de `src/ui` fue aprobada explícitamente.
- CI, run `37743943883` sobre ese HEAD: `typecheck`, `lint`, `build`, `audit` y `bundle-budget` completados; `db-tests` FALLÓ durante la migración `20261007090000_t339_fixed_price.sql` con SQLSTATE `42601` y «v_consent_status is not a known variable»; `unit` FALLÓ por cobertura de ramas `src/domain/testing/rpc-fake.ts = 88.14%` frente al umbral 90%, **aunque Vitest registró 125 archivos y 1987 tests en verde**. No equivaler tests verdes con check unit verde. No se verificó `e2e-preview` del HEAD con una ejecución completa.
- Comprobación estructural independiente sobre blobs del SHA: `plan(28)` versus 26 sentencias pgTAP; `accept_offer` bloquea oferta antes de solicitud; el bloque idempotente de `take_request` no exige precio fijo; E2E siembra solicitudes publicadas; test contiene `Record<string, any>`.
- No se ejecutó PostgreSQL local ni se reprodujo concurrencia real: peligros de carrera marcados `[ANÁLISIS]`. Sin `git worktree` local disponible: ningún `verificado_en_sha` se adjudica por pruebas locales inexistentes. Evidencia y script reproducible en `evidencia/comandos.md`.

## Bloqueantes

### PR299-H01 — La migración nueva no compila [CI ROJO, crítico]
**Ubicación:** `supabase/migrations/20261007090000_t339_fixed_price.sql:133-151`, `app_private.request_cycle`.
Declara `v_consent public.consent_status`, lee `into v_role, v_consent_status` y compara `v_consent`. `v_consent_status` no está declarado. `db-tests` lo confirma con SQLSTATE 42601 y aborta antes de la suite. **Arreglo:** usar una sola variable `v_consent_status public.consent_status`, asignarla y comprobar `v_consent_status is distinct from 'active'`, sin degradar el gate CC-007. **RED:** error real del job `113200879815`. **GREEN exigido:** migración íntegra y pruebas pgTAP ejecutadas en CI, más mutación que elimine/reemplace el identificador para volver a obtener fallo.

### PR299-H02 — Inversión de locks en `accept_offer` [ANÁLISIS, alto]
**Ubicación:** migración: `public.accept_offer` líneas 376–399, `app_private.match_offer` 52–102.
El SQL mantiene `FOR SHARE` sobre la oferta elegida *antes* del `FOR UPDATE` de la solicitud. En dos aceptaciones concurrentes de ofertas A y B de una misma solicitud: la sesión 1 conserva share(A) y lock(request), la sesión 2 conserva share(B) y espera request; la sesión 1 intenta rechazar B con UPDATE desde el helper y espera share(B) → ciclo de espera. No se ha reproducido una carrera en BD. **Arreglo:** leer solo el `request_id` de la oferta inicialmente sin bloqueo, bloquear solicitud `FOR UPDATE`, después bloquear la oferta `FOR UPDATE` y revalidar pertenencia/estado/identidad. Mantener la precedencia de errores e idempotencia existentes. Probar dos aceptaciones verdaderamente paralelas sobre ofertas distintas y comprobar ausencia de `40P01`, único match y rechazo de perdedor.

### PR299-H03 — `take_request` acepta reintentos de subasta ajenos a su operación [ANÁLISIS, alto]
**Ubicación:** migración: `public.take_request` líneas 749–784; fake: `src/domain/testing/rpc-fake.ts`, bloque `take_request`.
Antes de comprobar `NO_FIXED_PRICE`, el código responde `idempotent:true` si encuentra oferta propia `pending` o `accepted`, incluso cuando `fixed_price_ars IS NULL` y la oferta provino de `submit_offer`. Eso hace que `take_request` en solicitud sin precio a veces tenga éxito, contra el contrato. **Arreglo:** permitir ambos caminos idempotentes solo cuando `v_req.fixed_price_ars IS NOT NULL`; en solicitud sin precio devolver `NO_FIXED_PRICE` tanto antes como después de ofertas propias; reproducirlo en SQL y fake. Mantener idempotencia para tomas legítimas con precio.

### PR299-H04 — Plan pgTAP incorrecto y casos de límite omitidos [ANÁLISIS mecánico, alto]
**Ubicación:** `supabase/tests/t339_fixed_price.sql:6` y resto del archivo.
El archivo declara `select plan(28)`, pero contiene exactamente 26 aserciones `throws_ok/is/lives_ok`. Una suite terminada no puede declararse verde así. Además solo prueba precio 999 y 1500; no comprueba publicar con 1000 y 1001, ni el piso modificable en publicación con los tres bordes exigidos. **Arreglo:** agregar casos reales que falten (no aserciones de relleno) y cuadrar `plan(N)` con número ejecutado, conservando `finish()`. Mutar el piso o retirar la validación de `publish_request` y verificar RED por código/respuesta, no por error de setup.

### PR299-H05 — Pruebas de carreras y de cero efectos incompletas [ANÁLISIS, alto]
**Ubicación:** `supabase/tests/t339_fixed_price.sql` completo y `rpc_offers.sql`.
La prueba SQL ejecuta tomas en serie; no inicia dos transacciones concurrentes, no cruza `submit_offer` con `take_request` y no compite contra `suspensión`/`available=false`. El gate CC-007 comprueba el código y `count(offers)=0` de un actor, pero no fotografía solicitud, contador `rate_limits`, auditoría y ausencia de match. **Arreglo:** agregá pruebas genuinas en dos conexiones (por ejemplo con `dblink` si ya está soportado en CI, o integración concurrente del runner), oráculos en DB para 1 ganador, 0 residuales, 0 deadlocks, elegibilidad al commit; y snapshots antes/después del fallo de consentimiento. No presentes `Promise.all` contra un fake síncrono como carrera SQL. Mutar un lock o el gate: RED en la prueba específica.

### PR299-H06 — Fallo real de cobertura `unit` [CI ROJO, alto]
**Ubicación:** `src/domain/testing/rpc-fake.ts` y `src/domain/t339-fixed-price.test.ts`.
CI `unit`: 1987 tests pasaron, pero la cobertura de **branches** del fake es 88.14%, inferior al umbral de 90% para `src/domain/**/*.ts`. **Arreglo:** añadir pruebas conductuales que recorran ramas no cubiertas de `take_request` y `submit_offer`; no tocar umbrales, exclusiones ni `coverage` config. Tras corregir, `pnpm test:coverage` debe terminar con exit 0, no solo mostrar 1987 PASS.

### PR299-H07 — El test de precedencia no agota el rate limit [ANÁLISIS, medio]
**Ubicación:** `src/domain/t339-fixed-price.test.ts`, prueba `'new precedence: REQUEST_EXPIRED before RATE_LIMITED...'`.
Hace 10 `submit_offer` contra la **misma** solicitud y el mismo courier. Tras la primera oferta, las otras nueve chocan con `DUPLICATE_ACTIVE_OFFER`; nunca queda demostrado que el contador llegue a 10. El error `REQUEST_EXPIRED` que se obtiene después pasa incluso si no se ejerció el límite. **Arreglo:** sembrar 10 solicitudes distintas publicadas y disponibles, exigir 10 éxitos, verificar una undécima sobre nueva solicitud válida como `RATE_LIMITED` y, con tope ya alcanzado, la vencida como `REQUEST_EXPIRED`. Mutar la precedencia invirtiendo `RATE_LIMITED` y `REQUEST_EXPIRED`: test debe ponerse rojo.

### PR299-H08 — E2E no comprueba publicación por UI [ANÁLISIS, alto]
**Ubicación:** `e2e/specs/fixed-price.spec.ts:40-60, 115-139, 179-200`.
Los tres escenarios llaman `seedDeliveryRequestInState(status:'published')`: comprueban las etapas de tomar/aceptar pero no el ingreso de precio y switch en formulario, ni la mutación real `draft → published` por `publish_request`. El DoD declara «publicación con precio y switch». **Arreglo:** un caso debe entrar por el alta del comercio, completar campos obligatorios y el precio, alternar switch, enviar y comprobar en BD ambos campos y estado publicado; conservar los oráculos post-toma existentes. Añadir casos de precio omitido y de mínimo por RPC donde corresponda. Mutar el payload del formulario para omitir `auto_assign`/`fixed_price_ars`: el E2E debe fallar.

### PR299-H09 — Uso de `any` en tests de dominio [ANÁLISIS, medio]
**Ubicación:** `src/domain/t339-fixed-price.test.ts`, aserción sobre `RPC_CONTRACTS.take_request`.
`(RPC_CONTRACTS as Record<string, any>)['take_request']` rompe la regla de tipado del proyecto. **Arreglo:** acceder de forma tipada a `RPC_CONTRACTS.take_request` sin `any`, con aserciones idénticas. Validar con `pnpm typecheck` y grep del diff.

## Mejora

### PR299-H10 — Comunicar el piso dinámico antes de publicar [ANÁLISIS, bajo]
**Ubicación:** `src/features/requests/components/create-request-form.tsx:118-128, 724-751`. El input acepta cualquier entero positivo y no visualiza `min_offer_ars`; la RPC lo valida correctamente, de manera que NO es bypass de seguridad. Mejora propuesta: leer piso vigente en la vista de alta, mostrar mínimo y advertir antes de enviar, manteniendo la RPC como autoridad. No ampliar a otras páginas.

## Falsos positivos descartados / NO TOCAR
- El `grant select (fixed_price_ars, auto_assign) ... authenticated` por columna es correcto para CC-023; no revertirlo ni conceder SELECT de tabla.
- La excepción `src/ui/ui-system.test.tsx` está **autorizada por decisión A**; no tratarla como desvío.
- El helper privado revoca `execute` de PUBLIC/anon/authenticated y el esquema exige autorización; no crear grants públicos para que «funcione».
- `typecheck`, `lint` y `build` verdes son reales en el HEAD del CI, pero no validan la migración ni la concurrencia.
- No convertir el envío en pago al comercio; D14 se conserva.

## Método, cierre y criterios de próxima ronda
- Código fuente revisado mediante integración GitHub, SHA exacto; no se ejecutaron Docker ni Supabase local/remoto, ni se modificó código de producto.
- CI revisado aun con bloqueantes solo para documentar fallas preexistentes del HEAD; **no** se afirma green de `db-tests` ni `unit`, ni de `e2e-preview`.
- Contrastar correcciones por símbolos y comportamiento, no confiar en el texto de bitácora; repetir defectos originales y mutar cada control; no escribir «verificado» en bitácora del autor.
- Próxima ronda: primero `git pull`, verificar SHA remoto y comentario, comparar merge-tree/develop, volver a correr invariantes y SQL/E2E sobre el nuevo HEAD; CI solo si sin bloqueantes.

