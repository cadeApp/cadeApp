# Ronda 3 — PR #119 / T-117

**Fecha:** 2026-09-28  
**SHA revisado:** `947648cb92148de3be6a360fc086ba2db86ba059`  
**Resultado:** **SIN BLOQUEANTES**

## Sincronización y CI

- HEAD remoto: `947648cb92148de3be6a360fc086ba2db86ba059`.
- Historial lineal respecto del commit de revisión de ronda 2; sin amend/rebase/force-push observado.
- PR mergeable.
- CI run `36492855455`: success.
- Unit: **100 archivos / 1327 tests verdes**.
- typecheck, lint, build, db-tests, audit y bundle-budget: verdes.

## PR119-H05 — arreglado-verificado

La corrección elimina el sufijo geográfico hardcodeado del fallback de navegación:

- sin coordenadas, `buildGoogleMapsDirectionsUrl` recibe `pickupAddress` y `dropoffAddress` tal cual;
- C06 ya no imprime `Aguilares, Tucumán` fijo; el pie deriva `pickupZoneName → dropoffZoneName`;
- el nuevo caso integrado renderiza R07 con las cuatro coordenadas en `null`, usa direcciones completas de dos localidades distintas y exige el `href` exacto codificado una sola vez;
- la bitácora registra la mutación temporal que reintroduce el sufijo y pone rojo ese test.

La forma del test hace que la regresión concreta de H05 quede directamente observable: cualquier sufijo añadido cambia el `href` esperado.

## Estado final

H01–H05: **arreglado-verificado**.

No se encontraron nuevos bloqueantes ni decisiones 🔵 en esta ronda. La PR sigue en Draft; esta revisión no la aprueba ni la mergea automáticamente.
