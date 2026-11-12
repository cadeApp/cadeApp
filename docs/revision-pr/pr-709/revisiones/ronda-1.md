# Revisión independiente R1 — PR #709 · T-434 · CC-050

**Fecha:** 2026-11-12 (Argentina). **Head revisado:** `68ed5ba928b1a62d3470949aafda44bae7539f59`. **Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1`.

**Resultado: CON BLOQUEANTES (4).** Dos mejoras documentales. Esta PR SOLO define el contrato; **no se exige implementación ni RED/GREEN funcional en esta PR**. El cierre de SEC-09 queda para la futura PR de implementación y pruebas reales. No aprobar/mergear.

## Metodología y limitaciones

1. Leídos `COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, la skill `revisar-pr`, los patrones históricos de pr-56/pr-62/pr-64/pr-63/pr-68/pr-82 y la ficha paraguas T-409 (en develop). La ficha T-434 NO EXISTE en develop; se añade como alcance documental nuevo, no es una modificación de una ficha consolidada.
2. Head y base inspeccionados en GitHub: 1 commit por delante, merge-base igual a `dba3314f` y solo cuatro documentos: `CC-050.md`, `implementation-plan.md`, `T-434.md` y `log/T-434.md`. No existía carpeta `pr-709` al comenzar. Comentarios revisados: solo el bot de Vercel, sin discusión técnica.
3. Contraste contra código real de develop: `actions.ts`, `finalize_courier_application` de CC-042, `admin_reinstate_courier` de CC-034, `admin_list_applicants` de CC-044, lectura/auditoría admin, formulario de vehículo y ruta servidor de onboarding, `buildSupportWhatsAppHref`.
4. **No hubo clon local:** la sesión de contenedor no resuelve `github.com`, y no se levantó Supabase ni Docker (prohibidos). Por tanto **no se ejecutaron** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` en un clone. El autor declara `vitest tools 123/123`, **sin reproducción independiente**. CI oficial no se evalúa para aprobar mientras hay bloqueantes. El merge-base sin commits de develop posteriores reduce, pero no sustituye, el control `git merge-tree`.
5. Verificación estática sobre los archivos recibidos por conector: **6/6 observaciones de hechos reproducidas** y **6/6 mutaciones en memoria detectadas** (harness completo en `evidencia/comandos.md`). Esto prueba sensibilidad de las observaciones, **NO** es una prueba funcional RED→GREEN de lo que debe implementar T-434. No hay `verificado_en_sha` para ningún arreglo.

## Hallazgos BLOQUEANTES

### PR709-H01 — Búsqueda del reclamante para disputa ausente de contrato

**Origen:** CC-050 `Flujo de soporte`, línea 103; `src/.../cc044_admin_list_applicants.sql:84`. **Severidad:** alto · `P08-control-no-cubre-lo-que-dice` · origen: ficha.

El CC exige que el admin compare ambas identidades, pero una cuenta real que ya subió documentos y choca con `DNI_ALREADY_REGISTERED` **no llega a `application_submitted=true`**. La RPC normal `admin_list_applicants` excluye ese `pending` no enviado: `(p_status <> 'pending' or c.application_submitted)`. El detalle por ID puede mostrar documentos si el UUID ya se conoce; **no hay búsqueda operacional especificada para conseguirlo desde soporte**.

**D4-B (automática autorizada):** agregar al CC una búsqueda **separada** de disputa, no cambiar la lista normal. Especificar RPC `admin_find_courier_dispute_candidates(p_lookup text)`, `security definer`, `set search_path = public, pg_temp`, `assert_admin_aal2` en la propia base, permisos execute sólo authenticated, respuesta limitada (máx. 10) con UUID, nombre, teléfono enmascarado para lista, `status`, `applicationSubmitted` y presencia de documentos; **sin hash de DNI, paths, enlaces firmados ni valores del DNI**. Búsqueda deliberadamente acotada a UUID exacto o teléfono completo exacto validado (no listado indiscriminado ni `ilike '%%'`). Filtro `status='pending' and application_submitted=false`, documentación existente; mostrar ruta al detalle protegido y usar visor con aal2 + auditoría de visualización ya existente. El admin compara y confirma manualmente identidad, luego rechaza/suspende al usurpador y libera DNI con motivo; no ejecutar liberación automática por coincidencia de nombre/teléfono.

**Archivos a añadir a la ficha/plan:** migración y pgTAP CC-050 ya previstas; `src/domain/rpc-contracts.ts`, fake y tests ya previstos; `src/server/rpc/admin-applicants.ts` y `admin-applicants.test.ts`; `src/features/admin/queries.ts`, `queries.test.ts`, `schemas.ts`, `types.ts`, `components/dispute-candidates.tsx` + test; `src/app/(admin)/admin/applicants/disputes/page.tsx` + test; `components/applicants-queue.tsx` + test (solo enlace al flujo separado); `src/features/admin/index.ts` y `server.ts` si requieren exports públicos. Exigir no filtrar/enlazar drafts en `admin_list_applicants`.

**Pruebas para implementar:** pgTAP admin aal2 encuentra pendiente no enviado con documento, no retorna hash; rechazos `anon`/courier/admin aal1; búsqueda vacía o genérica inválida; máximo 10; el listado normal sigue excluyendo el draft. Vitest de wrapper, query y UI incluyendo coincidencias/errores. Mutación RED: quitar `assert_admin_aal2` o relajar filtro `application_submitted=false` => falla test específico. **No ejecutadas todavía.**

### PR709-H02 — Auditoría incompleta para courier_dni_released

**Origen:** `CC-050.md:92–96`; `src/features/admin/queries.ts:651–661,677–684,820`; `copy.ts:477–508`. **Severidad:** alto · `P08-control-no-cubre-lo-que-dice` · origen: ficha.

La RPC escrita en el CC guarda `before.dni_registered=true`, `after.dni_registered=false` y `after.reason`. En la app actual, `toAuditLogItem` sólo muestra motivos de eventos en `AUDIT_REASON_ACTIONS`; `courier_dni_released` NO figura. Tampoco hay etiqueta de acción ni `dni_registered` en `AUDIT_CHANGE_FIELDS`, por lo que quedaría como «Otro evento» sin cambio/razón visible. La bitácora no puede llamar «auditoría visible» a esa salida.

**D5-A (automática autorizada):** añadir al Impacto archivos permitidos `src/features/admin/queries.ts` y `queries.test.ts`, `src/features/admin/audit-format.ts` y `audit-format.test.ts` si hacen falta etiquetas/tone, además de `src/features/admin/copy.ts` ya permitido. Especificar allowlist de `courier_dni_released` para razón, cambio `dni_registered`, etiqueta «Liberó el DNI reservado» y test tanto de tabla de auditoría como de historial del postulante. No incorporar `dni_hmac`, DNI crudo ni URLs/paths a `before/after` o UI. Motivo limitado 3..500, texto libre sólo al admin; avisar explícitamente «no introducir números/documentos personales» y rechazar ejemplos evidentes de HMAC de 64 hex/DNI numérico en el campo. Si no es posible garantizar prohibición absoluta de PII en texto libre, declarar riesgo residual de moderación, no afirmar garantía imposible.

**Pruebas:** filtro de razón admite este evento y no admite otros arbitrarios; etiqueta/cambio visibles; auditoría con datos sintéticos no contiene hash; eventos de otros tipos continúan sin divulgar razón. Mutación RED: borrar el evento de la allowlist y verificar que el test de motivo falla (no sólo que hay fila SQL). **No ejecutadas.**

### PR709-H03 — Falta prueba integral del consumo tras errores y matriz completa de rechazo

**Origen:** `T-434.md`, DoD y `CC-050.md` (límite; concurrencia; impacto). **Severidad:** medio, BLOQUEANTE por DoD de seguridad · `P08-control-no-cubre-lo-que-dice` · origen: ambos.

Se pide «5 llamadas pasan, sexta RATE_LIMITED» a la RPC de contador, y por separado un mock de error en la acción. Esto **no prueba** que cinco ejecuciones con `finalize_courier_application → DNI_ALREADY_REGISTERED` consuman un cupo persistido en transacciones separadas; una implementación que sólo cuente éxitos podría pasar ambas familias de tests. Tampoco se exige matriz de motivo `null`, whitespace, longitud 2 y 501; ni verificación SQL de que motivo y auditoría se conservan al reintentar, con no duplicación. En un PR documental son ausencias del **plan de test**, no defectos runtime probados.

**Corregir en CC + ficha:** añadir caso integrado real que prepara cuentas/documentos y DNI ajeno: 5 llamados fallidos con código `DNI_ALREADY_REGISTERED` y contador=5 en la misma ventana, sexto da `RATE_LIMITED` sin llamar a `finalize`; otro usuario y día nuevo con cuota propia. Cota y concurrencia: dos consumos simultáneos no pierden incrementos; no se permite que abortar `finalize` haga rollback del consumo anterior. Completar matriz `p_reason` con trim `null`/vacío/espacios/2/501 y frontera 3/500, rechazo `VALIDATION_ERROR` sin update ni audit; dos llamados de liberación dejan exactamente una auditoría. En la futura implementación SQL, ejecución real por CI (sin Docker local).

**Mutaciones RED futuras:** omitir RPC de cupo al fallar finalize; mover contador a la misma transacción reversible; elevar umbral a 6; omitir `btrim`; permitir longitud 501; duplicar audit en reintento. Cada caso necesita un test que se ponga rojo por SU invariante (no TypeError de mock). **No se ha ejecutado ningún RED funcional.**

### PR709-H04 — Derivación a WhatsApp sin frontera Server/Client ni archivos permitidos

**Origen:** `CC-050.md:77–78`, `T-434.md` fuera de alcance; `src/features/courier-onboarding/components/vehicle-form.tsx:1`; `src/app/(courier)/courier/onboarding/vehicle/page.tsx`. **Severidad:** alto · `P11-api-publica-inconsistente` · origen: ficha.

El CC promete soporte existente pero no prescribe la URL alcanzable. El formulario de vehículo es `'use client'`; `CADEAPP_SUPPORT_WHATSAPP_NUMBER` es variable **del servidor**. La página servidor que monta el formulario **no figura en archivos permitidos**. Un agente podría crear `wa.me` sin destinatario, importar un helper por deep import ilegal o leer la variable en el cliente.

**Corregir:** definir que la página `src/app/(courier)/courier/onboarding/vehicle/page.tsx` obtenga `process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER` **sólo del servidor**, importe `buildSupportWhatsAppHref` desde el entrypoint público `@/features/merchants/server`, arme un mensaje de disputa neutral SIN DNI y pase `supportWhatsAppHref: string | null` al `VehicleForm`. El componente cliente muestra un enlace «Hablar con cadeApp» si es no-null con `target="_blank" rel="noopener noreferrer"`; sin número válido **no** hay enlace y se muestra una alternativa textual deshabilitada/estado de indisponibilidad, igual que en `/merchant/plan`. El mensaje de error de DNI no debe anunciar una salida que no sea alcanzable cuando no hay número; debe contextualizar la disponibilidad.

**Archivos adicionales permitidos:** `src/app/(courier)/courier/onboarding/vehicle/page.tsx` y `page.test.tsx`. El helper existente `src/features/merchants/support-whatsapp.ts` y su export en `server.ts` se reutilizan SIN modificarlos. Pruebas SSR props con número válido/inválido, UI con enlace/ausencia, nunca leer env en cliente ni imprimir DNI en mensaje. Mutación RED: pasar número inválido como si fuera URL, o eliminar prop SSR => falla test positivo. **No ejecutadas.**

## MEJORAS

### PR709-H05 — Mensaje RATE_LIMITED no informa ventana real

`src/lib/error-messages.ts` hoy dice «Esperá unos segundos», pero este caso se restablece por día; el formulario ante un error distinto a DNI/UNAUTHORIZED_ACTOR muestra «Revisá los datos». En el CC/ficha exigir estado específico del formulario para `RATE_LIMITED`: «Alcanzaste el máximo de 5 intentos de alta de hoy. Volvé a intentar mañana.» El mensaje debe ser configurable/testable, evitar prometer recuperación en segundos y no confundir cupo con datos mal cargados. No cambia el código ni la ventana de contador.

### PR709-H06 — Redacción de dependencias y atribución

`T-434.md:3` dice «Dependencias (mergeadas en develop)» e incluye **CC-050**, que sigue en esta misma PR; y el CC dice «lo decide Lautaro073, aquí en automático». Corregir a «dependencias existentes en develop: ...; CC-050 en esta PR pendiente de merge». Registrar expresamente que D4-B/D5-A/D6-A y D1-A/D2-A/D3-A son **selecciones automáticas por autorización permanente, no elección expresa de Lautaro en esta sesión**, sin marcar aprobación humana. El plan/bitácora/cuerpo del PR deben ser consistentes.

## Decisiones y riesgos residuales

- **D4-B, D5-A, D6-A:** resueltas automáticamente conforme instrucción del usuario para esta revisión; recomendadas por separación de superficie de búsqueda, auditabilidad y mitigación inmediata. No atribuir consentimiento personal expreso a Lautaro en este turno.
- **D1-A:** 5 por día y cuenta; ataques multicuenta siguen siendo posibles en principio, condicionados al costo real de crear cuentas; seguimiento abierto en [#680](https://github.com/cadeApp/cadeApp/issues/680). NO afirmar que la existencia de múltiples cuentas demuestra un bypass de 5/cuenta, ni bloquear SEC-09 por un riesgo separado ya aceptado.
- **No hay decisiones abiertas** luego de esta confirmación automática. Los hallazgos anteriores no se autocorrigen: requieren modificar especificación en la rama y segunda revisión.
- **Rollout:** mantener migración + acción en una PR de implementación posterior a merge documental, orden `migrate-develop` antes de preview/deploy; no revertir a oráculo sin advertir el riesgo.

## Estado de ejecución / CI

| Control | Resultado |
|---|---|
| Diff de GitHub y head/base | inspección confirmada, 4 docs, 1 commit |
| Comentarios y carpeta de revisión | sin comentarios técnicos; carpeta nueva |
| Comparación ficha develop vs PR | ficha T-434 inexistente en develop; alcance nuevo |
| Verificación estática del revisor | 6/6 observaciones y 6/6 mutaciones en memoria; no son tests de producción |
| Typecheck / lint / Vitest local / pgTAP | **no corridos** (sin clone con red) |
| «vitest tools 123/123» del autor | declarado en PR/bitácora; **no reproducido** |
| CI / db-tests | no evaluados: bloqueantes presentes |
| `git merge-tree`, `analizar.mjs verificacion` | no corridos localmente; incluir en cierre de siguiente ronda |

**Próximo paso:** prompt acotado en comentario de PR. Revisar SOLO cambios documentales. No acreditar `verificado_en_sha` de arreglos aún no hechos.
