# Informe de revisión — PR #551 / T-415 — Ronda 1

**Fecha:** 2026-10-26 (Argentina). **Revisión independiente:** Codex para Lautaro073.
**Código ejecutado:** `a3f349817426a4d1940abea547e9d391da0d03b0`. **HEAD documental inspeccionado:** `6aee02867ec53717f7eb1749125cb863009d0c36`.
**Base:** develop `9b348f9b41de7c4e74b08dcccfe4eb94b4262597`.
**Resultado: CON BLOQUEANTES (4).** No se aprueba ni se mergea la PR.

La ronda examina los 37 archivos y CC-041 contra la ficha de origin/develop. El único cambio posterior al SHA ejecutado son cinco líneas de bitácora; comparación mecánica sin cambios en src, supabase, e2e, tools, dependencias ni workflows. No se exige otro CI por esa bitácora. No se atribuye verificación de arreglos futuros: el autor avisó que los comienza mientras se publica esta ronda.

Al publicar llegó el commit de arreglos del autor `2a5c1593ecabbeb613c4eb5d5f67c450b8e2b5a0`. Se conserva como padre de la publicación documental; no se atribuyen a esta ronda pruebas sobre ese código ni se cierran hallazgos sin ronda 2.

## Decisión A01 — alcance aceptado

La ficha de develop permitía admin/{copy,queries,types}.ts; la PR agregó schemas.ts a su propia ficha. Lautaro073 resolvió en esta sesión: **«A: se autoriza src/features/admin/schemas.ts, y sumo pruebas de limites del formulario con paridad con el contrato RPC.»** Se acepta esa incorporación, acotada al parámetro de CC-041; las pruebas comprometidas forman parte de H04. Ninguna decisión queda pendiente. No se implementa otro enfoque ni se tocan los arreglos del autor.

## Prioridades

| ID | Severidad | Tipo | Ubicación en SHA revisado |
|---|---|---|---|
| H01 | medio | correctness | src/domain/testing/rpc-fake.ts:3750 |
| H02 | medio | test-coverage | src/features/requests/components/online-couriers-indicator.test.tsx:67 |
| H03 | medio | test-coverage | supabase/tests/cc041_online_couriers.sql:164 |
| H04 | medio | test-coverage | src/features/admin/queries.test.ts:762 |

Son bloqueantes por el DoD y las reglas de revisión. H01 es un defecto funcional reproducido **del fake**; H02–H04 son controles insuficientes, no afirmaciones de que el SQL o la UI productivos ya estén rotos.

## H01 — El fake conserva en el conteo un repartidor sin consentimiento activo

**[VERIFICADO-RUNTIME]** El conteo exige status, available y fecha, pero no el consentimiento del repartidor contado. Solo valida el consentimiento del actor merchant que consulta. El comentario admite que no modela el consentimiento individual, aunque CC-041 y la suite dicen paridad con la base.

**Reproducción propia:** aprobado/disponible/active manda heartbeat; merchant activo obtiene 1. Cambiar solo al courier a pending o reconsent_required y consultar con merchant activo sigue devolviendo 1, esperado 0: **2/2 RED**. El SQL real sí tiene `p.consent_status = 'active'`, y el pgTAP prueba la revocación: no se denuncia un defecto de producción en ese filtro.

**Arreglo:** consentimiento persistido por courier en el fake y filtro de active, con seeds y sincronización acotados a esa representación. Probar pérdida y recuperación de consentimiento, status y renovación de presencia. No inferir el estado de otro perfil del merchant que consulta. La mutación posterior debe retirar solo el filtro nuevo.

## H02 — La prueba de refresco inspecciona opciones y omite el observer real y errores con snapshot previo

**[VERIFICADO-RUNTIME]** La prueba de la línea 67 comprueba el objeto devuelto por onlineCouriersQueryOptions, pero no que esas opciones lleguen a useQuery ni que el dato visible cambie. El caso de error arranca sin dato y solo espera la llamada a fetch, no el estado de error del observer.

