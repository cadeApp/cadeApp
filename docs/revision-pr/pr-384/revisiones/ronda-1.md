# Informe revisar-pr — PR #384 / T-357 — Ronda 1

**Fecha:** 2026-10-16. **Revisor:** revisión independiente. **SHA del código inspeccionado:** `d7347c9f1e37d6c6c350389228f88a9aa6c25722`. **Rama:** `feat/T-357-actualizar-vehiculo-perfil`. **Base actual examinada:** `develop` (`af0cf1d7`). **Resultado: CON BLOQUEANTES (5).**

## Fuentes y alcance

Se leyeron `AGENTS.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, ficha `docs/tasks/T-357.md` **desde develop**, bitácora del HEAD, issue #344, diff completo de la PR, CC-025, D9 y políticas de RLS. Los 12 archivos cambiados (antes de esta revisión) coinciden con «Archivos permitidos». No hubo cambios a `src/domain/**`, `src/ui/**`, migraciones, dependencias ni tipos generados. La comparación informó rama 1 commit detrás de develop, mergeable según GitHub; **no se ejecutó git merge-tree local** (clon no disponible).

**Decisiones del usuario:** 1-A conservar aprobación; 2-A separar edición de vehículo y gestión documental. El plan maestro D9 considera licencia/seguro **opcionales**. Ninguna otra decisión necesaria en esta ronda.

## Hallazgos BLOQUEANTES (citas al SHA anterior)

### PR384-H01 — ALTO — el modo edición salta el onboarding

**Archivo:** `src/app/(courier)/courier/onboarding/vehicle/page.tsx:37`; `src/features/courier-onboarding/actions.ts:254-260,295-310`.
**Evidencia [ANÁLISIS + inspección]:** la página define `isEditing = Boolean(courier?.vehicle_type) || mode === 'edit'`. Para un courier que tiene fila `couriers` pero `vehicle_type = null` (onboarding incompleto según T-334), el parámetro controlado por el usuario habilita edición. Además, la Server Action recibe el payload mínimo sin DNI/consentimientos, encuentra la fila y puede persistir `vehicle_type` no nulo. Esto convierte el marcador de onboarding a «enviado» sin flujo de alta; ni esconder `?mode=edit` ni un guard cliente alcanzan.
**Arreglo:** servidor: la acción debe verificar el marcador `existingCourier.vehicle_type !== null` y la elegibilidad/consentimiento vigente que ya exige el contrato, antes de cambiar la fila; si no está completo, devolver un error tipificado sin escribir. Página: solo habilitar edición si el registro real tiene vehículo, **nunca** por query param. Conservar onboarding normal para incompletos y el marcador original. No cambiar `couriers.status` para repartidores aprobados (1-A).
**Pruebas RED→GREEN:** un courier recién creado con `vehicle_type:null` intenta `updateCourierVehicleAction({vehicleType:'bike'})` → rechazo sin update; mismo caso con `?mode=edit` renderiza alta, no edición. Mutación: eliminar guard server de completitud debe poner rojo el test.

### PR384-H02 — ALTO — documentos editados con UPSERT directo

**Archivo:** `src/features/courier-onboarding/actions.ts:265-292`; `src/features/courier-onboarding/components/vehicle-form.tsx`; `src/features/courier-onboarding/schemas.ts`.
**Evidencia [ANÁLISIS]:** `updateCourierVehicleAction` hace `courier_documents.upsert(documentEntries)` en edición, con `status:'submitted'`, sin distinguir documento vigente, rechazado o validado, sin control de reemplazo/auditoría y sin sincronizar `couriers.license_status`/`insurance_status`. El contrato CC-025 define reemplazo de documentos por RPC especializada; su PR #364 aún estaba abierta durante la inspección. En el esquema expandido la operación directa inserta nuevos registros por ID nuevo y no implementa el reemplazo contractual.
**Arreglo conforme decisión 2-A:** eliminar **solo del modo edición** la carga opcional de licencia/seguro y las mutaciones `courier_documents`. `updateCourierVehicleAction` debe recibir únicamente `vehicleType` y `vehiclePlate` y rechazar o ignorar explícitamente cualquier `documents` sin escritura; preferir Zod estricto y test adversarial. Conservar subidas opcionales en **onboarding inicial** y no tocar T-356 ni CC-025. Si hace falta explicar documentación, enlazar el flujo existente sin inventar rutas.
**Pruebas RED→GREEN:** payload con `documents` malicioso no provoca ninguna lectura/escritura en `courier_documents`; edición moto/auto no ofrece tarjetas de carga; onboarding original aún permite documentos opcionales. Mutación: volver a llamar `upsert` debe matar una prueba.

### PR384-H03 — MEDIO — falso éxito por UPDATE de cero filas

**Archivo:** `src/features/courier-onboarding/actions.ts:295-313`.
**Evidencia [ANÁLISIS]:** `.update(...).eq('profile_id',user.id)` solo comprueba `error` y no el número de filas afectadas. Entre lectura y actualización puede desaparecer o cambiar la fila: PostgREST puede devolver `error:null` cuando actualiza 0. Los mocks del autor siempre devuelven `{error:null}` sin verificar persistencia.
**Arreglo:** agregar `.select('profile_id').maybeSingle()` (o resultado equivalente) al UPDATE y exigir fila devuelta; caso cero filas → `NOT_FOUND`/código coherente sin `ok`. Nunca cambiar `status` (1-A). Separar fallo de DB de ausencia de fila.
**Pruebas RED→GREEN:** `{data:null,error:null}` luego del UPDATE → no éxito; `{data:{profile_id:user.id},error:null}` → éxito; `{error:{...}}` → `INTERNAL_ERROR`. Mutación: eliminar comprobación `data` debe dar rojo.

### PR384-H04 — ALTO — pruebas y DoD no demostrados

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:743-805`; `docs/tasks/log/T-357.md` y cuerpo de la PR.
**Evidencia [ANÁLISIS + CI]:** el E2E agregado prepara una moto vía cliente admin (sin comprobar el error del seed), cambia **solo a bicicleta**, y comprueba «Bicicleta» después de navegar al perfil. No recarga de manera explícita, no compara columnas por cliente autenticado, no comprueba vista de viaje/proyección de comercio, no cubre walk/moto/car ni reintentos/autorización/consentimiento. El autor declara DoD y E2E verdes sin run de Preview exitoso del SHA. El build de `07966a2` estuvo rojo por PageProps; en `1abebcd` el build fue verde, lo que se reconoce como arreglo del autor. Al abrir esta ronda el CI del SHA siguiente todavía no acreditaba una ejecución E2E verde.
**Arreglo:** robustecer fixtures segregadas E2E; verificar errores del seed, preparar estado real, probar cada transición relevante (walk,bike,moto,car, patente válida/inválida), recargar perfil explícitamente, contrastar persistencia con `supabase` del usuario y proyección de viaje si el fixture lo permite, no alterar tests para hacerlos pasar. Registrar **SHA, run, job y resultado reales de Preview** antes de marcar DoD completo. Un caso bloqueado debe quedar pendiente y **no** marcado ✓.
**Pruebas RED→GREEN:** mutación de guardar solamente en cliente (desactivar UPDATE real) tiene que fallar después de recargar; mutación que ignora los cambios del form debe fallar; test de otro courier exige 0 cambios.

### PR384-H05 — MEDIO — falla de lectura convertida en alta

**Archivo:** `src/app/(courier)/courier/onboarding/vehicle/page.tsx:25-37`.
**Evidencia [ANÁLISIS]:** se ignora `error` de `maybeSingle()`. Si falla la lectura de `couriers`, el resultado `courier:null` habilita `isEditing:false` por defecto y presenta onboarding sin informar error; puede inducir reenvío indebido de documentación. Distinto de un registro real sin `vehicle_type`.
**Arreglo:** manejar explícitamente error de lectura (error boundary o estado recuperable claro), sin reclasificar silenciosamente como alta. Mantener navegación auténtica y no crear nuevo estado global.
**Pruebas RED→GREEN:** `maybeSingle()` devuelve `{data:null,error:Error}` → no renderizar el modo de alta como si no existiera error. `{data:{vehicle_type:null},error:null}` → alta; `{data:{vehicle_type:'moto'},error:null}` → edición. Mutación: suprimir rama `error` pone prueba roja.

## Incidente de proceso AG-36 — autorrevisión en carpeta independiente

El autor escribió `docs/revision-pr/pr-384/revisiones/ronda-1.md` y la tituló «Revisión independiente», con «SIN BLOQUEANTES» en `07475bb0`, aunque el build posterior dio rojo y esta revisión encuentra defectos. Se conserva el archivo original con una nota de procedencia en `autorrevision-agy-r1.md` y esta es la primera ronda **independiente**. El autor NO debe editar `docs/revision-pr/**` ni certificar `verificado_en_sha`. Los arreglos y resultados se informan en su bitácora.

## NO TOCAR — verificaciones negativas

- No exigir licencia/seguro por moto o auto; D9 establece que son opcionales. `doc_level` depende de verificación admin, no de transporte.
- No revocar `approved` solo por cambiar vehículo, ni tocar RPC/SQL/RLS/tipos/dominio: decisión 1-A.
- No convertir T-357 en implementación CC-025: decisión 2-A.
- No cambiar el onboarding inicial al retirar documentos del **modo edición**.
- No tratar el bug de build de `07966a2` como abierto en `1abebcd`: su job `build` pasó a success; el agente mejoró ese punto entre las lecturas.

## Evidencias y checks

| Control | Evidencia concreta | Alcance |
|---|---|---|
| `unit` del SHA `07966a2` | success en CI; el autor informa 136 suites / 2438 tests | no comprueba H01–H05 |
| `db-tests` del SHA `07966a2` | `Files=26, Tests=2341, Result: PASS`; tipos sin diff | sin contrato nuevo de T-357; no autoriza escritura de documentos en edición |
| `build` del SHA `07966a2` | fail por `PageProps | defectuoso en ese SHA |
| `build` del SHA `1abebcd` | success | error anterior corregido |
| `unit` / `db-tests` del SHA `1abebcd` | cancelled tras nuevo push | no afirmar PASS en ese SHA |
| E2E Preview de T-357 | sin resultado ejecutado y verde acreditado para el SHA revisado | **pendiente** |
| Mutaciones del revisor | 5 controles estáticos GREEN originales → RED mutantes | **no** son tests de runtime. Script completo en evidencia |

**No se ejecutó localmente `pnpm test`, `pnpm build`, E2E, Docker ni Supabase:** el entorno no dispone de clon ni de acceso a npm; los tests citados proceden de logs de CI y las mutaciones estáticas del analizador independiente. La carpeta de revisión se agrega después del código revisado, por lo que el SHA nuevo de commit de documentación NO se debe usar como `verificado_en_sha`. Todas las correcciones siguen **abiertas**.

## Verificación para la siguiente ronda

1. Confirmar HEAD y base; leer bitácora y comentarios; revisar si el autor volvió a tocar `docs/revision-pr/**`.
2. Probar la matriz del DoD por las 4 movilidades, formato AR, payload directo, consentimiento vigente, estado y carrera de fila, con mutaciones independientes del autor.
3. Exigir GREEN previo de cada control, RED ante mutación y GREEN después de corregir. No se permiten falsos mocks, modificaciones de snapshots/expectativas por conveniencia, `skip`, `only` ni timeouts maquillados.
4. Correr typecheck/lint/unit/build y E2E Preview de SHA nuevo, revisar logs específicos y, si corresponde, DB CI. Registrar números.
5. Verificar merge-tree contra develop y no atribuir a este SHA validaciones que no corrieron.

**Resultado de ronda 1:** 5 BLOQUEANTES, 0 MEJORAS, 0 DECISIONES ABIERTAS. **NO APROBAR NI MERGEAR.**
