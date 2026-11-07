# Revisión independiente — PR #489 — Ronda 3

**Fecha:** 21/10/2026 (Argentina)  
**HEAD revisado:** `3a70d5561624d30382bbb48b407ceaea9514c1a0` · rama `docs/T-400-407-fichas` → `develop`  
**Base al comienzo:** `824c4fdb8a4277220e14b575eaf6a15e40df8406` · **develop consultado en R3:** `3db48fbcf9fdebf58648411f8e312a2d94298af3` (merge de PR #497)  
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES**. No aprobación ni merge automático.

## Alcance verificado
- Comparación con el último commit de revisor R2 `c3715379` → `3a70d556`: solo `docs/tasks/T-405.md`, `T-408.md`, `T-409.md` y `docs/implementation-plan.md`; 1 commit del autor. El autor **no** modificó `docs/revision-pr/pr-489/**`.
- Las fichas T-400..T-409 y sus filas de plan se inspeccionaron en el HEAD exacto. Las verificaciones documentales previas se revalidaron sin pedir a agy que escribiera la revisión.
- Fuente externa de las fichas de seguridad: bitácora de T-312 en PR #491 (sigue abierta, SHA `81d3266e`), RLS y funciones de `develop`; PR #497 / CC-036/T-390/T-391 ya **mergeada** a develop durante esta ronda. Son dependencias futuras; esta PR no hace migraciones ni modifica permisos.
- El título y la descripción de la PR se actualizaron por el revisor para mencionar T-400 a T-409 y la procedencia de T-408/T-409. **Cambio solo de metadatos**, no del HEAD.
- El PR no incluye código de producción, test de aplicación, SQL ni cambios a CI. La revisión se limita a corrección/viabilidad de sus **especificaciones**.

## Cierre de los hallazgos R2

| ID | Resultado independiente en `3a70d556` |
|---|---|
| **H13** (T-408) | Matriz por tabla y operación: quitar RLS/grants de UPDATE directos donde la operación requiere RPC auditada, tanto admin `aal1` como `aal2`. Exige camino feliz vía RPC `aal2` con `audit_log` y mutación de restituir UPDATE. |
| **H14** (T-408) | Nota interna aislada en tabla propuesta `merchant_admin_notes` (o alternativa con grants de columnas, `REVOKE SELECT` de tabla), `select *` denegado al comercio, backfill solo con procedencia verificable, pruebas/mutación. Arquitectura final queda a aprobación del futuro CC. |
| **H15** (T-408) | Policy `audit_log_admin` FOR ALL removida; SELECT solo `aal2`; REVOKE INSERT/UPDATE/DELETE/TRUNCATE y control de secuencia; trigger BEFORE UPDATE/DELETE; conservar INSERT legítimo de service role/RPC; pruebas de TRUNCATE y mutación. |
| **H16** (T-405) | `action in ('admin_set_subscription', 'admin_register_plan_period')` en SQL **antes de ordenar y limitar**, además de `target_type` y `target_id`, con fixture de eventos intercalados y mutación. |
| **H17** (T-409) | Ficha paraguas **solo de planificación**: inventario y issues; nuevas fichas y CC en PR documentales independientes según su propio alcance, sin declarar hallazgos técnicos cerrados automáticamente. |
| **H18** (T-409) | SEC-12 sigue identificada como sospecha; exige captura Realtime con actores y datos sintéticos, prueba de regresión del cambio en efectivo y ningún CHECK de NULL sin evidencia. |

No surgieron hallazgos bloqueantes nuevos. H01–H12 continúan corregidos a nivel de especificación, como se documentó en R2; se revalidaron sus cláusulas relevantes en R3.

## Controles del revisor
- Primer item de `## DoD` == celda DoD de `docs/implementation-plan.md`: **10/10** en comparación directa del contenido GitHub. Mutación de **cada primer DoD** únicamente en memoria: **10/10** detectadas.
- Propiedades corregidas H13–H18: revisión independiente del texto exacto y mutación de la cláusula requerida, en memoria, sin tocar archivos; controles positivos y negativos exitosos. En la primera elaboración del detector H15 falló por un patrón incorrecto de backticks (el contenido estaba bien); corregido y vuelto a comprobar. H17 falló al asumir minúscula donde el texto decía «Cada»; se corrigió el instrumento y repitió. H02 necesitó mutar las dos menciones del mismo requisito para que el test negativo fuera sensible. **No se interpretaron errores del detector como errores de producto.**
- No se ejecutaron pruebas locales de Node/pnpm ni pgTAP de T-408/T-409: el repositorio se inspeccionó por el conector GitHub. Los resultados de test citados proceden del runner oficial.
- **CI oficial del HEAD `3a70d556`**: run `39705887020` **success**: unit **155/155 archivos, 3170/3170 tests**, `tools/verify-fichas.test.ts` **7/7**; `typecheck`, `lint`, `build`, `audit`, `bundle-budget` **success**; `db-tests` **34 archivos, 3019 pruebas, Result: PASS** (job `119585708030`). No se dispararon runs manuales.
- Vercel deployment **success**.
- **E2E-preview no verificado:** contexto `error` por el run `39706002645` de `repository_dispatch` **cancelled**. No hay evidencia de un E2E funcional fallido ni de un E2E verde.
- Antes de actualizar el cuerpo de la PR, `approval-policy` marcaba `failure` porque faltaba el informe `SIN BLOQUEANTES` en la sección `### Informe de revisión de agy`. El revisor incorporó el informe honesto al cuerpo sin modificar el HEAD; el resultado posterior queda sujeto a la siguiente evaluación automática del check.

## Notas no bloqueantes
- En el **futuro CC** de T-408 habrá que expresar privilegios de `SEQUENCE` con su sintaxis PostgreSQL (`USAGE`, `SELECT`, `UPDATE`, según corresponda), distinta de las operaciones de tabla. La ficha actual fija el objetivo, no la migración SQL exacta.
- La frase introductoria «Cierra los hallazgos» de T-409 debe interpretarse junto a su Reconciliación/DoD, que dejan **solo la planificación** en esa tarea. Las vulnerabilidades no se consideran cerradas hasta sus hijas con pruebas y auditoría.

## Conclusión y alcance de la autorización
**SIN BLOQUEANTES DOCUMENTALES** para merge cuando se satisfagan las reglas operativas del repositorio. Esta decisión **no** habilita saltear políticas de checks requeridos: el E2E-preview quedó cancelado y su carácter obligatorio debe comprobarse antes de mergear. No se pudo leer la configuración privada de branch-protection (GitHub devolvió 403).

**No se aprobó ni se mergeó la PR.** No se cambiaron tareas de seguridad ni la decisión de riesgo aceptado para el lanzamiento.

## Evidencia reproducible
Ver [comandos.md](../evidencia/comandos.md) y [hallazgos.jsonl](../hallazgos.jsonl). H01–H18 refieren siempre al SHA documental `3a70d5561624d30382bbb48b407ceaea9514c1a0`, con método de validación limitado a documentación.
