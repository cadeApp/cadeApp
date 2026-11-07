# Revisión independiente — PR #489 — Ronda 1

**Fecha:** 2026-10-21 (Argentina)  
**SHA revisado:** `25ad3cf36cf580bdc632448ad88d926220b1dec6`  
**Base:** `develop@824c4fdb8a4277220e14b575eaf6a15e40df8406`  
**Autor:** Lautaro073 · **Revisor:** revisión independiente de cadeApp  
**Resultado:** **CON BLOQUEANTES — NO MERGEAR**

## Alcance y método
PR de documentación: 9 archivos y 911 líneas añadidas, sin código ni esquema editados. Leídos en develop: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `AGENTS.md`, `docs/design/stitch/04-admin.md`, fichas originales T-350..T-389 de interés, y contratos de código/esquema de la app actual. Contrastadas las 8 nuevas fichas, la fila del plan y los comentarios del PR. No existe carpeta previa `pr-489`. Estado GitHub: head remoto coincidente; `mergeable=true` al inicio. No se ejecutaron unitarios ni db locales porque esta sesión no posee clon accesible por red; la evidencia de ejecución procede de los jobs oficiales del SHA y se identifica como tal.

## CI comprobado en HEAD revisado
- **unit ❌**: `tools/verify-fichas.test.ts` falla en el test «el primer ítem del DoD de cada ficha coincide con su fila del plan»; enumera las ocho T-400..T-407. Resumen oficial: **1 failed / 3169 passed**.
- **typecheck ✅, lint ✅, build ✅, audit ✅, db-tests ✅, bundle-budget ✅** (jobs del workflow CI `39696803014`, SHA revisado).
- **Vercel ✅**; `e2e-preview` reporta error porque su ejecución se canceló (no equivale a pruebas E2E rojas por una aserción ni a verde).
- Según protocolo, la ronda bloqueada es sobre todo estática; leer CI aquí permite demostrar el bloqueante explícito H01. No atribuir falsos RED a hallazgos puramente de documentación.

## Decisiones ya resueltas por Lautaro073 (no volver a preguntar)
- **D01=C**: normalización en PostgreSQL, issue #498; no filtrar por `ilike` simple, ni cliente.
- **D02=C**: timestamp real de presentación, issue #499; no utilizar `profiles.created_at` bajo etiqueta «Enviado».
- **D03=C**: 3 pestañas independientes en incidentes (Abiertos=open/reviewing, Resueltos=resolved, Desestimados=dismissed).

## Hallazgos (las líneas corresponden al SHA revisado)
### 1. PR489-H01 — ALTO — Las ocho fichas rompen sincronización de DoD con el plan
**Lugar:** `docs/tasks/T-400.md:64` · **Tarea:** T-400–T-407 · **Detección:** CI oficial en rojo + inspección.

**Diagnóstico y evidencia:** CI unit en SHA 25ad3cf: tools/verify-fichas.test.ts, 1 fallo; T-400..T-407; 3169 tests pasaron. Línea exacta del DoD difiere de celda [6] del plan.

**Arreglo exigido:** En docs/implementation-plan.md, igualar la sexta celda de cada una de las 8 filas con el primer renglón - [ ] del DoD en su ficha, carácter por carácter; no modificar tools/verify-fichas.test.ts. Volver a ejecutar pnpm exec vitest run tools/verify-fichas.test.ts.

**Verificación:** Repetir exactamente el caso tools/verify-fichas.test.ts sin alterar expectativas y registrar línea de resumen.

### 2. PR489-H02 — ALTO — Búsqueda sin tildes carece de contrato de base de datos
**Lugar:** `docs/tasks/T-403.md:65` · **Tarea:** T-403 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** La ficha exige consulta DB accent-insensitive; queries.ts actual filtra couriers sin normalización; las migraciones no definen unaccent. Decisión D01=C; issue #498.

**Arreglo exigido:** Añadir dependencia expresa de CC propuesto #498, no construir búsqueda hasta que el CC con migración y pruebas RLS esté aprobado/mergeado; describir filtrado sobre nombres normalizados en SQL antes de contar/paginar, nunca ilike puro ni filtrar cliente. Mantener T-403 como postlanzamiento.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 3. PR489-H03 — ALTO — «Enviado» no tiene timestamp real ni fuente confiable
**Lugar:** `docs/tasks/T-403.md:67` · **Tarea:** T-403/T-404 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** getApplicantsQueue usa profiles.created_at; couriers schema no posee submitted_at. Decisión D02=C; issue #499.

