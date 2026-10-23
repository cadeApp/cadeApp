# Informe revisar-pr — T-414 / PR #542 — ronda 1

**Fecha:** 2026-10-22 (Argentina). **SHA verificado por inspección:** `204402e2aa8075d5fc405e62ce121af0c89030be`. **Base:** `develop` @ `7d9471fa8b105854b5ae175fa75a12cd9f20c83a`.
**Resultado: CON BLOQUEANTES (2).** No aprobar, no mergear.

## Decisiones cerradas por Lautaro073

D01=A: aceptar RLS restrictivas deny-all y actualizar CC-040 (hecho). D02=A: destinatarios paginados y suscripciones en lotes (hecho). D03=A: etiquetas de Auditoría en la ficha (hecho). **Ninguna decisión nueva pendiente.**

## H01–H04 · Correcciones inspeccionadas

- **H01:** `src/features/announcements/actions.ts`: si `attempts.length === 0 && errors.length > 0`, trata push como fallido, sin registrar 0 enviados. Caso legítimo sin destinatarios, sin errores, sí puede registrar cero. Unit tests para ambos.
- **H02:** `actions.ts` consulta `recorded.ok` y expone `pushRecorded`; `announcements-admin.tsx` avisa si el push se entregó pero el resultado no quedó guardado.
- **H03:** `announcement_push_recipients` tiene `ORDER BY profile_id`; el sender pagina RPC de 1000 en 1000, consulta `push_subscriptions` en lotes de 100 usuarios y con páginas de 1000 ordenadas por ID. Unit tests para 2500 destinatarios y un lote con 1500 suscripciones.
- **H04:** la confirmación del admin requiere estado de conteo `ready`; un error la bloquea y aparece «Reintentar conteo». Unit test de error → disabled → retry → enabled.

**Alcance de la comprobación:** inspección directa de implementación y tests + `unit` PASS en CI. No hubo mutaciones ejecutadas independientemente: este contenedor no pudo clonar GitHub por DNS y no ejecuta Supabase/Docker local por instrucciones. **Estado de H01–H04: arreglado-sin-verificar**, `verificado_en_sha = null`; los 13 RED declarados por el autor no se adjudican al revisor.

## BLOQUEANTE H05 — Falta enumerar autorización por cada RPC

**Archivo:** `supabase/tests/cc040_announcements.sql:163–180`. **Severidad:** alto. **Patrón:** P06-enumeracion-incompleta, pr-56/AG-37.

El contrato CC-040, sección «Pruebas exigidas», pide autorización **de cada RPC**. En la suite de 48 aserciones solo se prueba comercio y admin aal1 en `admin_count_announcement_audience`, ausencia de sujeto en `admin_create_announcement` y negaciones en `get_my_announcement`. **No hay negativas** para `admin_record_announcement_push` ni `admin_list_announcements` por rol, aal1 o ausencia de sesión; tampoco una matriz explícita equivalente para `dismiss_announcement` / `set_promotions_opt_in`.

**Riesgo probado por inspección:** una futura eliminación de `app_private.assert_admin_aal2()` exclusivamente de `admin_list_announcements` quedaría sin aserción de autorización dirigida a esa RPC. **No se afirma una escalada real en el código actual**, cuyo guard está presente.

**Arreglo:** en `supabase/tests/cc040_announcements.sql`, ampliar matriz de 4 RPC admin × (no sujeto, merchant, admin aal1), más 3 RPC de cuenta × (no sujeto, actor equivocado, consentimiento inactivo donde aplique), reutilizando `pg_temp.call` y fixture de UUID válido. Ajustar `plan(n)` a total real. Cada test debe comprobar código de error `UNAUTHENTICATED`, `UNAUTHORIZED_ACTOR`, `AAL2_REQUIRED`, según actor. **RED:** quitar temporalmente solo `perform app_private.assert_admin_aal2();` de `admin_list_announcements` en CI aislado REVIEW ONLY/NEVER MERGE; el nuevo test por rol debe caer, después GREEN con SQL íntegro. No contaminar la PR #542 con SQL mutado.

## BLOQUEANTE H06 — Sleep en test de concurrencia

**Archivo:** `src/server/push/announcements.test.ts`, caso «nunca hay más de 10 envíos en vuelo». **Severidad:** medio. **Patrón:** P08-control-no-cubre-lo-que-dice.

Usa `await new Promise(resolve => setTimeout(resolve, 1))`. La skill `revisar-pr` marca expresamente los sleeps en tests como bloqueantes. La espera depende del scheduler.

