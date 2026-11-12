# Ronda 1 — PR #735 · T-435 / CC-051 · 2026-11-12

**Conclusión: CON BLOQUEANTES (6); MEJORAS (1).** Revisión independiente del head `603fa9a0d6d9d930361b93282a88b6853bef6a5d` contra `develop@2cd76f24`. PR documental; los hallazgos se refieren al contrato/DoD **que condicionará la futura implementación**, no a un E2E ya entregado. Nadie debe interpretar las pruebas documentales como una captura de Realtime.

## Preflight y alcance

- PR #735 abierta, autor @Lautaro073, head `603fa9a0d6d9d930361b93282a88b6853bef6a5d`; GitHub muestra `develop` en `2cd76f24`, la rama 1 commit adelante/0 atrás y `mergeable=true`. No se pudo correr `git fetch` ni `git merge-tree` sin clon; esta constatación de GitHub no sustituye un merge-tree local.
- Leídos antes del diff: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md`; contrastadas lecciones pr-56/AG-37, pr-62/AG-57, pr-64/AG-61, pr-63/AG-68, pr-68/AG-74 y pr-82/AG-77.
- Comentarios: únicamente bot de Vercel (deploy ignorado), sin discusión humana ni review threads. No existía `docs/revision-pr/pr-735/` en el head; no había autorrevisión que conservar.
- Ficha `docs/tasks/T-435.md` **no existía en develop**; es nueva en esta PR, no un cambio silencioso de una ficha previa. El plan agrega solo la fila T-435. Cuatro archivos cambiados, todos dentro de los permitidos por la ficha nueva.
- Bitácora `docs/tasks/log/T-435.md` leída en el head. La afirmación de `pnpm exec vitest run tools` (123/123) es evidencia **declarada por el autor**, no reproducida por esta revisión. El run E2E 43181763102 es previo (`dba3314f`), no prueba INSERT ni esta propuesta.

## Decisiones incorporadas

- D1: **expresa de Lautaro073** (2026-11-12), usar Develop con usuarios del arnés `e2e-preview`.
- D2-A: selección **automática**, sin CHECK de null sin fuga; ante fuga, CC-023 §5.
- D3-A: selección **automática por autorización permanente**, **no decisión expresa**. Dos escenarios: (a) RPC real crea borrador y publica por UPDATE, el courier recibe UPDATE de publicación y se inspecciona cualquier INSERT adicional; (b) INSERT independiente de borrador sintético con datos presentes, luego de suscribirse: merchant y service_role lo reciben, courier no. Negativos por ventana/barra causal + autorización independiente.

## Hallazgos BLOQUEANTES

### PR735-H01 · [alto] INSERT exigido al repartidor sobre el flujo equivocado
**Lugar:** `docs/contracts/CC-051.md:47`, `docs/tasks/T-435.md:60`, fila T-435 de `docs/implementation-plan.md`.

La RPC `create_and_publish_multi_drop` ejecuta `INSERT ... status='draft'` (migración CC-024, líneas 235–245) y publica con `app_private.request_cycle('publish_request', ...)` (línea 361), cuyo cambio de estado es UPDATE. La especificación actual exige al repartidor suscripto a INSERT recibir una solicitud publicada. Esa expectativa no se justifica por el flujo real; podría bloquear una implementación correcta o alentar un INSERT artificial publicado.

**Corregir:** plasmar D3-A en CC, ficha y fila: para publicación real courier recibe **UPDATE**; si también llega INSERT, inspeccionar claves; para INSERT exigible crear borrador sintético independiente con roles propios. Mantener el E2E original T-345 (detalle/monto/match). **Evidencia:** lectura de migración + detector estático H01 (RED). No hay captura nueva ejecutada.

### PR735-H02 · [alto] Sin positivo de INSERT con valor presente
**Lugar:** `docs/contracts/CC-051.md:47-60,143-149`, `docs/tasks/T-435.md:59-69`.

El positivo con `service_role` se especifica **solo para UPDATE**; el INSERT esperado no garantiza origen con `notes` y `cash_change_amount` no nulos ni un positivo independiente del insert. Se podría afirmar ausencia de claves aunque nunca se replicara un valor sensible.

**Corregir:** una vez recibidos todos los estados `SUBSCRIBED`, insertar con el admin del arnés un `draft` con marcador sintético exclusivo de `testRunId` y monto; comprobar que `merchant` y `service_role` reciben **ese INSERT**, `service_role` ve ambas claves y el marcador, `merchant` no ve claves ni valor y `courier` no recibe evento. El control de origen por `service_role` debe dar rojo si no llega o no tiene marcador; no imprimir valores. Rastrear ID de limpieza. **Evidencia:** inspección, detector H02 RED; no E2E.

### PR735-H03 · [alto] Negativos sin ventana de observación ni autorización independiente
**Lugar:** `docs/contracts/CC-051.md:85-90`, `docs/tasks/T-435.md:66-68`.

El contrato dice comprobar la cola del canal no autorizado *en cuanto* el autorizado recibe el suyo. Los callbacks son asíncronos; el evento prohibido podría llegar más tarde. Además, un canal mal autenticado que nunca recibe nada produciría un falso verde.

**Corregir:** verificar `SUBSCRIBED` en cada canal; para el courier, comprobar por PostgREST que ve `published` y no `draft`, y que merchant sí ve su draft; para anon comprobar que no ve la fila por API. Introducir barrera causal por una mutación/evento positivo identificable y **ventana de observación negativa acotada**, con conteos por actor/evento/ID; no usar `expect.poll(() => events.length).toBe(0)` (pasa inmediatamente), ni `sleep` arbitrario. Documentar límite de la evidencia temporal. **Evidencia:** inspección, detector H03 RED.

### PR735-H04 · [medio] Cierre/fuga y aserciones contradicen el positivo
**Lugar:** `docs/contracts/CC-051.md:59,66-76,143`.

El cierre declara «si los cuatro controles pasan», pero hay control positivo separado y registro de captura. La rama «si algún control muestra claves» abarca al `service_role`, que **debe** ver `notes` en la publicación completa; eso dispararía una falsa fuga. Se pide `Object.keys` incluso en los casos «no llega ningún evento», donde no existe payload.

**Corregir:** gate de **toda** la matriz, positivo y registro; fuga solo si **actor restringido** recibe clave/valor que no debe, no el positivo privilegiado. En positivos, aserciones por `Object.keys` + JSON completo; en negativos, aserción sobre ausencia de eventos del ID y tipo tras ventana, no sobre `Object.keys`. **Evidencia:** inspección; detectores H05/H06 RED.

### PR735-H05 · [alto] Positivo imposible tras la alternativa CC-023 §5
**Lugar:** `docs/contracts/CC-051.md:70-77,143-151`.

Si se detecta fuga, CC-023 §5 ordena sacar `notes` y `cash_change_amount` del **listado de columnas de la publicación**. Desde ese momento esos campos **no se replican ni para service_role**. El CC simultáneamente exige que el control service_role reciba `notes` con el marcador y dice volver a correr el mismo E2E en verde: requisitos mutuamente excluyentes en la rama de fuga.

**Corregir:** definir dos oráculos sin rebajar seguridad: modo normal de publicación completa → `service_role` recibe marcador en INSERT/UPDATE y actores restringidos no; modo allowlist ante fuga → `service_role` prueba por SELECT directo que el marcador está en origen, recibe evento Realtime con columnas públicas del ID y **sin** columnas excluidas, además de pgTAP `pg_publication_tables.attnames` y preservación de `offers`/PK. Los dos modos deben fallar ante fuga. No alterar datos de schema para una mutación E2E. **Evidencia:** deducción del SQL aprobado; no se aplicó migración.

### PR735-H06 · [alto] Rollback no preserva la confidencialidad
**Lugar:** `docs/contracts/CC-051.md:109-114`.

En la rama de fuga, el rollback dice «volver a agregar la tabla sin lista de columnas». Eso **vuelve a publicar justamente los campos privados** cuya aparición motivaría la allowlist. No existe condición de seguridad para usar ese rollback.

**Corregir:** rollback **fail-closed**: mantener la allowlist mientras se corrige, o retirar **solo** `delivery_requests` de `supabase_realtime` si no se puede garantizar filtrado seguro (degradación funcional declarada), conservando `offers` y sin volver automáticamente a la publicación plena. Dejar explícita la regresión en los checks de publicación y la intervención requerida si esa rama ocurre. **Evidencia:** CC-051 actual, detector H04 RED.

## MEJORA

### PR735-H07 · [bajo] Correlación, cleanup y logs de eventos
**Lugar:** `docs/tasks/T-435.md:62-71`.

Precisar que cada `INSERT/UPDATE` se correlacione por ID + tipo de evento + marca pública del evento (`updated_at` u otra marca inequívoca), y que el draft sintético se registre con `trackEntityForCleanup`. Quitar todos los canales en `finally` incluso si falla suscripción y restaurar ambas columnas legacy a null tras el control. Logs de **nombres** de claves ordenados por actor/evento, sin JSON completo ni valores; las aserciones pueden comparar `boolean` para no volcar valores en un fallo.

## Checks y método

- **Verificado por lectura de GitHub:** conjunto completo de los cuatro archivos, SQL del flujo, permisos CC-023 y CC-048, arnés `e2e/fixtures/roles.ts` (1 solicitud y 2 couriers reales), spec T-345 y CC-051.
- **Detector estático sobre el head:** RED en H01, H02, H03, H04 (rollback), H05 (gate) y H06 (aserción imposible); tres reparaciones de texto exclusivamente **en memoria** apagaron sus detectores. Esto muestra contradicciones documentales, **no** un E2E RED→GREEN ni prueba de fuga. Código del verificador en [evidencia/comandos.md](../evidencia/comandos.md).
- **Checks locales:** `typecheck` no ejecutado · `lint` no ejecutado · `test` no ejecutado · `test:db` n.a. (documental). No se montó Supabase/Docker, ni se usaron secretos o tokens.
- **CI:** al existir bloqueantes, no se usa como certificación; el workflow CI asociado a `603fa9a0` figuraba cancelado. El check declarado por agy `vitest tools 123/123` queda «no reproducido». Un commit de revisión moverá el head y puede relanzar checks; **no se exige nuevo CI green únicamente por la bitácora**.
- **No verificado:** comportamiento Realtime con INSERT/UPDATE y actores de D3-A; eso pertenece a la PR de implementación y debe citar un run `e2e-preview` verde de su SHA.

**Resultado:** no aprobar ni mergear. Corregir documentación en esta rama y pedir ronda 2; no implementar E2E antes del merge documental. No se requieren nuevas decisiones de Lautaro: D1, D2-A y D3-A ya están resueltas en los términos indicados.

