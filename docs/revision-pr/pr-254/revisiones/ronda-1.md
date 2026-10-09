# Informe de revisión — PR #254 / T-302

**PR:** https://github.com/cadeApp/cadeApp/pull/254  
**Head SHA revisado:** `32477a05841ca669ac9ac7a36f929f2261e4c926`  
**Base:** `develop` @ `ba3ade599b4dd5aed39f9720ad5a256cf26efb82`  
**Fecha:** 2026-10-05

## Resultado

**CON BLOQUEANTES (4).** La rama está 2 commits adelante y 0 atrás de `develop`, sin archivos fuera del alcance. El problema está en la validez de los controles E2E.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alta | `e2e/specs/courier-onboarding.spec.ts:174-197` | La prueba de DNI no atraviesa la deduplicación de producción | P08 |
| H02 | alta | `e2e/specs/courier-onboarding.spec.ts:258-308,346-399` | Los flujos UI pueden saltarse interacciones y aserciones | P04 |
| H03 | alta | `e2e/specs/courier-onboarding.spec.ts:209+` | El actor ya está aprobado/onboardeado por el fixture | P08 |
| H04 | alta | `e2e/specs/courier-onboarding.spec.ts:425-475` | AAL2 se obtiene en otra sesión y existe fallback RPC | P01/P04 |

## H01 — La prueba DoD de DNI no ejecuta la deduplicación de producción

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:174-197`  
**Estado:** `[ANÁLISIS]`

El DoD exige que la prueba falle al quitar la deduplicación. Sin embargo, `courierOnboardingAction` está importada pero no se invoca en ese caso. El test fuerza `dni_hmac` con service-role, confirma que el índice único rechaza un duplicado y vuelve a escribir la condición de duplicado como un boolean local.

Quitar de producción la rama `existingCourier.profile_id !== user.id -> DNI_ALREADY_REGISTERED` no altera el dataflow de este test. La restricción UNIQUE seguiría existiendo y `isDuplicate` seguiría siendo `true` porque lo calcula el propio spec.

**Arreglo:** enviar el onboarding por la UI real del segundo courier y afirmar el `role="alert"` de DNI duplicado y que no navega a status. La comprobación del índice UNIQUE puede quedar como secundaria, nunca como sustituto de `courierOnboardingAction`.

## H02 — Los flujos UI tienen rutas de escape que permiten verde sin interacción obligatoria

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:258-308,346-399`  
**Estado:** `[ANÁLISIS]`

Vehículo, patente, consentimientos y submit se ejecutan solo si existen/están habilitados. En Flujo 1, si no se puede enviar se navega manualmente a `/courier/onboarding/status`; en Flujo 2, si el submit no está disponible no se ejecuta ninguna aserción final.

Un botón eliminado, un consentimiento roto o un formulario permanentemente deshabilitado pueden elegir la rama vacía/fallback y no hacer fallar el test.

**Arreglo:** cada control obligatorio debe tener `expect(...).toBeVisible()` y, cuando corresponda, `toBeEnabled()`, seguido de la interacción. El avance identidad→vehículo debe salir de pulsar Continuar, y vehículo→status de pulsar Enviar. Prohibido `page.goto()` como sustituto de una transición bajo prueba.

## H03 — El courier del fixture no representa la precondición de onboarding

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:209+`  
**Estado:** `[ANÁLISIS]`

`stagingContext` crea los couriers generales como `status='approved'`, `available=true` y `vehicle_type='moto'`. Para el guard, `vehicle_type` no nulo ya significa onboarding completo. T-302 entra entonces a las pantallas con un usuario que ya atravesó el estado que pretende probar.

**Arreglo:** desde el propio spec, usar service-role solo para preparar la precondición: `status='pending'`, `available=false`, `vehicle_type=null`, `vehicle_plate=null`, `dni_hmac=null`, `decided_at=null`, `decided_by=null` en el courier que va a onboardear. Comprobar el error del update y luego ejecutar la transición exclusivamente por UI.

## H04 — La aprobación UI no eleva la misma sesión del navegador a AAL2

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:425-475`  
**Estado:** `[ANÁLISIS]`

El browser inicia sesión y queda en `/login/mfa`, pero `createAuthenticatedClient(admin)` crea otra sesión sin persistencia. `elevateAdminToAal2(adminClient)` eleva esa sesión Node, no las cookies SSR del navegador. Después el spec intenta navegar a admin y, si el botón no aparece, aprueba con la RPC del cliente auxiliar.

`verifyAdminMfaAction` usa el cliente SSR de la sesión browser y exige un factor TOTP activo; el helper Node no comparte esa sesión. El fallback RPC puede dejar verde la aserción de DB aunque la UI permanezca bloqueada en AAL1.

**Arreglo:** preparar un factor TOTP para la cuenta conservando su `secret`, iniciar sesión en el navegador, introducir `generateTotp(secret)` en `#totp-code`, pulsar el botón real de verificar y afirmar la navegación a `/admin/applicants`. Después la aprobación debe ocurrir solo con el botón/modal UI; una consulta DB posterior puede verificar el efecto, pero no ejecutar la transición.

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Alcance | Los únicos archivos del PR original son el spec y la bitácora, ambos permitidos por T-302. |
| Rama atrasada | En la revisión, `develop...HEAD` dio ahead 2 / behind 0. |
| Dependencias/contratos | No se agregan paquetes ni se cambian contratos productivos. |

## Checks de esta ronda

- Comparación contra `develop`: ✅ ahead 2 / behind 0.
- Alcance: ✅ 2 archivos originales, ambos permitidos.
- Revisión estática del spec, fixtures, action de onboarding, guard y MFA: ✅.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`: no ejecutados independientemente en esta sesión; el entorno local no pudo materializar/clonar el repo para correrlos.
- CI/E2E Preview: **no inspeccionado todavía**. La política de revisión indica mirarlo recién cuando no queden bloqueantes estáticos.
- Los RED declarados por el autor no se aceptan como reproducidos: la bitácora no identifica una mutación concreta y H01 demuestra que el control de DNI no atraviesa la rama productiva que dice proteger.

## Metodología

Revisión sobre `32477a05841ca669ac9ac7a36f929f2261e4c926` usando el contenido exacto de GitHub y la ficha T-302 leída desde `develop`. Se enumeró la clase completa de escapes condicionales antes de reportarla. No se marca ningún hallazgo como verificado por ejecución; todos permanecen abiertos hasta una ronda posterior con RED/verde reproducible.