**Arreglo:** sustituir por promises diferidas y una barrera/release del primer lote de diez; medir máximo en vuelo, no iniciar envío 11 antes de release, liberar y terminar los 25, con aserciones de `maxInFlight=10`, `sentCount=25` y `attempts.length=25`. **RED:** mutar en memoria `PUSH_BATCH_SIZE=10` a 11 y exigir fallo por concurrencia; restaurar y GREEN. Ningún sleep ni timeout.

## MEJORA H07 — Ficha contradice RLS aprobada

**Archivo:** `docs/tasks/T-414.md`, «Checklist de esquema/RPC». Mantiene texto «RLS sin policies» cuando D01=A aceptó `AS RESTRICTIVE` deny-all, ya documentado en CC-040 y migración. Cambiar solo ese texto a «RLS activada con policies restrictivas deny-all y revoke all». Sin cambio funcional SQL.

## Evidencia y CI

- PR aún draft, HEAD `204402e2aa8075d5fc405e62ce121af0c89030be`, mergeable según GitHub, ahead 3/behind 0 respecto a `develop`. Sin carpeta de review previa.
- Run `39882160536`: `unit` **177/177 archivos y 3361/3361 tests**, typecheck, lint, build, audit y bundle-budget PASS. `db-tests` pendiente al redactar.
- Run anterior `39877476741`, HEAD `b57f57f`: `cc040_announcements.sql` OK, `rls_enabled.sql` OK, **Files=39, Tests=3201, Result: PASS**; tipos generados `git diff --exit-code` sin diferencias.
- PR #543 RED pgTAP cerrada sin mergear, constancia del autor; la revisión no reejecutó ese rojo.
- `git merge-tree`, E2E y mutaciones no ejecutados localmente. GitHub `mergeable=true` no equivale al merge-tree. La prueba E2E requiere develop migrado después del merge.

## No tocar

No retirar policies restrictivas D01=A, ni romper banner best-effort por un fallo de push; tampoco revertir ampliación de Auditoría D03=A. No exigir repetir CI por este commit de documentación.

## Prompt exacto para el agente

Tarea: T-414, PR #542, rama `feat/T-414-announcements`.

**0.** `git pull` **primero** para incorporar el commit de revisión. No rebase, force-push ni amend.
**Solo tocar:** `supabase/tests/cc040_announcements.sql`, `src/server/push/announcements.test.ts`, `docs/tasks/T-414.md`, `docs/tasks/log/T-414.md`. **Prohibido** editar `docs/revision-pr/**`, migración en PR #542, tests ajenos, dependencias o cualquier otro archivo; scripts auxiliares solo `/tmp`.
**1 H05.** Añadí matriz de autorización por las siete RPC, con SQL de `pg_temp.call`, actor correcto y códigos de error. Test de cada RPC, no solo grants o un helper. Incluí `admin_list_announcements` y `admin_record_announcement_push` con sin sesión, merchant y admin aal1; para usuario, los tres actores negativos pertinentes. Ajustá plan. Mutación RED de guard SQL **solamente en PR aislada REVIEW ONLY / NEVER MERGE**, luego restaurá y verificá GREEN en `db-tests`; el fallo debe ser la nueva aserción, no fixture roto.
**2 H06.** Reemplazá `setTimeout(resolve,1)` en `src/server/push/announcements.test.ts` por barrera de promesas diferidas; muestra máximo 10 y total 25. Mutá `PUSH_BATCH_SIZE` a 11 temporalmente, RED por concurrencia, restituí fuente desde memoria y GREEN; pegá líneas exactas de test.
**3 H07.** Alineá una frase del checklist RLS en `docs/tasks/T-414.md` con D01=A y CC-040.
**4.** No crear tests falsos ni adulterarlos: prohibido editar expectativas solo para poner verde, desactivar checks, `.skip/.only`, mocks que no ejerciten producción, fingir RED/GREEN o declarar «verificado» en bitácora. No resolver nuevas decisiones por cuenta propia.
**5.** `pnpm typecheck && pnpm lint && pnpm test:coverage`; `db-tests` mediante CI, sin Docker ni Supabase remoto/local. Actualizá `docs/tasks/log/T-414.md` con hechos/pruebas/falta y resultados reales. Commit convencional `[T-414]`, push, salida de `git ls-remote origin feat/T-414-announcements` y SHA nuevo. La revisión revalida.

**Manual posterior:** E2E de `announcements.spec.ts` contra develop/preview después de `migrate-develop`, respetando el orden de despliegue; nunca presentar ese E2E como ejecutado ahora.
