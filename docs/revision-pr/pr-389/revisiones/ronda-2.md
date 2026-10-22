# Informe revisión independiente — PR #389 / T-362 — ronda 2

**Fecha:** 2026-10-17
**SHA inspeccionado:** 1da28ccaa2d9143f74ec0e75f89426b20ec50878
**Resultado:** CON BLOQUEANTES (3: R01, R02, R03).
**Método:** inspección remota, comparación literal de código y contrato SQL; sin Vitest/Playwright propios ni CI inspeccionada en ronda bloqueada.

## Control inicial y alcance

La ronda 1 se mantuvo intacta y el autor no tocó docs/revision-pr. Entre commit revisor 1acc568 y el HEAD de esta ronda, el autor modificó exclusivamente docs/tasks/T-362.md, su bitácora, e2e/specs/request-states.spec.ts y el test trip-cancel-dialog.test.tsx, todos permitidos. La ficha de alcance se leyó desde develop. GitHub informa mergeable=true; develop avanzó tres commits de documentación (docs/implementation-plan, pr-388, T-359, T-369) y no pudo ejecutarse git merge-tree local por DNS.

## Reevaluación de ronda 1

- H01 PARCIAL: el E2E merchant matched existe pero lo invalidan R01 y R02.
- H02 ARREGLADO SIN VERIFICAR: contextos garantizados y finally; positivos de ruta, heading y Reportar un problema antes de los negativos en in_transit.
- H03 ARREGLADO SIN VERIFICAR: oráculos literales EXPECTED_MERCHANT_REASONS y EXPECTED_COURIER_REASONS, independientes de la implementación.
- H04 ARREGLADO SIN VERIFICAR: tests de integración de TripCourierContainer/TripMerchantContainer y actions por rol.
- H05 PARCIAL: casilla E2E Preview devuelta a [ ]; no se documentó pnpm test completo del SHA con los tests corregidos ni existe run E2E en bitácora.

Ningún hallazgo se marcó como arreglado-verificado: la bitácora del autor no sustituye una ejecución independiente.

## R01 — BLOQUEANTE ALTO — expectativa de copy que no existe

**Archivo:** e2e/specs/request-states.spec.ts:1271-1274.
**Patrón:** P03. **Estado:** análisis, regresión nueva.

El E2E merchant exige:
- «¿Confirmás la cancelación definitiva de este envío?»
- «Esta acción cancelará el envío de forma definitiva y no podrá reactivarse.»

En src/features/trips/components/trip-cancel-dialog.tsx, líneas 115 y 124, la UI realmente muestra:
- «¿Confirmás la cancelación definitiva?»
- «Las ofertas se van a cerrar. No se puede deshacer.»

No existe un modal alternativo en este flujo. La prueba fallará si alcanza esas aserciones, aunque no se ejecutó Playwright para observar el fallo.

**Arreglo exacto:** cambiar SOLO los getByText del E2E al copy real, sin tocar producción. Preferir heading accesible en alertdialog, comprobar motivo seleccionado en paso 2, mantener oráculo Postgres, actor y redirección. Demostrar RED de la prueba previa y GREEN con el copy corregido en Preview, sin adulterar fixtures.

## R02 — BLOQUEANTE ALTO — falso positivo de autorización

**Archivo:** e2e/specs/request-states.spec.ts:1298-1313.
**Patrón:** P08. **Estado:** análisis, regresión nueva.

El mismo merchantRequestId se confirma cancelled en línea 1288 y después se consulta desde un segundo courier. La RPC get_trip_details en supabase/migrations/20260926010000_cc008_trip_details.sql, líneas 56-62, rechaza estados fuera de matched/in_transit/delivered ANTES de verificar actor en líneas 79-85. La página «Viaje no encontrado» puede mostrarse a cualquiera por estado: no prueba una prohibición por rol.

**Arreglo exacto:** mover el bloque unauthorizedContext antes de la cancelación, justo después de crear el merchantRequestId en matched. Comprobar en DB requestStatus=matched y acceptedOfferId existente; el actor autorizado debe poder ver ese mismo viaje. Luego ingresar con loginAsCourier(1, unauthorizedPage), comprobar not-found y ausencia de acciones/datos. Mantener contextos y finally. No tocar RPC/SQL/contratos. E2E Preview debe demostrar ambos lados.

## R03 — BLOQUEANTE ALTO — harness de R1 mal construido (error mío)

**Archivo:** docs/revision-pr/pr-389/evidencia/comandos.md:65.
**Patrón:** P15. **Estado:** análisis y reconocimiento de falla de revisión.

En la ronda 1 escribí un script cuyo objetivo M1 era la subcadena «const reasons = actor === 'courier' ...», presente TRES veces en la implementación (líneas 58, 63 y 67). El mismo script exige ocurrencia única antes de mutar; aborta en M1 con objetivo no unívoco (3). NO puede haber ejecutado M2-M5 en su forma versionada. La bitácora de KiraK72 afirma cinco RED y control GREEN, pero no aporta el script distinto efectivamente usado.

Es responsabilidad del revisor corregir el harness y señalarlo; NO se deduce falsificación. El archivo evidencia/comandos.md ahora contiene una variante R2 anclada a una sola ocurrencia para cada mutante. La cardinalidad se comparó contra el SHA, pero no pudo ejecutarse la suite por falta de clon local.

**Arreglo de evidencia:** el autor puede crear script auxiliar en /tmp sin versionarlo en carpeta de revisión; ejecutar control sin mutar GREEN, M1-M5 RED funcionales con tests ejecutados y vuelta a GREEN; registrar script realmente usado, comando y líneas Test Files/Tests para cada uno en docs/tasks/log/T-362.md. No modificar docs/revision-pr/**. Si hay discrepancias, registrarlas y no fabricar salidas.

**Pendiente asociado:** correr pnpm test completo después de la modificación de pruebas, registrar resultados y no afirmar que el HEAD nuevo tiene test completo en verde sin salida.

## NO TOCAR y estado CI

Los componentes visuales originales distinguen motivos y roles correctamente por inspección. RPC/actions existentes conservan seguridad, y ReportIncidentButton cubre reporte post-retiro; no abrir CC ni nueva migración. No refactorizar producción para hacer coincidir texto inventado del E2E. No ejecutar comandos remotos contra Supabase ni workflows manuales; no usar mutaciones inseguras en Preview.

No se revisó CI en esta ronda con bloqueantes. La rama está divergiendo de develop por tres commits documentales según compare GitHub, mergeable=true según PR; falta comprobar merge-tree en clon. No aprobar ni mergear.

## Checklist antes de ronda 3

- R01: las dos aserciones cotejadas con copy real y E2E ejecutado.
- R02: prueba actor ajeno en matched con autorización positiva, no en cancelled.
- R03: harness M1–M5 reproducible, evidencia RED/ GREEN y pnpm test completo del SHA.
- Bitácora/DoD: SHA, URL del run e2e-preview, estado, oráculos reales; mantener [ ] hasta la ejecución.
- CI solo cuando no haya bloqueantes: inspección de logs de mismo SHA y posterior a commit.
