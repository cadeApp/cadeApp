# Informe de revisión — PR #375 / T-358 — Ronda 2

**SHA funcional:** e8206d770718766fa0888df68252cb078b131bf0 · **Fecha:** 2026-10-16 · **Base:** develop @ 7424dc276a34a172776a4ed77965bc4e189e01e2.
**Resultado: CON BLOQUEANTES.** Se corrigieron por inspección H01–H06, pero H07 está parcial y H08 abierto; se encontraron **3 casos nuevos (R01 alto, R02 y R03 medios)**. No hay decisiones de producto nuevas: las alternativas 1-A y 2-A ya están ejecutadas en CC-027/028.

## Qué se corrigió desde la ronda 1

| ID | Estado | Evidencia inspeccionada |
|---|---|---|
| H01 | arreglado-sin-verificar | CC-027 / PR #380, ui/map.tsx:296-297,541-565 y onboarding-form.tsx:427; MapPicker real probado en ui/map.test.tsx:1285 |
| H02 | arreglado-sin-verificar | onboarding-form.tsx:153-184 manda PATCH diferencial; actions.ts:195 llama RPC sin snapshot |
| H03 | arreglado-sin-verificar | CC-028 / PR #382, update_my_merchant_profile transaccional con locks profiles→merchants |
| H04 | arreglado-sin-verificar | schemas.ts:145-158 valida simetría de presencia y nulidad |
| H05 | arreglado-sin-verificar | queries.ts:142-147 propaga authError y distingue !user |
| H06 | arreglado-sin-verificar | onboarding-form.tsx:403-417 incorpora Quitar ubicación; E2E:551-581 prueba lat/lng null tras persistir |
| H07 | parcial | Hay pruebas nuevas de mapa/RPC y E2E, pero falta mutación independiente reproducida y pruebas nuevas R01–R03; la bitácora resume RED sin comandos/salida original |
| H08 | abierto | La ficha de rama aún marca todos los DoD como completos y conserva 'esta PR solo publica las fichas'; PR body aún dice 'En progreso (Draft inicial)' |

**No certificar H01–H06 como verificados:** los cambios se inspeccionaron, pero este revisor no ejecutó test/mutación propia sobre el clon.

## PR375-R01 — BLOQUEANTE ALTO: GPS fuera borra el pin sin pedirlo
**Archivo:** src/features/merchants/components/onboarding-form.tsx:119-130,176-184,192-200. **Evidencia:** [ANÁLISIS].
Cuando el usuario edita un comercio con lat/lng válidas y pulsa Mi ubicación, si el GPS devuelve un punto fuera de Aguilares, el callback hace setValue de ambas coordenadas a null. Al guardar luego sólo el teléfono, el PATCH detecta null/null como cambio explícito; la RPC elimina el pin. Nunca pulsó Quitar ubicación. El banner coordsError no bloquea el submit.
**Arreglo exacto:** en el if (!isWithinAguilaresBounds(latitude, longitude)) eliminar las dos llamadas setValue a null y conservar coordenadas anteriores. Sólo avisar con setCoordsError y retornar. GPS válido sí actualiza el par completo.
**Prueba RED/GREEN:** en onboarding-form.test.tsx editar merchant con lat=-27.435,lng=-65.615; mock navigator.geolocation.getCurrentPosition para responder success con -34.6,-58.4; pulsar Mi ubicación, comprobar que map-value sigue con el pin original, mostrar mensaje, editar teléfono y guardar; argumento de updateMerchantProfileAction debe ser EXACTAMENTE {phone:'3865999888'}, sin claves lat/lng. RED en código actual; GREEN tras fix; mutación reinsertando los setValue(null) ⇒ RED.