**Batería propia, M04–M09:** desactivar polling, permitir background, desactivar foco, desactivar reconnect, devolver initial en el queryFn o ignorar isError dejan **6/6 GREEN**, cada mutación por separado. El control original sin mutar y la restauración posterior pasan.

**Sondas de solución ejecutadas:** QueryClient con staleTime 60000 y defaults foco/reconnect false; hook real, HTTP simulado, managers y timers controlados. **3/3 GREEN** sin mutar. Las cinco mutaciones del hook se ponen RED: polling/foco/reconnect por ausencia de fetch; background por tres llamadas en lugar de una; snapshot por ausencia de lecturas frescas. El comportamiento actual del hook pasó estas sondas.

**Arreglo:** tests del hook real para cambios de datos, pausa, retorno y reconnect; caso del indicador con dato previo y refetch fallido que espere estado error antes de afirmar desaparición. Retirar únicamente `|| isError` debe detectarse. Mantener pruebas de opciones como complemento, no como único control.

## H03 — pgTAP no distingue invariantes que declara cubrir

**[POR INSPECCIÓN + CI VERDE]** Se leyó el SQL y el log de db-tests; no se ejecutaron mutantes SQL ni base local.

Enumeración completa de la clase: las dos RPC, tabla/policy/grants, heartbeat inicial/renovación, cada condición del conteo y parámetro/admin. Huecos concretos:

- El segundo heartbeat ocurre bajo el mismo now() transaccional que el primero. El test afirma éxito y una fila; conservar la hora vieja en ON CONFLICT también satisface eso. Envejecer la fila antes de repetir y comprobar la hora persistida distingue renovación real.
- El suspendido está no disponible y sin presencia. El conteo no prueba que status excluya a alguien que sí cumple las demás condiciones. Sembrar suspendido y pendiente con señal reciente, available=true y consentimiento activo aísla ese filtro.
- No hay aprobado disponible activo sin presencia ni aserción del borde exacto de la ventana; se agregan sin introducir esperas.
- La policy se verifica por nombre/existencia, no como restrictiva ALL con USING(false)/WITH CHECK(false). Los grants actuales siguen cerrando el acceso; es defensa en profundidad exigida por CC-041, no una exposición actual demostrada.
- Faltan actor merchant activo sin fila merchants y catálogo por función para SECURITY DEFINER/search_path y STABLE en el conteo.

**Arreglo y RED propuestos:** en la misma suite, casos discriminantes; mutar por separado approved, renovación del upsert, definición de policy y existencia de merchant. No presentar esos RED como ejecutados hasta correrlos en CI aislado. La PR #552 ya confirmó la ausencia del esquema y fue cerrada sin mergear; ese RED no demuestra filtros ni renovación. Mantener 2/60 válidos y rechazos fuera de rango/tipo, actualizar plan(N).

## H04 — El admin solo prueba el fallback y una entrada válida del parámetro nuevo

**[VERIFICADO-RUNTIME]** Las filas del fixture no incluyen courier_online_window_minutes y la expectativa nueva es 10. Por eso **M10: lectura reemplazada por 10 fijo → 48/48 GREEN**. La nueva fila del formulario solo se prueba con 15; **M11: mínimo 2 cambiado a 1 → 16/16 GREEN**.

**Sonda de solución ejecutada:** agregar la fila 27 y exigir 27 da **49/49 GREEN** con el código actual y **1 RED + 48 GREEN** al hardcodear 10.

**Arreglo:** separar lectura configurada de ausencia/fallback; límites reales del formulario 2/60 permitidos y 1/61/2.5 rechazados sin invocar action, con error accesible. Por decisión A01, comparar el schema real del formulario con el contrato RPC para valores numéricos representativos y rechazar vacío/texto. Mínimo 2→1 y máximo 60→61 deben romper paridad/límites. No se pide alterar rangos del contrato ni el código correcto para acomodar tests.