**Arreglo exigido:** Vincular T-403 y T-404 a CC propuesto #499; hasta su merge no declarar envío real. Especificar submitted_at fijado por evento transaccional de primer envío, backfill desconocido/null sin inventar fecha, y pruebas de reenvíos.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 4. PR489-H04 — ALTO — Historial pide eventos que audit_log no emite
**Lugar:** `docs/tasks/T-404.md:74` · **Tarea:** T-404 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** En esquema audit_log guarda eventos escritos explícitamente por RPC; no hay evento general de creación de usuario o primera entrega documental que corresponda al relato propuesto.

**Arreglo exigido:** Precisar: «Registrado» desde profiles.created_at etiquetado como registro; «Postulación enviada» desde #499 submitted_at si existe; demás eventos solo audit_log reales por actor/target (incluidos documentos vía ID y courier_id en JSON). No fabricar eventos; documentar ausencias; ordenar por timestamps reales.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 5. PR489-H05 — ALTO — Enlace por comercio exige filtro inexistente; periodos no son legibles por sesión admin
**Lugar:** `docs/tasks/T-405.md:63` · **Tarea:** T-405/T-407 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** AuditFilters admite actor/action/targetType, no targetId; merchant_plan_periods_no_client_access impide SELECT directo. El enlace «Ver todo en Auditoría» filtrado por comercio no puede funcionar con los contratos actuales.

**Arreglo exigido:** Elegir audit_log filtrado por target_type=merchant y target_id=merchantId; ampliar T-407 con targetId UUID validado y pruebas, y hacer T-405 depender de T-407, o incluir los archivos del filtro en T-405 (recomendación: primera). La vista de últimos 5 movimientos debe usar auditoría, no SELECT directo a merchant_plan_periods.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 6. PR489-H06 — ALTO — «Resueltos» agruparía también incidentes desestimados
**Lugar:** `docs/tasks/T-406.md:60` · **Tarea:** T-406 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** INCIDENT_TAB_STATUSES.closed = [resolved,dismissed] en src/features/incidents/schemas.ts; la ficha pide renombrar a «Resueltos» sin tocar filtro. Decisión D03=C.

**Arreglo exigido:** Cambiar contrato a tres pestañas: Abiertos=open+reviewing, Resueltos=resolved, Desestimados=dismissed. Añadir schemas.ts + schemas.test.ts a archivos permitidos, actualizar copy, consultas y E2E; contadores por conjunto, no mezclar dismissed.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 7. PR489-H07 — ALTO — Límite inclusivo lte pierde registros con fracciones de segundo
**Lugar:** `docs/tasks/T-407.md:65` · **Tarea:** T-407 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** La ficha exige gte/lte del «borde del día» y su nota indica 23:59:59, pero created_at es timestamptz con precisión subsegundo.

**Arreglo exigido:** Filtrar [inicio del día local, inicio del día siguiente local) usando .gte('created_at',startUTC).lt('created_at',endUTC), no lte 23:59:59. Para 21/10/2026: [2026-10-21T03:00:00Z,2026-10-22T03:00:00Z). Probar 02:59:59.999Z incluido y 03:00:00Z excluido.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 8. PR489-H08 — MEDIO — Test de cobertura de auditoría no cubre todo el contrato de eventos
**Lugar:** `docs/tasks/T-400.md:72` · **Tarea:** T-400 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** Migraciones escriben target_type incident/publication_plan/push_subscription y acciones dinámicas p_action; ADMIN_COPY.audit.entities/AUDIT_TARGET_TYPES no contienen todos los tipos, y un barrido solo de literales puede omitir acciones dinámicas.

