# Informe de revisión independiente — PR #436 / CC-033 / T-376 — ronda 1

**Fecha:** 2026-10-20  
**PR:** https://github.com/cadeApp/cadeApp/pull/436  
**HEAD del autor revisado:** `639ea6dc74ad87a27fb533dfd460d21e72f7dcc8`  
**Base:** `develop` @ `54bbdcd7b079fa208e970725efa66832a8fac724`  
**Resultado:** **CON BLOQUEANTES (3)** — contrato documental, sin cambios ejecutables.

## Alcance y comprobaciones

- Diff: `docs/contracts/CC-033.md` (nuevo, 178 líneas), `docs/tasks/T-376.md` (nuevo, 82 líneas), y una fila T-376 en `docs/implementation-plan.md`; **3 archivos, +261/-0**.
- Consulta al remoto: rama un commit por delante y cero por detrás de `develop` al efectuar la revisión; GitHub indicó `mergeable=true`, lo que **no** significa apta para merge funcional.
- Consultados comentarios del PR: un comentario automático de Vercel, ningún informe sustantivo del autor; sin hilos de revisión.
- Fuente de la ficha: `T-376.md` es **nueva y ausente de develop** (no se puede leer allí). Se revisó la propuesta de la rama del PR. La especificación de CC-025 y las funciones existentes se leyeron desde la base de `develop`.
- Decisión comunicada por Lautaro073 el 2026-10-20: **opción A**; la carga posterior solo se admite con onboarding completo (`couriers.vehicle_type IS NOT NULL`) para repartidores `pending` y `approved`.
- Nivel de evidencia: **[ANÁLISIS]** de textos y código existente, no ejecución de RPC. Se evaluaron tres verificaciones de cobertura documental sobre el contenido real del SHA revisado: las tres faltan. Detalle y comandos en `evidencia/comandos.md`.

## Hallazgos

### PR436-H01 · ALTO, BLOQUEANTE — Guard de onboarding ausente

**Archivo:** `docs/contracts/CC-033.md:61-62`; alcance relacionado `docs/tasks/T-376.md:40-76` y fila T-376 de `docs/implementation-plan.md`.  
**Detección:** [ANÁLISIS]; estado **abierto**, decisión de producto **resuelta** (opción A).

**Diagnóstico.** El paso 4 solo comprueba `couriers.status` distinto de `rejected/suspended`. Un `pending` con `vehicle_type NULL` podría insertar una licencia/seguro antes de terminar el onboarding. La RPC `submit_courier_onboarding_documents` de CC-025 registra el lote inicial y, si ya existe un documento del tipo con distinto `storage_path`, devuelve `VALIDATION_ERROR`. Se abre una ruta de incompatibilidad con el alta posterior. **No se afirma que esta carrera se haya reproducido en DB**; es un riesgo derivado de la especificación y de la implementación vigente.

**Arreglo exacto.** Modificar el paso 4 y Seguridad/permisos de `CC-033.md`: hacer `SELECT profile_id, status, vehicle_type ... FOR UPDATE` en `couriers`; rechazar `rejected/suspended` con `UNAUTHORIZED_ACTOR`; exigir `status IN ('pending', 'approved') AND vehicle_type IS NOT NULL` antes de insertar. Para un courier válido con `vehicle_type IS NULL`, definir `INVALID_STATE_TRANSITION` (el estado de onboarding impide el alta posterior). Conservar el orden `couriers FOR UPDATE -> profiles FOR SHARE -> courier_documents FOR UPDATE` y la comprobación dentro de la RPC (no solo UI). Actualizar Decisiones de producto, pgTAP exigido, ficha T-376 (DoD + visibilidad) y fila de plan, coherentemente. Documentar prueba futura con `pending` incompleto rechazado, `pending` completo aceptado y `approved` completo aceptado; en todos los casos sin cambio de `doc_level` hasta verificación admin.

### PR436-H02 · MEDIO, BLOQUEANTE — Concurrencia prometida sin requisito de prueba multisesión

**Archivo:** `docs/contracts/CC-033.md:88-99,153-169`.  
**Detección:** [ANÁLISIS]; estado **abierto**.