## Verificación y reproducción de evidencia del autor

- Local a3f3498: typecheck exit 0; lint exit 0; pnpm test con pnpm 10.28.0 exit 0, **183 archivos/3390 pruebas**, más **81 workflows y 6 ADR**. Node local 24.22.1; CI usa 22.14.0.
- La primera corrida usó involuntariamente pnpm 11 en subprocesses del entorno: falló la sonda de pnpm why --prod (3389/3390). Con la versión fijada, archivo 5/5 y corrida completa verdes, sin alterar tests.
- Mutaciones independientes: control previo y posterior **84/84**; M01–M03 detectadas, M04–M13 sobreviven en sus suites. Los arneses completos están en evidencia/comandos.md y se ejecutaron desde /tmp.
- RED del autor reproducidos con implementaciones de develop y tests de la PR: dominio 5 fallos; action 2; páginas 4; admin 2. Los RED por módulo ausente son errores de import con **Tests no tests**; se registran como tales, no como prueba del comportamiento. Una lectura inicial no fiable de la ausencia del indicador se descartó como falla del instrumento y se repitió aisladamente comprobando ausencia y --no-cache.
- db-tests [job 121396514429](https://github.com/cadeApp/cadeApp/actions/runs/40268666030/job/121396514429): CC-041 ok, **Files=40, Tests=3244, Result: PASS**; generación local de tipos y diff exit 0. El merge de CI 3f91a2a tiene tree f7aaeab23f545eb852d67afa13f85d29338c43f5, idéntico al del SHA de código ejecutado.
- RED de esquema del autor: PR [#552](https://github.com/cadeApp/cadeApp/pull/552), job 121396541826, relation public.courier_presence does not exist y exit 1; cerrada sin merge. Verificado por log.
- No se revisó CI global para aprobar mientras hay bloqueantes. La bitácora registra un audit global de Zod pendiente; esta revisión no lo considera resuelto ni pide silenciarlo.
- E2E: se inspeccionó el spec, no se ejecutó contra remoto. Por ficha/runbook corresponde después de migrate-develop. No se pide otro CI solo por bitácora o esta publicación documental.

## NO TOCAR — comprobaciones que descartan falsos positivos

| Aspecto | Evidencia |
|---|---|
| Hora y privacidad reales | Tabla separada deny-all; heartbeat usa now(); respuesta de conteo estricta y agregada |
| Cuerpo previo de admin_update_setting | Comparación mecánica: quitada solo la rama CC-041, es idéntico al último cuerpo T-369 |
| Funcionalidad de polling actual | Las tres sondas de observer reales pasan; el hallazgo está en los controles entregados |
| RED pgTAP sin migración | Ya existe #552 cerrada sin merge; no hay que fabricarlo otra vez |
| Desvío schemas.ts | Autorizado por Lautaro073, con la condición de tests de límites/paridad |
| Arreglos en curso | No están verificados por esta ronda; no se reemplaza trabajo del autor |

## Prompt de corrección

El SHA del commit documental de cierre se publica en el mismo comentario de GitHub. No se intenta auto-referenciar ese SHA dentro de su propio commit.

```text
Tarea: T-415, PR #551, rama feat/T-415-online-couriers.

0. Traé el commit documental de revisión indicado en este comentario:
   git pull --no-rebase origin feat/T-415-online-couriers
   Si ya tenés arreglos locales, guardalos primero en un commit normal. No descartes cambios; sin rebase, force-push ni amend.

Decisión A de Lautaro073: se autoriza src/features/admin/schemas.ts y se exigen límites del formulario con paridad con el contrato RPC. A01 está aceptada; no hay decisiones pendientes.
Si ya implementaste parte, conservá ese trabajo y contrastalo con estos criterios; no rehagas arreglos por recibir el informe después.

Archivos permitidos para cambios persistentes de esta corrección:
- src/domain/testing/rpc-fake.ts (solo presencia/consentimiento de CC-041 y helpers necesarios).
- src/domain/cc041-online-couriers.test.ts.
- src/features/requests/hooks/use-online-couriers.test.tsx (único archivo nuevo autorizado).
- src/features/requests/components/online-couriers-indicator.test.tsx.
- supabase/tests/cc041_online_couriers.sql.
- src/features/admin/queries.test.ts.
- src/features/admin/components/platform-settings-form.test.tsx.
- src/features/admin/schemas.ts (solo el parámetro de CC-041, si sus pruebas requieren una corrección).
- docs/tasks/log/T-415.md (agregar sesión nueva, conservar las anteriores).

Prohibido: escribir docs/revision-pr/**, marcar hallazgos como verificados, editar la ficha o CC, agregar dependencias, debilitar aserciones/umbrales, .only/.skip, ramas if(test), mocks que eviten el camino real, fabricar resultados RED/GREEN o adulterar tests para que pasen. No crear otros archivos del repo; auxiliares en /tmp. No tocar otras RPC ni migraciones mergeadas. No usar Docker/Supabase local, secretos o administración remota; no disparar workflows manualmente. No aprobar ni mergear.

1. H01 — Paridad del fake.
En FakeSeedCourier/FakeCourierRecord, modelá consentStatus por repartidor (seed opcional, default active); conservá el valor previo en putCourier y sincronizá el consentimiento explícito del actor courier en syncActorRecords. get_online_couriers_count debe exigir también courier.consentStatus === 'active'; no usar el consentimiento del merchant que consulta como sustituto.
En cc041-online-couriers.test.ts, para pending y reconsent_required: heartbeat aprobado/disponible/active, consulta merchant => 1; cambiar solo el consentimiento del courier y volver al merchant active => 0. Añadí recuperación a active, suspensión con presencia reciente y heartbeat que renueva una señal vieja tras avanzar el reloj inyectado. Afirmá ok en los heartbeat previos, no solo el conteo final.
RED: los dos consentimientos deben fallar antes del arreglo. Después, retirar únicamente el filtro de consentimiento debe volver a ponerlos RED; restaurar bytes desde memoria en finally.

2. H02 — Probar el observer real y el error con dato previo.
Creá use-online-couriers.test.tsx con renderHook, QueryClientProvider y fetch simulado en la frontera HTTP; conservá useOnlineCouriers/fetchOnlineCouriers reales. QueryClient: staleTime 60000, retry false, defaults refetchOnWindowFocus false y refetchOnReconnect false, para que el hook tenga que habilitarlos. Limpiá cliente, timers y managers al terminar.
Con initialData count=1 y respuesta count=2: antes de 60000 ms no hay polling; al llegar a 60000 hay fetch y count=2; oculto no suma llamadas; al volver y al reconectar refetchea incluso con dato fresco. Usá timers controlados y focusManager/onlineManager; sin sleeps ni mocks de useQuery.
En online-couriers-indicator.test.tsx: empezá con dato válido, hacé fallar un refetch real con HTTP 500, esperá estado error de la query y exigí que desaparezca el indicador. No alcanza esperar solo que fetch haya sido llamado.
RED independientes, temporales, sobre use-online-couriers.ts: sobrescribir las opciones efectivamente pasadas a useQuery con refetchInterval:false; refetchIntervalInBackground:true; refetchOnWindowFocus:false; refetchOnReconnect:false; queryFn que devuelve initial en lugar de leer HTTP. Sobre el indicador, retirar solo || isError. Cada mutación debe romper la prueba pertinente. No hace falta cambiar estas implementaciones correctas para satisfacer el hallazgo.

3. H03 — pgTAP que discrimine las propiedades declaradas.
En cc041_online_couriers.sql:
- Antes del segundo heartbeat, envejecé last_seen_at como fixture postgres; después exigí hora persistida now() y una sola fila. now() no avanza dentro de la transacción: repetir la llamada sin cambiar el fixture no demuestra renovación.
- Sembrá suspendido y pendiente con consentimiento active, available=true y presencia reciente; no deben contar. Añadí aprobado/disponible/active SIN presencia y el límite exacto last_seen_at = now() - ventana, que tampoco cuentan.
- Afirmá catálogo: policy de public.courier_presence restrictiva, ALL, roles anon/authenticated, USING(false) y WITH CHECK(false); por cada RPC, SECURITY DEFINER y search_path fijo; conteo STABLE. Conservá las pruebas de grants.
- Perfil merchant activo sin fila merchants => UNAUTHORIZED_ACTOR. Parámetro: extremos válidos 2/60 y rechazos 1/61/2.5 y texto. Ajustá plan(N) al número real.
Mutaciones SQL: quitar solo el filtro approved; conservar hora vieja en el ON CONFLICT; convertir solo la policy a permisiva/true; quitar solo el chequeo de fila merchants. Cada una debe tener una aserción que la detecte. En dominio, las equivalentes de status y renovación también deben ponerse RED.
No ejecutes base local. Cuando necesites RED de SQL, usá una rama/PR aislada review/T-415-<mutacion>, REVIEW ONLY / NEVER MERGE, verificá el fallo concreto y cerrala sin mergear. La #552 ya demuestra la falta del esquema; no reemplaza estas mutaciones. Nunca pushees mutantes a la rama de trabajo ni despliegues código roto. Anotá solamente lo que realmente ejecutaste; si una mutación queda sin ejecutar, declarala pendiente.

4. H04 + A01 — Parámetro guardado y límites del formulario.
En queries.test.ts, agregá una fila courier_online_window_minutes=27 y exigí courierOnlineWindowMinutes=27. Conservá aparte la ausencia de fila => 10. El mock debe devolver filas de platform_settings; no mockear getPlatformSettings.
En platform-settings-form.test.tsx, usá el schema real y la action simulada: 2/60 válidos; 1/61/2.5 inválidos, error accesible y action sin invocar. Compará la aceptación numérica de courierOnlineWindowFormSchema con adminUpdateSettingInputSchema.safeParse({key:'courier_online_window_minutes', value:n}) para n = -1,0,1,2,3,27,59,60,61,62,2.5,NaN,Infinity; al formulario pasale String(n). Probá vacío y texto como entradas inválidas adicionales.
RED separados: sustituir temporalmente la lectura por 10 fijo; mínimo del formulario 2=>1; máximo 60=>61. Deben fallar la lectura de 27 y las pruebas de paridad/límites, respectivamente. No cambiar expectations ni el contrato para acomodar el mutante.

5. Verificación y cierre.
Usá pnpm 10.28.0. Corré las suites afectadas sin mutar, cada RED con el mismo control y GREEN tras restaurar; pegá resúmenes reales Tests... y, para SQL, not ok / Files= / Tests= / Result: con enlace de job y SHA. El arnés independiente de la revisión está en evidencia/comandos.md: podés consultarlo, no editarlo ni usarlo como única validación de tu arreglo.
Corré pnpm typecheck, pnpm lint y pnpm test. db-tests y tipos se comprueban por CI; no iniciar Supabase. Al haber cambios de código/tests, corresponde CI del nuevo código; un cambio solo de bitácora no exige otra corrida verde.
Agregá a la bitácora hecho / pruebas / falta, sin escribir verificado. Commit normal con [T-415], push y pegá:
   git ls-remote origin refs/heads/feat/T-415-online-couriers
Pedí la ronda 2. Los cuatro hallazgos siguen abiertos hasta revisión independiente.
E2E real queda pendiente contra develop después de migrate-develop, según la ficha; no declararlo ejecutado por tener el spec. No resolver ni silenciar el audit global de Zod dentro de este cambio.
```
