# Revisión independiente — PR #381 / CC-025 B0 — Ronda 2

**Fecha:** 2026-10-16 · **SHA funcional auditado:** `d119d0bfe1c79f08a9a56c24e2c63795555d2784` · **PR:** https://github.com/cadeApp/cadeApp/pull/381.
**Dictamen: SIN BLOQUEANTES nuevos DENTRO DEL ALCANCE ADITIVO DE B0, condicionado a los checks del HEAD final. NO equivale a garantía global de unicidad ni autoriza fases B/C.** El revisor no aprobó ni mergeó la PR.

## Resumen del delta y alcance
Se inspeccionaron los commits desde ronda 1 (`164c4761`) y el diff completo contra `develop`. Los cambios efectivos propios de B0 están limitados a la migración no mergeada `20261016033941_cc025_onboarding_atomic.sql`, pgTAP B0, runner real de dos conexiones, contrato y bitácora. Otros cambios del compare desde R1 (CC-027, CC-028, T-358, map/ui) llegaron por **MERGE de develop** y **no forman parte del delta actual de la PR**; no reportar ampliación de alcance por esos archivos. Compare actual: ahead 10, behind 0, GitHub mergeable=true / mergeable_state=unstable (mecánico).

## Seguimiento de hallazgos de la ronda 1

### PR381-H01 — ACEPTADO COMO LÍMITE EXPLÍCITO DE TRANSICIÓN, NO CORREGIDO
El test anterior comprobaba sólo `UNIQUE(storage_path)` con ruta idéntica y escondía el verdadero bypass. Ahora el runner `testCoexistenceDirectInsert()` y pgTAP B0 prueban un **actor authenticated** insertando DIRECTAMENTE `dni_front` con `storage_path` diferente tras la RPC: se obtienen **2 filas vigentes para el mismo kind**. Una llamada posterior de la RPC detecta la ambigüedad y lanza `INTERNAL_ERROR`; **no revierte el INSERT REST anterior**. La RPC toma `couriers FOR UPDATE`, pero NO impone ese lock a writers legacy ni REST. Este resultado es más honesto y reproduce la limitación real de la fase A.

**Dictamen de alcance:** Lautaro073 ya eligió el despliegue expansivo A y la subetapa RPC B0, conservando hasta C los permisos e índices legacy para no romper la app antigua. Por ello B0 puede mergearse como **capacidad aditiva inactiva hasta la app B**, pero **nunca** certificarse como unicidad global de documentos. La **fase C** deberá aplicar el índice único parcial y políticas de inserción/reemplazo, y limpiar backfill. La PR B requiere versión activa de la app nueva efectivamente verificada antes de C. El gate descriptivo del contrato NO es una barrera DB efectiva durante coexistencia: registrar riesgo residual y evitar enviar la app vieja y la nueva mezcladas en releases de staging/main. Si se exige cero duplicados para TODOS los writers incluso antes de C, detener el release y autorizar barrera adicional (índice temprano/trigger temporal). No re-preguntar por la opción A ya aprobada.

**Estado:** `aceptado` como limitación temporal conocida **solo para B0** (no `arreglado-verificado`). H01 global queda como obligación rastreada para CC-025 Fase C.

### PR381-H02 — ARREGLADO POR INSPECCIÓN + CI; verificación funcional propia pendiente
El runner ya **NO** considera cualquier error de `psql` como RED. Muta la definición original de la RPC eliminando `FOR UPDATE`, coordina sesiones y exige **8 filas** de 2 paths distintos como prueba RED; al restaurar la RPC exige **4 filas** y rechazo `VALIDATION_ERROR` del competidor como GREEN. En [CI 38859800234](https://github.com/cadeApp/cadeApp/actions/runs/38859800234), job db-tests, el log confirma **exactamente 8 vs 4**, no un exit=3 arbitrario. Se usa observación de `pg_locks not granted` cuando corresponde en el control positivo. La batería SQL RED→GREEN fue realizada por CI, no por este revisor.

### PR381-H03 — ARREGLADO POR INSPECCIÓN + CI
`submit_courier_onboarding_documents` ahora bloquea `couriers` seleccionando también `status` y rechaza `rejected` o `suspended` con `UNAUTHORIZED_ACTOR` ANTES de insertar. pgTAP añade fixtures rechazado/suspendido, espera 0 filas para ambos y comprueba que `approved` aún puede invocar la RPC. CI pgTAP completo PASS. No se ejecutó mutación propia sobre el guard de status.

### PR381-H04 — ARREGLADO POR INSPECCIÓN + CI
Luego de bloquear `couriers FOR UPDATE`, SQL realiza una segunda lectura de `profiles.role,consent_status FOR SHARE` antes de procesar documentos. El runner B0 coordina dos sesiones: S1 retiene courier lock, S2 empieza RPC y espera, se cambia `consent_status` a pending mientras S2 espera, S1 suelta lock, S2 rechaza con `CONSENT_REQUIRED` y quedan 0 docs. Esto cubre el interleaving original de H04 con `READ COMMITTED`. Vigilar posibles inversiones de orden de locks con workflows administrativos si surgen, sin reportar un deadlock no observado. No se ejecutó por el revisor una mutación SQL adicional de la revalidación.

## CI consultado sobre el SHA real
[Run 38859800234](https://github.com/cadeApp/cadeApp/actions/runs/38859800234), sobre `d119d0bfe1c79f08a9a56c24e2c63795555d2784`, completo y SUCCESS:
- Unit: **135 suites / 2382 tests PASS**.
- pgTAP: **Files=26, Tests=2341, Result=PASS**, incluidos los casos B0 añadidos.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy`: SUCCESS.
- B0 runner dos sesiones confirma rutas iguales, rutas distintas, bypass REST alternativo, revocación concurrente y mutación RED 8 → GREEN 4. `db:types --local` ejecutado.
- No se realizó Supabase/Docker/SQL por el revisor (decisión expresa de costo): se inspeccionaron código y logs oficiales. No asignar `verificado_en_sha` a partir de CI del autor ni de simples coincidencias.

## Gate de merge y continuidad
1. **B0 #381**: apta por revisión **solo si todos los checks del HEAD final posterior al commit de revisión vuelven a pasar**, sin alteración del alcance. Su merge exige autorización explícita de Lautaro073; esta revisión NO mergea ni aprueba.
2. **App B #376**: permanece bloqueada hasta tener B0 integrada y realmente aplicada en la base del ambiente donde se desplegará B. Conectar `.rpc('submit_courier_onboarding_documents')` y evitar `INSERT` documental directo en Server Action. Testear actor/consent, retries, paths diferentes y doble envío bajo dos sesiones; comprobar que app nueva requiere fase A y B0.
3. **C #364**: no promover hasta tener writer nuevo **efectivamente desplegado y con versión activa comprobada** en cada ambiente; al aplicar C, backfill + índice UNIQUE por courier/kind + restricciones RLS y revocación UPDATE/DELETE. Validar que no hay duplicados que impidan el índice y que ningún writer legacy sigue activo.
4. **T-356 #358** permanece bloqueada y el issue #363 abierto hasta que A/B0/B/C terminen según dependencia. No promocionar `develop` a `staging` o `main` saltándose etapas.

**No se exigen nuevas decisiones de producto para revisar B0.** La garantía global durante coexistencia requiere nueva autorización SÓLO si se desea antes de fase C.

[Prompt de continuidad](../prompt-agy-ronda-2.md) · [evidencia R2](../evidencia/ronda-2.md) · [hallazgos](../hallazgos.jsonl).