# Informe de revisión independiente — PR #587 / T-421 · Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/587
**SHA inspeccionado:** `a3fe70ee3336b65ffb2390044857afcf71430a09` (commit del autor; **no** el commit posterior de revisión)
**Base:** `develop` @ `146c9f9749dbc7fa20b63583cbc9b3c939cdc339`
**Fecha:** 2026-11-04
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES.** H08 y H09 verificados en el contrato; H01–H07 revalidados por inspección. NO se aprobaron ni mergearon cambios.

## Alcance exacto del delta R2→R3

Compare GitHub desde `b2b9c379a51b39c93a097f2df7fa2d7305bf7b68` hasta `a3fe70ee3336b65ffb2390044857afcf71430a09`: un commit del autor, **tres documentos**:
- `docs/contracts/CC-043.md`: +40/-9;
- `docs/tasks/T-421.md`: +11/-3;
- `docs/tasks/log/T-421.md`: +18/-2.

No se tocó SQL, TypeScript, tests, UI, contratos CC-044/T-403/T-404 ni los archivos de revisión por parte del autor. La ficha T-421 es nueva y se incorpora en la misma PR; todavía no está en develop.

## Cierre de H08 — fail-closed en ventana migrate → deploy

**Estado:** `arreglado-verificado` **solo en especificación**. `docs/contracts/CC-043.md:115-132,235-247,312-317` y `docs/tasks/T-421.md:39-41,109-111,144-146`.

En lugar de aceptar el UPDATE directo viejo, el contrato ahora exige que el trigger `couriers_guard_application`, cuando no hay finalización autorizada, rechace con `INVALID_STATE_TRANSITION` el UPDATE que deje:
1. `NEW.application_submitted=false`;
2. `NEW.dni_hmac` no nulo y `NEW.vehicle_type` no nulo;
3. DNI o tipo de vehículo cambiados respecto de OLD.

La condición recoge el UPDATE efectivo de `courierOnboardingAction` previo (como `service_role`, con ambos campos en una llamada) e incluye histórico con `OLD.dni_hmac` no nulo cuando el tipo de vehículo cambia. Un UPDATE solo de `vehicle_type` con DNI nulo sigue permitido, de modo que el registro anticipado de CC-042 no queda roto.

La política de despliegue ahora declara el efecto de fallo temporal sobre la app vieja: su actualización final devuelve error, el usuario ve error genérico y puede reintentar después del deploy de la action nueva; documentos y consentimientos anteriores se reutilizan. **No hay un OK engañoso ni backfill posterior inventando fecha.** T-421 agrega pgTAP de compatibilidad, una prueba con OLD.dni_hmac nulo/no nulo y la mutación que elimina el guard, con aserción RED por éxito falso.

**Límite:** es una comprobación de diseño y transiciones declaradas; el SQL no existe aún y se debe probar en T-421. Otros actores con acceso administrativo pleno podrían crear estados artificiales, como ya reconoce CC-043; no se probó ninguna explotación desde PostgREST.

## Cierre de H09 — patente validada por RPC

**Estado:** `arreglado-verificado` **solo en especificación**. `docs/contracts/CC-043.md:75-89,312-316`, `docs/tasks/T-421.md:105-108,142-147`.

CC-043 ahora especifica la normalización `nullif(upper(btrim(p_vehicle_plate)), '')` y un regex SQL para los cuatro formatos argentinos equivalentes a `ARGENTINA_PLATE_REGEX` de `src/features/courier-onboarding/schemas.ts`. En `moto/car` exige matrícula válida, y en `walk/bike` el valor normalizado debe ser NULL. La validación ocurre **antes del UPDATE** y devuelve `VALIDATION_ERROR` si falla. La comparación idempotente también usa patente normalizada, previniendo reintentos inconsistentes por mayúsculas o espacios exteriores.

El DoD de T-421 ahora exige pgTAP de todos los formatos, variantes minúsculas y sin espacios, casos negativos y tres mutaciones RED independientes (sin obligatoriedad, sin regex y patente admitida para bici).

## Regresiones R1–R2

Se contrastó otra vez el contenido de CC-043, CC-044, T-421, T-403, T-404 y la fila del plan:
- **H01:** finalización por RPC `service_role` y allowlist de `courierOnboardingAction`, presente.
- **H02:** histórico `submitted_at=null` no se refecha al reintentar, presente.
- **H03:** lectores de auth y rutas pasan a `application_submitted`, presente.
- **H04:** dualidad marca local + `current_user` dueño `SECURITY DEFINER`, no eliminada.
- **H05:** orden de CC-042, seed por RPC y fixtures E2E adaptados, conservados.
- **H06:** `aal2` limitado a RPC; riesgo SELECT directo por PostgREST queda en T-408 (decisión D03=A).
- **H07:** backfill de históricos con fecha nula y `raise notice` agregado sin datos personales.
- T-403, T-404 y el plan continúan alineados con la marca de envío y la fecha real.

**Decisiones:** se mantienen D01=C, D02=C y D03=A. **No se identifica nueva decisión de diseño pendiente.**

## Evidencia / checks y qué NO se ha ejecutado

| Control | Resultado |
|---|---|
| Diff R2→R3 por GitHub y lectura de contrato, ficha y bitácora | Verificado |
| 12 controles independientes de presencia/consistencia documental, H01–H09 y fichas enlazadas | 12/12 conformes |
| Modelo de formato de patente extraído literalmente de CC-043 | 13/13 escenarios conformes |
| Modelo del predicado fail-closed declarado en CC-043 | 5/5 escenarios conformes |
| Mutante que elimina el guard del modelo | 3 casos lo detectan (RED) |
| Mutante que acepta cualquier patente no vacía en el modelo | 4 casos lo detectan (RED) |
| Bitácora del autor | Declara 91 Vitest pasados, `analizar.mjs verificacion` sin errores y `git diff --check` limpio; no reproducidos aquí |
| GitHub CI de SHA `a3fe70ee3336b65ffb2390044857afcf71430a09` | Workflow en **queued** al consultar; no se declara verde |
| `git merge-tree` / clon local / SQL / pgTAP / E2E | **NO ejecutados** (sin acceso git por DNS, PR solo documental) |

El detalle y harness reproducible aparecen en `evidencia/comandos.md`. Los escenarios en JS interpretan la **especificación**; no hay cuerpo de trigger SQL que pueda probarse aún. Las pruebas funcionales, de bypass y mutaciones SQL quedan expresamente para la PR de implementación T-421, en CI.

## Cierre y siguiente fase

**SIN BLOQUEANTES DOCUMENTALES** para esta PR: no se necesita otra corrección de CC-043/044 ni una nueva decisión D para comenzar T-421 *cuando la PR de contratos sea mergeada*.

Antes del merge, Lautaro073 debe efectuar su aprobación de comportamiento visible (checkbox todavía abierto en T-421), verificar los checks obligatorios vigentes y decidir el merge. La revisión independiente **no** aprueba ni mergea. T-421 tendrá su propia revisión del SQL, pruebas pgTAP, seguridad `security definer`, navegación, seed y E2E. El detalle de que H08/H09 están «verificados» no implica que el SQL futuro lo esté.

### Revisión humana rápida

- [ ] Confirmar que CI de este SHA o del commit final esté verde según política.
- [ ] Lautaro073 marca aprobación de comportamiento visible en ficha o documenta la decisión antes del merge.
- [ ] Mantener T-408 como riesgo aceptado y coordinación de T-419 ya publicada en https://github.com/cadeApp/cadeApp/issues/573#issuecomment-6623990161.