**Diagnóstico.** Con locks ordenados y índice único, el contrato declara qué debería ocurrir en dos altas simultáneas y al competir con suspensión, pero el apartado «pgTAP exigido» no requiere una **prueba real de sesiones concurrentes**. Una prueba secuencial o solo un mock no demuestra espera, serialización ni ausencia de deadlock. Que el contrato existente CC-025 cuente con una integración de concurrencia no verifica la RPC aún inexistente.

**Arreglo exacto.** En `CC-033.md`, agregar a «Impacto exacto — PR de implementación» la futura suite `supabase/tests/integration/cc033_concurrency.mjs` (o ubicación equivalente a justificar). Exigir **dos conexiones PostgreSQL independientes con coordinación determinista por bloqueos, sin sleeps**, y al menos dos escenarios:
1. Mismo courier/kind, dos altas a la vez: al liberar el lock, una crea una sola fila vigente y un evento de auditoría; la otra obtiene `INVALID_STATE_TRANSITION` si usa otro path, o `idempotent: true` si reintenta con el mismo; cero `40P01`.
2. Alta vs. suspensión: si la suspensión se consolida primero, alta rechazada; si alta entra primero, el orden bloquea sin deadlock y mantiene la integridad según estados.
Los tests, sus mutaciones independientes y ejecución corresponden **a la futura PR de implementación**; **no** se crean ni ejecutan en PR #436.

### PR436-H03 · MEDIO, BLOQUEANTE — Rollback incompleto para UI nueva

**Archivo:** `docs/contracts/CC-033.md:119-128`.  
**Detección:** [ANÁLISIS]; estado **abierto**.

**Diagnóstico.** La línea 127 propone `drop function public.add_courier_optional_document(jsonb)` como rollback. Eso solo es seguro mientras no haya interfaz nueva consumiendo la RPC. Luego de desplegar T-376, retirar primero la función deja botones que llaman una función inexistente.

**Arreglo exacto.** Especificar una estrategia ordenada y forward-only: (1) retirar/deshabilitar la acción de carga posterior en UI con un despliegue compatible; (2) verificar que los clientes desplegados no dependen de la RPC (considerar clientes antiguos o caché); (3) solo entonces aplicar una migración posterior que haga `DROP FUNCTION IF EXISTS public.add_courier_optional_document(jsonb)`, si es necesario. Los documentos ya insertados, su auditoría y el flujo admin siguen vigentes. Diferenciar rollback de la etapa de contrato (sin UI aún) y rollback después de T-376. No modificar migraciones previas.

## NO TOCAR — puntos consistentes con la base

- `doc_level` es columna generada por `license_status/insurance_status = verified` en el esquema vigente; no se escribe directamente.
- `replace_courier_document` exige un documento vigente; no sirve para alta posterior de un tipo `none`.
- El `INSERT` directo sobre `courier_documents` está revocado; la RPC debe ser la única ruta.
- `storagePath` con prefijo literal de owner, objeto en bucket privado, estado `submitted` y auditoría sin PII están especificados; no hace falta cambiar esos contratos en esta ronda.

## Verificaciones de esta ronda

| Control | Resultado |
|---|---|
| Alcance contra diff GitHub | **Verificado por inspección:** 3 docs; sin código, SQL o tests |
| Estado de rama vs. develop | **Comparado remotamente:** ahead 1, behind 0 al revisar |
| Check documental H01/H02/H03 | **RED por ausencia de los requisitos** en texto del SHA; no son tests runtime |
| `git diff --check` | Autor declara limpio; **no reproducido por revisor** |
| `pnpm vitest run tools/verify-fichas.test.ts` | Autor declara 7/7; **no reproducido por revisor** |
| `pnpm typecheck/lint/test`, CI, E2E, `db-tests` | **No ejecutados ni exigidos**: documental con bloqueantes |
| Merge / aprobación | **No realizados** |

## Acción para siguiente ronda

Autor: hacer `git pull` del commit de esta revisión (sin rebase/amend/force), corregir solo los tres documentos indicados, pasar verificaciones documentales honestas y publicar nuevo SHA. Luego revisión independiente ronda 2; no editar esta ronda ni marcar los propios arreglos como `arreglado-verificado`.

**No está lista para merge.**