## PR375-R02 — BLOQUEANTE MEDIO: zona histórica inactiva revela UUID
**Archivos:** src/features/merchants/queries.ts:33-39; onboarding-form.tsx:318-343; referencia src/ui/select.tsx:180-186 (NO TOCAR sin CC). **Evidencia:** [ANÁLISIS CONDICIONAL].
getActiveZones sólo devuelve active=true; si el merchant conserva defaultPickupZoneId de una zona ahora inactiva, el Select no dispone de SelectItem con ese ID y SelectValue usa labelsMap.get(value) ?? value: muestra UUID al usuario. No se verificó que actualmente exista ese merchant, pero la clase es representable por el esquema y requiere test.
**Arreglo:** conservar valor histórico sin sobrescribirlo si se edita teléfono; mostrar texto legible 'Barrio anteriormente asignado (no disponible)' en un item informativo, idealmente con nombre real si consulta permitida por RLS; no permitir seleccionar una zona inactiva como nueva elección. No modificar ui/select.tsx en T-358. Si se demuestra por invariante SQL que no puede haber zonas históricas inactivas referenciadas, documentarlo y descartar R02.
**Prueba:** zones activos no contiene defaultPickupZoneId precargado; UI NO presenta UUID crudo, indica barrio no disponible; phone-only conserva ID; elegir otro barrio activo manda sólo defaultPickupZoneId. Mutación quitando fallback legible debe dar RED.

## PR375-R03 — BLOQUEANTE MEDIO: falso error tras Quitar ubicación
**Archivos:** src/features/merchants/components/form-hooks.ts:104-120; onboarding-form.tsx:403-417. **Evidencia:** [ANÁLISIS].
El botón llama dos setValue con shouldValidate true en el mismo evento. Cada setValue usa resolver({...values,[name]:val}) con valores de la renderización ANTERIOR. El primero ve lat null, lng antigua y agrega errors.defaultPickupLat; el segundo ve lat antigua, lng null pero sólo modifica el error de lng, dejando el de lat mostrado aunque el estado final es null/null.
**Arreglo:** añadir a form-hooks un método acotado setFields(patch,opts) que actualice ambos valores y valide el snapshot combinado, sin setErrors dentro del updater funcional de React; usarlo en Quitar ubicación, GPS válido y selección del MapPicker para campos emparejados.
**Prueba:** pulsar Quitar ubicación, map-value null, ningún role=alert de coordenadas incompatibles, submit payload {defaultPickupLat:null, defaultPickupLng:null}. GREEN tras fix y RED reintroduciendo dos setValue aislados.

## Calidad y alcance
CC-027 PR #380, CC-028 PR #382 y ficha PR #383 ya mergeadas a develop. Diff develop...HEAD de T-358: 18 rutas dentro de globs permitidos; carpeta pr-375 intacta desde R1; no se confundieron migraciones del CC con cambios de esta PR.
CI del HEAD: workflow run 38863709147 unit, lint, typecheck, build, audit, bundle-budget, db-tests SUCCESS. E2E Preview del mismo HEAD run 38863810444 aún estaba PENDING al consultar. E2E previo del código e07247b4, run 38861116727 job 116843435167: PASS 79 casos, incluye el T-358 en merchant-registration.spec.ts:454. Los 79 no cubren GPS fallido con pin guardado.
**Sin clon local** en esta sesión: no se ejecutaron pnpm ni mutaciones independientes; análisis, read-only GitHub y logs externos son las únicas evidencias. GitHub mergeable=true, pero no se ejecutó git merge-tree local. No inventar resultados runtime.

## NO TOCAR — falsos positivos y garantías
- No reportar ausencia de contrato: MapPicker y RPC existen y están mergeados; no tocar src/ui, src/domain, supabase, .github ni dependencias desde T-358.
- La RLS/pgTAP de CC-028 incluye no autenticado, courier, admin y update de suscripción; no declarar que no hay control de permisos.
- El E2E anterior pasó y prueba borrar pin explícitamente; no implica cobertura de GPS fallido.
- Los casos R02/R03 son razonamientos estáticos no observaciones de usuarios reales; distinguir condición y prueba.

## Cierre exigido
Corregir R01-R03 con pruebas nuevas RED sobre el defecto real → GREEN del arreglo → mutación independiente RED → restauración GREEN. La bitácora debe transcribir comando y resumen reales, sin falsificar, adulterar ni debilitar tests, mocks, fixtures, timeouts o checks. Ajustar H07/H08 y esperar E2E del último SHA. Solicitar R3. NO APROBAR NI MERGEAR #375.
