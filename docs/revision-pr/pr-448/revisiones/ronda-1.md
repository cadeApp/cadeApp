# Informe de revisión independiente — PR #448 — Ronda 1

**Fecha:** 2026-10-20. **PR:** https://github.com/cadeApp/cadeApp/pull/448
**SHA de autor revisado:** `bbb5689612badb5103f64f8122814ccc124f7595`.
**Base original:** `develop@54bbdcd7b079fa208e970725efa66832a8fac724`.
**Alcance:** 5 fichas T-379..T-383, 2 contratos CC-034/035 y cinco filas de `docs/implementation-plan.md`; 8 archivos, +801/-0.

**Resultado:** **CON BLOQUEANTES (5)**. No aprobar ni mergear todavía.
**Metodología:** inspección de fuentes del commit y contraste con implementaciones de la base del PR. Se ejecutaron siete controles de texto, todos RED en el SHA original. **No se ejecutaron pnpm, DB, Docker, Supabase, E2E ni merge-tree local**, porque el clon no está disponible en el entorno (el acceso Git remoto directo falla por DNS); no se atribuye GREEN a esas pruebas. Las pruebas RED de esta ronda son solo *estáticas y documentales*, no demuestran fallos de runtime.

## Resumen

| Hallazgo | Nivel | Punto del PR | Clasificación |
|---|---|---|---|
| PR448-H01 | BLOQUEANTE | `docs/tasks/T-379.md:31-36,75-80` | Exhaustividad del estado: `accepted` + solicitud `cancelled/null` sin destino definido |
| PR448-H02 | BLOQUEANTE | `docs/tasks/T-382.md:29-35,59-75,81-87` | Fuente de verdad push no vinculada a usuario; decisión 2-A |
| PR448-H03 | BLOQUEANTE | `docs/contracts/CC-034.md:40-54` | La forma de salida contradice el reintento idempotente |
| PR448-H04 | BLOQUEANTE | `docs/tasks/T-379.md:3-4,100` | Declara T-378 mergeada pese a PR #440 abierta |
| PR448-H05 | BLOQUEANTE | `docs/tasks/T-381.md:39-42,75-80` | Promete refresco en navegación interna sin exigir esa prueba |

## H01 — Enumera TODA la clase de estados de una oferta aceptada

**[ANÁLISIS]** La ficha manda a «Aceptadas» las `accepted` con solicitud `matched/in_transit`, y a «Otras» las `accepted` con `delivered`. Faltan la solicitud `cancelled` y la relación ilegible (`null`). Esas variantes caben en el modelo: `delivery_request_status` incluye `cancelled`, y la propia ficha prevé `null` por RLS. La PR no da resultado ni presentación para ellas.

**Decisión 1-A de Lautaro073:** agregar explícitamente en T-379 `accepted + solicitud cancelled → Otras, badge Cancelado, sin botón de continuar viaje`; `accepted + solicitud null → Otras, badge Estado no disponible, sin enlace a una solicitud ilegible`. No etiquetar `null` como «Cancelado». Mantener `matched/in_transit → Aceptadas` y `delivered → Otras`. Exigir test de cada rama, contador y CTA; modificar la fila T-379 del plan solo si el DoD resumido debe reflejarlo.

**Cómo comprobar en la implementación futura:** unidad de clasificación para `accepted` + `matched, in_transit, delivered, cancelled, null`, y pruebas de la UI verificando el estado y que nunca hay link cuando falta acceso. Mutación RED independiente: forzar `null` a la pestaña Aceptadas y demostrar que el test falla.

## H02 — Estado de push no puede derivar de un booleano de localStorage

**[ANÁLISIS]** La ficha presenta como confirmación de alta `PUSH_STORAGE_KEY`, permiso y suscripción nativa. `subscription.ts` marca `PUSH_STORAGE_KEY='true'` tras un POST exitoso y la clave no identifica el usuario. Tras cambiar de cuenta sin logout, el mismo navegador conserva clave y `getSubscription()`. La ficha podría afirmar «avisos activados» en la cuenta B aunque la fila pertenezca a A. CC-035 solo reasigna al **solicitar** explícitamente alta; no valida lo que muestra el indicador al entrar.

**Decisión 2-A de Lautaro073:** T-382 debe exigir verificación autenticada de pertenencia del endpoint en backend; no confiar en localStorage. Diseñar la API de lectura aislada `POST /api/push/subscriptions/status` con JSON `{endpoint}` y respuesta `{active: boolean}`; sesión requerida; Zod; consulta de `push_subscriptions` limitada por `user_id = auth.uid()` y RLS, sin devolver IDs ajenos, endpoint ni claves. El endpoint va solo en el cuerpo, jamás querystring, logs, analytics o mensaje de error. La UI comprueba permiso `granted`, suscripción nativa y `active===true`; en error o sesión vencida muestra estado no verificable, nunca «activo» por almacenamiento anterior. El botón de alta sigue requiriendo gesto del usuario, sin subscribe automático. Añadir a «Archivos permitidos» `src/app/api/push/subscriptions/status/route.ts` y `route.test.ts`, y especificar claramente que el POST/DELETE existente queda reservado a T-383. En caso de cambios de contrato de dominio no previstos, activar el proceso CC antes de implementar.