**Arreglo exigido:** Enumerar todas las clases de escrituras a audit_log (VALUES, SELECT, expresiones dinámicas con dominios acotados), acciones + target types vigentes y etiquetas en copy. Expandir T-400 archivos permitidos con schemas.ts/schemas.test.ts si el filtro de entidades se amplía. Control independiente con mutaciones de quitar acción y entidad.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 9. PR489-H09 — MEDIO — DoD E2E nuevos sin archivos de spec permitidos
**Lugar:** `docs/tasks/T-402.md:68` · **Tarea:** T-402/T-403 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** T-402 exige un spec E2E nuevo que recorra cinco secciones; permite solo e2e/pages/admin.page.ts. T-403 pide E2E de búsqueda/conteo y tampoco permite nuevo spec.

**Arreglo exigido:** Agregar paths exactos e2e/specs/admin-nav-mobile.spec.ts para T-402 y e2e/specs/admin-applicants-search.spec.ts para T-403, o especificar con precisión un spec existente donde se extienda. No permitir globs generales innecesarios.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 10. PR489-H10 — MEDIO — La transformación trunca target_id antes de resolver nombres
**Lugar:** `docs/tasks/T-400.md:68` · **Tarea:** T-400 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** getAuditLog.toAuditLogItem produce targetRef con target_id.slice(0,8), no preserva ID íntegro para batched lookups. Courier document puede referenciar courier_id en before y fila borrada.

**Arreglo exigido:** Resolver referencias en servidor contra IDs íntegros antes de construir AuditLogItem; agrupar una consulta por tipo y documentar fallback seguro al id corto; no entregar ids o PII adicional al navegador ni usar service_role.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 11. PR489-H11 — BAJO — El visor ya tiene zoom, rotación, reset y pestañas
**Lugar:** `docs/tasks/T-404.md:76` · **Tarea:** T-404 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** src/features/admin/components/applicant-detail-view.tsx ya define selectedDocId, zoomLevel, rotation, ROTATION_CLASSES, ZOOM_CLASSES y controles de UI.

**Arreglo exigido:** Redactar como preservar y probar funcionalidad existente al reordenar A02; no implementar visor duplicado ni romper URL firmada de 60s y auditoría.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.

### 12. PR489-H12 — BAJO — Resumen omite el estado cancelled al definir filtros
**Lugar:** `docs/tasks/T-405.md:61` · **Tarea:** T-405 · **Detección:** Inspección estática.

**Diagnóstico y evidencia:** merchant_subscription_status tiene pilot, active, expired y cancelled; la ficha solo fija chips para tres de ellos.

**Arreglo exigido:** Indicar filtro Todos que conserva cancelled en tabla, o control explícito Cancelados; los tres conteos no deben absorber cancelled ni ocultarlo accidentalmente.

**Verificación:** Añadir caso documental o de test futuro relevante al DoD y validarlo cuando la tarea de implementación/CC se ejecute. No afirmar haber obtenido RED local en esta ronda.


## NO TOCAR
- Ningún archivo de implementación `src/**`, `supabase/**`, `e2e/**` o contratos se cambia en la PR #489. Solo corregir el **plan** y las **ocho fichas**; las migraciones y tests pertenecen a tareas/CC posteriores.
- No modificar `tools/verify-fichas.test.ts` ni expectativas para esconder H01.
- No borrar la carpeta de la revisión independiente ni hacer que agy la rellene o «verifique» hallazgos.
- No exigir que los E2E de implementación de Fase 4 estén verdes ahora: aún son especificaciones; sí validar que las fichas indiquen rutas, casos y mutaciones correctas.
- No se pide la creación de test rojo falso, ni se confunde `e2e-preview` cancelado con un fallo funcional.

## Por qué CI verde no basta
Aquí CI **no está verde**: falla el test contractual del plan. Los tests de implementación existentes no pueden validar requisitos de tareas todavía sin implementar. Una futura corrección del formato puede dejar verdes los checks y mantener errores semánticos; por eso se exige revisión específica de los hallazgos H02–H12.

## Siguiente ronda
El autor debe corregir solo documentación, aportar `git ls-remote` y CI de la revisión si está disponible, y pedir ronda 2. El nuevo SHA será distinto del verificado aquí. D01/D02 se implementan **después** mediante CC independientes.

Evidencia y comandos reproducibles: [evidencia/comandos.md](../evidencia/comandos.md). Hallazgos estructurados: [hallazgos.jsonl](../hallazgos.jsonl).
