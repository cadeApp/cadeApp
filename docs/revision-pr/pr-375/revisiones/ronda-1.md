# Informe de revisión independiente — PR #375 / T-358 — ronda 1

**HEAD revisado:** `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91` · **Base:** `develop` (merge-base `2d2c011c`) · **Fecha:** 2026-10-15
**Resultado:** **CON BLOQUEANTES (5 altos, 3 medios)**. Ninguna decisión pendiente de Lautaro073: autorizó **1-A (CC #378)** y **2-A (CC #379)**.

## Evidencia y método

- Leídos en `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-358.md`, `.agents/skills/contract-change/SKILL.md` y `AGENTS.md`. Lecciones anteriores: pr-56, pr-62, pr-63, pr-64, pr-68 y pr-82.
- Diff de 13 archivos; **todos dentro de Archivos permitidos**. La ficha modificada solo marca DoD, no expande globs; conserva una nota desactualizada sobre una PR documental. No hay commits de revisión en `pr-375` previos a esta ronda.
- `get_pr_info` informa `mergeable=true` y comparación contra `develop`: 3 commits adelante, **11 atrás**. **No se ejecutó `git merge-tree`** por falta de clon local; mergeabilidad de GitHub no equivale a la verificación de CC/números.
- CI correspondiente a `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91`: run **38799974364**, `unit` SUCCESS (133 archivos, **2389/2389 tests**); `typecheck`, `lint`, `build`, `db-tests`, `audit`, `bundle-budget` en SUCCESS. En el log de `db-tests` se constató **Files=24, Tests=2283, Result: PASS** tras comprobaciones; `git diff --exit-code -- src/types/database.types.ts` ejecutado en el job. No se levantó Supabase/Docker local.
- E2E Preview del código `42ace275`: run **38794014208**, job **116631008102**, resultado **79 passed**; incluye test T-358 en `merchant-registration.spec.ts:454`. Run posterior del HEAD `b3ace3eb9acb2a3132c1d26bbb74863fdc1e2c91`: **38800094742**, job E2E `cancelled`, status commit `e2e-preview=error`. No afirmar verde E2E del HEAD.
- **No se ejecutaron tests ni mutaciones locales de forma independiente**: la sesión carece del repositorio clonado/dependencias; se dejó harness completo para ejecutar desde `/tmp` y las pruebas nuevas exigidas. La reproducción del RED→GREEN del autor carece de comandos de mutación en bitácora y no puede certificarse por este informe.
- No se aprobaron, mergearon ni modificaron archivos funcionales. Dos issues de CC fueron creados (#378, #379); issue #345 marcado `bloqueada`.

## Resumen

| ID | Severidad | Ruta:Línea | Problema |
|---|---|---|---|
| PR375-H01 | alto | `src/ui/map.tsx:536` | El mapa muestra un marcador inventado cuando value es null |
| PR375-H02 | alto | `src/features/merchants/actions.ts:244` | La acción reescribe campos ausentes y pierde cambios concurrentes |
| PR375-H03 | alto | `src/features/merchants/actions.ts:224` | El nombre se actualiza en dos tablas sin transacción |
| PR375-H04 | alto | `src/features/merchants/schemas.ts:147` | Coordenada null y coordenada omitida pasan la validación parcial |
| PR375-H05 | medio | `src/features/merchants/queries.ts:142` | Error de autenticación se confunde con usuario no autenticado |
| PR375-H06 | medio | `src/features/merchants/components/onboarding-form.tsx:370` | No existe eliminación explícita del pin guardado |
| PR375-H07 | alto | `src/features/merchants/components/onboarding-form.test.tsx:667` | Los controles no demuestran el pin real, RLS cruzado, concurrencia ni mutaciones propias |
| PR375-H08 | medio | `docs/tasks/T-358.md:47` | Ficha y evidencia se declaran completas antes de cerrar revisión |

## Hallazgos: diagnóstico, arreglo y prueba exigida

### PR375-H01 · Pin ficticio del mapa — ALTO
**[ANÁLISIS]** `src/features/merchants/components/onboarding-form.tsx:369-382` pasa `value=null` si faltan coordenadas, pero `src/ui/map.tsx:239-245, 535-555` renderiza `AdvancedMarker` o `Marker` en `fallbackCenter`. Es un falso pin, aunque no se persista.
**Arreglo decidido:** CC [#378](https://github.com/cadeApp/cadeApp/issues/378). Añadir prop opcional al `MapPicker` con default retrocompatible para ocultar marcador al estar vacío, sin ocultar mapa ni impedir la selección. En T-358 activar solo en edición vacía.
**Prueba:** componente REAL `MapPicker` con valor nulo y centroide/no centroide; asegurar que no exista marcador, click crea marcador y cambia solo coordenadas explícitamente. RED: forzar que la guarda renderice `Marker` aun con `value=null`.

### PR375-H02 · Pérdida por update parcial que escribe snapshot viejo — ALTO
**[ANÁLISIS]** `src/features/merchants/actions.ts:244-264` construye payload con todos los campos desde `existingMerchant`, mientras `onboarding-form.tsx:154-162` manda todos los datos iniciales. Dos sesiones pueden guardar teléfono y dirección de forma que el último submit revierta datos de la primera.
**Arreglo decidido:** CC [#379](https://github.com/cadeApp/cadeApp/issues/379): RPC con patch por presencia, una transacción por cuenta; el formulario solo manda campos realmente modificados. No admitir snapshot completo si solo se editó el teléfono.
**Prueba:** actor A cambia dirección entre lectura de actor B y actualización del teléfono; dirección de A debe permanecer. RED: volver a emitir campo de dirección sin editar desde formulario o RPC.

### PR375-H03 · Nombre sin actualización atómica — ALTO
**[ANÁLISIS]** `actions.ts:224-278` actualiza `profiles.display_name` y después `merchants.business_name`; fallo de merchants deja nombres divergentes aun retornando error.
**Arreglo decidido:** RPC única CC #379, con permisos/locks/rollback, para dos tablas. No simular transacción con dos llamadas separadas desde Server Action.
**Prueba:** fallo intencional en segunda escritura con transacción; verificar rollback de `profiles` en pgTAP. RED: mutación que quite abort/raise o separe transacciones, sobre CC de prueba.

### PR375-H04 · Latitud nula suelta puede corromper coordenadas — ALTO
**[ANÁLISIS]** `schemas.ts:145-157` compara `null` con `undefined` como equivalentes. `merchantUpdateSchema.safeParse({ defaultPickupLat: null })` cumple la expresión, pero `actions.ts:251-257` preserva longitud vigente → latitud nula, longitud no nula.
**Arreglo:** en PATCH exigir presencia *simétrica* de claves lat/lng y ambas nulas o ambas válidas; probar payload con una sola clave null/undefined y par null/null, y consulta al storage posterior. Seguridad equivalente dentro de RPC #379.
**Prueba RED:** eliminar condición de presencia simétrica después del arreglo; `schemas.test.ts` y pgTAP deben fallar, GREEN al restaurar.

### PR375-H05 · Error de auth convertido en formulario vacío — MEDIO
**[ANÁLISIS]** `queries.ts:139-144`: `if (authError || !user) return null`. Falla real de Auth puede tratarse como ausencia de sesión y propiciar inicialización sin datos, pese a requerimiento de error visible.
**Arreglo:** propagar `authError` con error controlado; para `!user` diferenciar claramente redirección/no sesión del registro incompleto. Reutilizar `merchant/onboarding/error.tsx`.
**Prueba RED:** mutar a `if (authError || !user) return null` y verificar que test `authError` con `user=null` no muestre formulario vacío.

### PR375-H06 · Pin guardado no puede quitarse expresamente — MEDIO
**[ANÁLISIS]** `onboarding-form.tsx:370-383` solo registra ubicación mediante `MapPicker.onChange` y geolocalización; no hay botón de borrar pin. No es suficiente permitir `lat=null,lng=null` a nivel de esquema.
**Arreglo:** una acción accesible «Quitar ubicación» solo si hay coordenadas: limpiar ambos campos con `setValue`, dejar el mapa sin marcador con CC #378; nunca limpiar al abrir o cambiar barrio.
**Prueba RED:** botón presente en edición con pin, ambos `null` tras click y persisten tras reload. Mutación: limpiar solo latitud debe dar RED.

### PR375-H07 · Pruebas insuficientes frente a las propiedades prometidas — ALTO
**[ANÁLISIS]** `onboarding-form.test.tsx:655-677` valida `map-value` de un mock, no marcador real; `actions.test.ts:1118-1309` usa mocks que no reproducen carreras ni rollback; `e2e/specs/merchant-registration.spec.ts:454-550` prueba un único comercio, teléfono y recarga, sin intento de editar otra cuenta ni quitar pin. **Esto no implica que los 79 E2E sean falsos**: son pruebas reales pero de un alcance menor que el DoD.
**Arreglo:** pruebas auténticas de MapPicker compartido en CC #378, pgTAP de permisos/concurrencia/rollback en CC #379 y E2E Preview T-358 con PIN faltante/limpieza/otro merchant y evidencia SHA. Registrar RED y GREEN reproducibles con mutación independiente; no alterar mocks/aserciones/timeouts para ocultar defectos.

### PR375-H08 · DoD y nota de ficha no reflejan estado real — MEDIO
**[ANÁLISIS]** En `docs/tasks/T-358.md:42-62` figuran como completos tests independientes y revisión cuando faltan pruebas; la nota dice erróneamente que «esta PR solo publica las fichas», pero el diff modifica 13 archivos funcionales y docs. El E2E actual se canceló, aunque el SHA de código anterior pasó.
**Arreglo:** reconciliación documental separada conforme `contract-change` y ficha `develop`; reflejar bloqueos CC #378/#379, no marcar DoD no verificado; no registrar estado `verificado` desde agy.

## NO TOCAR — hechos comprobados y falsos positivos descartados
- Los cambios de T-358 están dentro de los globs originales; el futuro cambio en `src/ui/**`, SQL y tipos **no** está autorizado en esta PR sin CC y reconciliación.
- `getMerchantProfileForEdit` hace `Promise.all` para merchant/profile y propaga errores de la consulta SQL; H05 habla del error de **Auth**, no de SQL.
- El E2E de teléfono/recarga **sí** corrió y aprobó sobre `42ace275`; no descalificarlo como falso por falta de tests de otras clases.
- No hay evidencia de ejecución de código contra comercio ajeno en esta ronda, por lo que se exige prueba de autorización, no se afirma explotación.

## Por qué los checks verdes no alcanzan

| Control | Qué efectivamente comprobó | Lo que queda abierto |
|---|---|---|
| Vitest 2389/2389 | Reglas y casos existentes del HEAD | Marcador real, concurrencia, auth error y borrado explícito |
| db-tests 24/2283 PASS | Suite del esquema vigente | No existe todavía la RPC propuesta; faltan sus casos nuevos |
| E2E Preview 42ace275 79 PASS | Flujo teléfono con merchant válido | Pin ausente, cruce de propiedad y transacción |
| E2E Preview b3ace3eb cancelled | Ninguna aprobación de ese HEAD | Repetir después de rebase/merge de CC, reportando SHA exacto |

## Acciones y decisiones
- Lautaro073 eligió **1-A**, issue CC #378: nuevo contrato de MapPicker sin pin ficticio, retrocompatible.
- Lautaro073 eligió **2-A**, issue CC #379: actualización atómica vía RPC; pactar firma exacta y tests de privilegios.
- Issue #345 etiquetado `bloqueada`.
- No aprobar ni mergear #375. Primero mergear ambos CC en su propio flujo; luego reconciliar ficha y retomar cambios con nueva ronda.

## Integridad de revisión
Este documento se elaboró por inspección de fuentes y logs GitHub. **Sin worktree ejecutable local**, no se presenta falsamente `git status clean`, `git merge-tree` ni mutaciones RED independientes. Ver `evidencia/comandos.md` para ejecutar en clon y completar evidencia en ronda siguiente.
