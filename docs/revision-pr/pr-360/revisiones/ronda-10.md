# Informe revisar-pr — T-359 · PR #360 · ronda 10

**Fecha:** 2026-10-17. **SHA de código/bitácora revisado:** `8d5f6a840a2f56b468672698a3ed225e8c937592` (código opción C en `8c90e4b7`). **Resultado: CON BLOQUEO DE MERGE por E2E integrado T-366 y DECISIÓN P1 PR360-R05 PENDIENTE; R04 CORREGIDO POR INSPECCIÓN + E2E funcional T-359 GREEN.** La revisión no aprueba ni mergea.

## Alcance y solución R04

El único commit manual de aplicación para opción C (`8c90e4b7` tras merge normal de develop `7daacd68`) cambió: `src/features/trips/components/trip-merchant-view.tsx`, `src/features/trips/components.test.tsx`, `e2e/specs/main-flow.spec.ts`, y `docs/tasks/log/T-359.md`. El HEAD `8d5f6a84` solo actualizó la bitácora. La ficha canónica `T-359.md` autorizó el test de componente vía PR #391, mergeada a develop.

**Por inspección:** single-drop visualiza el método de `dropsList[0]` dentro de Card del repartidor, multi-drop visualiza cada método individual en las tarjetas del destinatario. Reusa `formatRecipientPaymentMethod`, con efectivo, transferencia y a coordinar, y no reintroduce importe/pago en el mensaje WhatsApp al cliente (T-361). Unit test usa `within` de cada Card; cubre single legacy cash/transfer/to_agree, un drop distinto del global, multi-drop heterogéneo y privacidad. E2E T-359 conserva dos contextos, oráculos DB, monto, WhatsApp, Back, redirección, ausencia de aceptar y verifica el pago **dentro de courierCard** antes/después de reload.

**R04:** pasa de `abierto` a `arreglado-sin-verificar`: autor declaró RED unit 3 failed/42 passed, GREEN 45/45 y 3 mutantes locales; el revisor no corrió esos tests de forma independiente. Se realizaron controles ESTÁTICOS propios 7/7 base, 4/4 mutaciones in-memory detectadas, pero no reemplazan Vitest.

## CI y E2E reproducidos desde GitHub

- [CI 39011124764](https://github.com/cadeApp/cadeApp/actions/runs/39011124764), SHA funcional `8c90e4b7`: unit, db-tests, build, typecheck, lint, audit, bundle-budget **SUCCESS**.
- [E2E 39011178930](https://github.com/cadeApp/cadeApp/actions/runs/39011178930), job `117333894466`: Playwright realmente corrió en Preview, **81 passed, 1 failed**. T-359 aceptación concurrente PASSED en 31.2 s (incluye pago postreload); T-360 feed PASSED en 40.8 s.
- El test **T-366**, `e2e/specs/request-states.spec.ts:1013`, es el único FAIL: `getByRole('button', {name:/aceptar/i})` no existe para solicitud `published` con `expires_at` diez minutos atrás. El fallo se repitió en retry #1 y #2.
- El SHA `8d5f6a840a2f56b468672698a3ed225e8c937592` tiene solo bitácora adicional, y sus checks/E2E propios estaban pendientes al consultar. No inferir GREEN por CI de SHA anterior. No se corrió pnpm ni Docker/Supabase local.

## PR360-R05 — DECISIÓN — T-366 contradice su propio DoD

**Hecho:** T-359 H03 define `isAcceptableStatus` como `published && !isExpired && !isReconciling`, ocultando el botón en vencidas. El unit T-359 H03 exige `toHaveLength(0)`. El DoD canónico T-366, leído desde `develop`, explícitamente exige **ofertas vencidas no aceptables**. En cambio T-366 E2E exige un botón visible **aunque venció hace diez minutos**. Después de esa aserción, el mismo spec valida que la RPC `accept_offer` retorna `REQUEST_EXPIRED`. La UI ya demuestra 'Expirada'. Este conflicto no prueba un bug del backend; prueba una expectativa E2E incompatible con una protección legítima.

**Opciones comparadas para P1:**

- **A — botón Aceptar visible deshabilitado:** posible UX si se desea explicar que la oferta existió; requiere cambios UI `request-offers-list.tsx`, unit T-359 H03 y E2E T-366 para exigir disabled, no solo visible. Más superficie y riesgo de dar a entender una acción imposible, aunque no permitiría aceptar.
- **B — botón Aceptar habilitado pero RPC rechaza:** T-366 actual pasaría, RPC seguiría protegiendo; **desaconsejado**, genera clic sin posibilidad de éxito, errores evitables y elimina defensa preventiva de H03.
- **C — recomendada: botón oculto en vencidas y corregir test T-366:** deja intacta la protección T-359 y la RPC; en `e2e/specs/request-states.spec.ts` reemplazar la aserción `toBeVisible` de la línea 1013 por `toHaveCount(0)` para `/^aceptar$/i`, conservando comprobación de 'Expirada'/'Ofertas recibidas', test RPC `REQUEST_EXPIRED` y todo lo demás. Es una aserción más segura, no un skip ni test falso. El archivo pertenece al alcance T-366, NO a la ficha T-359. Requiere decisión P1 y **PR de corrección separada nacida de develop**, luego incorporar develop por merge normal a #360 y ejecutar E2E en HEAD final.

**Recomendación técnica:** C por coherencia de DoD, menor ambigüedad UX, seguridad y mantenibilidad. No elegir B para 'pasar verde'. Mantener A solo si P1 prefiere expresamente comunicar el botón deshabilitado y se actualizan los controles de ambos lados.

## Entrega y límites

**Sin cambio de código por el revisor; sólo `docs/revision-pr/pr-360/**`.** R05 pendiente decisión P1, R04 `arreglado-sin-verificar`, H05 `parcial` porque gate global RED. Otros hallazgos conservan estado. No se ejecutaron mutaciones Vitest independientes, `git merge-tree` ni pnpm en clon, y no se asignó `verificado_en_sha`.

Próxima ruta: decisión P1 → fix específico T-366 con pruebas → merge de ese fix a develop con política → merge normal origin/develop en #360 → nueva CI, Playwright completo y ronda 11. **No aprobar ni mergear #360 hasta E2E del SHA final GREEN.**