**Pruebas futuras:** cuenta A registra, cambia a B en el mismo origen sin logout, B entra a «Configurar» y **no** ve activado; A vuelve y ve su estado; backend no filtra datos ajenos; backend caída = estado desconocido; tras alta explícita de B con CC-035 ya aplicado, B ve activado. RED: reemplazar el chequeo servidor por `PUSH_STORAGE_KEY` y demostrar test rojo. Integración real sin mocks que salteen la RLS.

## H03 — Contrato JSON contradictorio en `previousStatus`

**[ANÁLISIS]** `CC-034.md:41` ilustra `previousStatus: suspended|rejected`. `:52` manda responder `previousStatus: approved` para un segundo intento, por lo que cualquier wrapper/schema tipado según el ejemplo excluiría un resultado válido.

**Arreglo documental:** salida explícita como unión `suspended|rejected|approved`, con ejemplo separado de reintento `{ courierId, previousStatus: 'approved', status: 'approved', idempotent: true }`. Aclarar que `approved` se usa solo en vía idempotente, sin nueva auditoría. Exigir prueba de contrato/fake/wrapper que distinga ambos resultados. RED futuro: eliminar `approved` del schema y comprobar rechazo del resultado idempotente.

## H04 — Dependencia presentada como ya mergeada

**[ANÁLISIS]** `T-379.md:4` dice «Dependencias (mergeadas en develop): T-114, T-115, T-378»; PR #440 (T-378) seguía `open, merged=false` al revisar. Es una precondición operativa falsa que permitiría arrancar T-379 mientras se editan las mismas vistas.

**Arreglo:** dejar T-114/T-115 como integradas si se confirman; escribir `**Bloqueada por:** T-378 (#440), hasta merge a develop`. Conservar restricción de arranque en «Notas» y reflejar el bloqueo coherentemente en la fila T-379 del plan. No mergear #440 ni modificar su código por esta PR.

## H05 — Regreso por navegación SPA fuera del test comprometido

**[ANÁLISIS]** `T-381.md:39-42` exige refresco al volver del detalle; `:78` solo pide eventos de foco/visibilidad y Realtime. Navegar detalle → panel en la misma pestaña no necesariamente produce ninguno de ellos; por tanto los tests declarados podrían estar en verde sin cubrir el síntoma reportado.

**Arreglo:** obligar un test que navegue dentro de la aplicación detalle → panel, **sin** evento de foco, visibilidad o Realtime, y compruebe un refresco y el conteo actualizado sin `location.reload()`. Especificar disparador de reentrada al segmento/montaje sin bucles, debounce y limpieza; mantener diagnóstico A/B y no alterar SQL. Mutación RED futura: quitar solo el disparador de reentrada conservando foco/Realtime; el E2E específico debe fallar.

## Decisiones recibidas (NO pendientes)

- **1-A:** clasificación de cancelados y sin estado en «Otras» (H01).
- **2-A:** estado push consultado al backend con pertenencia de cuenta (H02).
- **3-A:** aceptar reasignación de endpoint al usuario autenticado según CC-035; mantener RLS, no revelar endpoints ni claves y registrar el riesgo de capacidad existente. **No es hallazgo abierto adicional** y no se autoriza auto-suscripción.

## NO TOCAR / no falsos positivos

- No modificar código de aplicación, migrations, tipos, tests de producto ni workflows en esta PR: es solo definición.
- **CC-034**: conservar `assert_admin_aal2`, motivo, row lock, disponibilidad `false` y auditoría sin datos sensibles.
- **CC-035**: conservar cliente de sesión, RLS, scope de usuario y audit_log sin endpoint; el riesgo de posesión del endpoint fue decidido (3-A).
- **T-381**: el diagnóstico B es hipótesis, no bug probado; no exigir migración sin reproducción.
- **T-382**: el permiso bloqueado en Edge y falta de servicio push son errores diferenciados por diseño, no un único código genérico.

## Evidencia, CI y cierre

- Inspección por el conector GitHub del diff completo y de las implementaciones existentes; se comprobaron las refs de #440, #448 y `develop`. La rama estaba 11 commits detrás de `develop`, sin conflicto notificado por GitHub; **no se ejecutó** `git merge-tree`.
- Siete aserciones documentales puntuales: **7 RED / 0 GREEN** en el SHA de autor; comandos autocontenidos y mutaciones propuestas en [evidencia/comandos.md](../evidencia/comandos.md). No llamar a eso «pnpm test».
- **CI no evaluado como criterio de aprobación**: hay bloqueantes y la PR solo contiene documentación. No exigir otro ciclo de CI GREEN por el commit de este informe.
- Autor: corregir solo los archivos documentales autorizados, registrar comprobaciones reales y hacer push. Revisión independiente repetirá controles contra el **nuevo SHA**. Estado de todos los hallazgos: `abierto`, `verificado_en_sha: null`.
