# Informe de revisión independiente — PR #587 / T-421 · Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/587
**Head SHA revisado:** `9f87b18f79525e64f4ac8c2ec9b9ae7e9e206c3f`
**Base:** `develop` @ `146c9f9749dbc7fa20b63583cbc9b3c939cdc339`
**Fecha:** 2026-11-04
**Resultado:** CON BLOQUEANTES (6), MEJORAS (1). No aprobar ni mergear.

## Alcance y hechos comprobados

Diff remoto: 6 archivos, +560/-24, exclusivamente `docs/contracts/CC-043.md`, `CC-044.md`, `docs/tasks/T-421.md`, `T-403.md`, `T-404.md` y `docs/implementation-plan.md`. La ficha `T-421` no existe todavía en `develop` (se incorpora por esta PR). Las fichas T-403/T-404 se compararon contra `develop`, sin hallar implementación oculta ni ampliación no declarada de su UI. Rama ahead=1, behind=0, mergeable según GitHub; `git merge-tree` no ejecutado. Sin comentarios humanos de review; un comentario de Vercel. No existe todavía `docs/tasks/log/T-421.md` (la implementación no comenzó) ni `docs/revision-pr/pr-587` previo al commit de esta ronda.

Decisiones ya resueltas por Lautaro073: **D01=C**, **D02=C**, **D03=A**; no queda decisión por pedir. La solución completa debe ser documentada antes de implementar T-421. Cada hallazgo es `[ANÁLISIS]` de contratos/código vigente; **no** es un fallo runtime reproducido del SQL nuevo, que no existe.

## Bloqueantes

### PR587-H01 — La RPC de finalización explícita no está especificada ni autorizada por la ficha
**Archivo:** `docs/contracts/CC-043.md:37-54`; `docs/tasks/T-421.md:49-69`. **Severidad:** alto. **Patrón:** P10-desvio-de-ficha-sin-consultar.

**Diagnóstico [ANÁLISIS]:** el contrato de HEAD sigue fijando `submitted_at` en el cambio `vehicle_type:null→valor` mediante un trigger. Lautaro073 eligió reemplazarlo por `finalize_courier_application`, con `application_submitted` independiente. La ficha prohíbe editar `courierOnboardingAction` y omite sus tests; de seguirla literalmente no se puede implementar D01. **Corrección:** RPC privilegiada bajo lock CC-025, validación de rol/consentimiento/estado/documentos/HMAC, escritura de marca y fecha en transacción; definir inputs, salida, permisos, error de DNI duplicado, pruebas y allowlist de action/tests y lectores necesarios. Mantener solo documentos en PR #587.

### PR587-H02 — Reintento de una postulación histórica fabricaría fecha
**Archivo:** `docs/contracts/CC-043.md:41-54,107-118`; `docs/tasks/T-421.md:77-88`. **Severidad:** alto. **Patrón:** P08-control-no-cubre-lo-que-dice.

**Diagnóstico [ANÁLISIS]:** el nuevo diseño propuesto como D01-C usa `submitted_at=coalesce(submitted_at,now())`, mientras D02-C marca históricos con `application_submitted=true` y `submitted_at=null`. En un reintento sobre histórico inventaría fecha actual; esto **no está implementado en HEAD**, es un defecto demostrado de la especificación propuesta. **Corrección:** solo `false→true` establece `now()`; si ya era true, devolver `idempotent:true` sin escribir fecha. Comparar payload: si cambian campos no idempotentes, rechazar o usar flujo legítimo de modificación. Pruebas históricas, concurrentes y mutación de `coalesce`.

### PR587-H03 — Falta migrar todos los lectores del marcador de onboarding
**Archivo:** `docs/tasks/T-421.md:49-69`; código vigente `src/features/auth/{guards,server,actions}.ts` en develop. **Severidad:** alto. **Patrón:** P06-enumeracion-incompleta.

**Diagnóstico [ANÁLISIS]:** `parseOnboardingComplete` usa `vehicle_type`, `updateSession` selecciona `vehicle_type` y `loginAction`/`updatePasswordAction` hacen lo mismo. Con CC-042 un repartidor podría tener vehículo pero no finalización, dejando la cola administrativa y la navegación en desacuerdo. **Corrección:** `application_submitted` canónico para courier en los tres flujos y todos sus tests, preservando `undefined` en fallos según T-334. Confirmar retorno de histórico y la prohibición de acceder a `/courier/onboarding/status` si false.

### PR587-H04 — El flag de `set_config` no es una garantía de origen privilegiado
**Archivo:** `docs/contracts/CC-043.md:47-67`; nueva especificación D01-C. **Severidad:** alto. **Patrón:** P20-justificacion-de-seguridad-no-escrita.

**Diagnóstico [ANÁLISIS]:** el uso propuesto de `set_config('...', ..., true)` es de alcance transaccional, pero las custom GUC de PostgreSQL pueden fijarse con SQL ordinario. No constituye por sí solo una autorización infranqueable. No se ha demostrado un bypass desde el PostgREST actual y **no se afirma que exista esa vía**. **Corrección:** diseñar matriz de EXECUTE y grants/guard por columnas o por rutina; ejecutar RPC solo con `service_role`; validar el origen de `p_courier_id` en la server action y probar acceso directo `authenticated`, admin y service_role, incluida una tentativa explícita de manipulación de flag por SQL. Aclarar límite de protegerse de un rol con poderes administrativos.

### PR587-H05 — Compatibilidad CC-042 y fixtures no reconciliados con D01-C
**Archivo:** `docs/contracts/CC-043.md:91-97`; `docs/tasks/T-421.md:69,150-151`. **Severidad:** medio. **Patrón:** P06-enumeracion-incompleta.

**Diagnóstico [ANÁLISIS]:** CC-042 usa `add_courier_vehicle` antes de completar documentos; la nota actual pide que T-419 corrija el trigger por cambio de vehículo. Eso deja de ser cierto con D01-C. Además el E2E vigente `e2e/specs/courier-onboarding.spec.ts`, función `resetCourierToPendingOnboarding`, borra vehículo/DNI por UPDATE directo; con marcador persistente podría dejar `application_submitted=true` y falsa precondición. **Corrección:** documentar secuencia de ambos onboards, coordinación issue #573, nueva estrategia para fixture de postulación completa por RPC, limpieza consistente, allowlist de `src/server/e2e/staging-seed.ts`/test y E2E correspondiente, sin abrir bypass solo para tests.

### PR587-H06 — CC-044 sobredeclara protección MFA general
**Archivo:** `docs/contracts/CC-044.md:16-19,109-116,156-168`. **Severidad:** medio. **Patrón:** P20-justificacion-de-seguridad-no-escrita.

**Diagnóstico [ANÁLISIS]:** la RPC con `assert_admin_aal2()` impide el acceso por **esa función**, pero en develop `profiles_select_admin`, `couriers_select_admin` y `courier_documents_select_admin` siguen usando `is_admin()` sin MFA. La ficha T-408 reconoce expresamente SEC-01 y el riesgo aceptado el 2026-10-21. **Corrección decidida D03=A:** redactar matriz que distinga RPC y acceso directo; no tocar RLS en T-421 y conservar riesgo en T-408. Tests de ambos caminos cuando se implemente.

## Mejora

### PR587-H07 — Diagnosticar falsos positivos del backfill histórico
**Archivo:** `docs/contracts/CC-043.md:107-118` y futuro DoD de T-421. **Severidad:** bajo. **Patrón:** P06-enumeracion-incompleta.

La decisión D02-C es backfill `application_submitted=true` cuando `vehicle_type IS NOT NULL`. Es compatible con el marcador de T-334, **pero** la policy vigente `couriers_update_self` permite modificar `vehicle_type` directamente, por lo que esa condición no prueba por sí sola la presencia histórica de cuatro documentos. Conservar la decisión; añadir diagnóstico de inconsistencias y evitar llamarlas «envíos históricos verificados» sin evidencia. Pruebas del caso representativo de fila con vehículo y documentos faltantes; no inferir fecha.

## NO TOCAR — aciertos y límites

- La búsqueda de CC-044 normaliza tanto término como nombre y trata `%/_` como literales (no SQL LIKE).
- Cursor keyset `created_at DESC, profile_id DESC` con desempate, total exacto filtrado, paginación reversible: bien especificado.
- No introducir `pg_trgm` para volumen pequeño es razonable hasta tener mediciones.
- No copiar `profiles.created_at` a `submitted_at`; sin backfill de **fecha**.
- No modificar SQL, auth ni E2E en esta PR **documental**. Solo ampliar la ficha para T-421.
- La descripción de PR reporta `91 passed` en Vitest; **no se reprodujo independientemente**. No existe código SQL nuevo que ejecutar aún.

## Evidencia / estado de checks

| Control | Resultado | Alcance |
|---|---|---|
| Diff, lectura de contrato y fuentes en develop | ✅ por GitHub | 6 archivos documentales, referencias verificadas |
| Batería independiente de texto (8 casos) | ✅ 8 GREEN / 8 RED en memoria | Solo detecta alteraciones de proposiciones documentales existentes |
| `git fetch`, `git merge-tree` en clon | No ejecutado | Resolver DNS a github.com falló |
| `pnpm typecheck`, lint, test, pgTAP | No ejecutado | Clon no disponible y sin implementación en PR |
| CI de aprobación | No evaluado | Hay bloqueantes; no usar color de checks como aprobación |
| `verificado_en_sha` | `null` | Ningún arreglo comprobado |

## Criterios de cierre R2

Se corrigieron los seis bloqueantes en el contrato y se cotejaron las modificaciones de la ficha T-421. Reproducir pruebas de formato documental; luego, en PR de implementación T-421, SQL/pgTAP con bypass, pruebas de action/auth y E2E con RED auténtico. Un documento que afirma futuras pruebas no equivale a haberlas corrido.

**El prompt detallado para agy está en el comentario de cierre de PR #587, junto al resumen de esta misma ronda.**
