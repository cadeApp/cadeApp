# Revisión PR #251 / T-313 — Ronda 13

**SHA revisado:** `5c5adfb2245b088515f3e1620a186ca64993203e`
**Fecha:** 2026-10-08
**Resultado:** CON BLOQUEANTES (2): H04 y H10. Cero hallazgos nuevos.

## Evidencia

- Rama sincronizada con develop: 0 behind.
- CI `37747262112` GREEN completo: unit, typecheck, lint, build, db-tests, audit y bundle-budget.
- Vercel y approval-policy GREEN.
- Trusted Preview `37747382851` sobre el SHA exacto: 51 PASS, 1 FAIL.
- T-313 courier fuera de (merchant): PASS.
- T-313 merchant sin consentimiento bloqueado: PASS.
- T-313 alta completa: FAIL, también tras reintentos.

La sonda muestra `setting=v1`, `pilotConsent=1.0`, `profileUpdated=true`, `merchantUpdated=true`, `RSC /merchant/dashboard -> 307 /merchant/onboarding` y GET directo autenticado al dashboard con status 200. Prueba persistencia exitosa y divergencia entre navegación RSC y GET; no demuestra causa raíz interna definitiva.

## D05-A — decisión de Lautaro073

Se autoriza ampliar T-313 **solo** a `src/features/merchants/components/onboarding-form.tsx` para sustituir `router.push(result.data.redirectTo); router.refresh();` por `window.location.assign(result.data.redirectTo);` después de `result.ok`.

El agy debe agregar la ruta autorizada a `docs/tasks/T-313.md` y documentar D05-A en `docs/tasks/log/T-313.md`. No se autoriza modificar guards, middleware, dashboard, SQL ni contratos. Mantener E2E y oráculos intactos. La solución propuesta aún requiere GREEN auténtico, y puede no resolver el fallo.

## Estado

- H04 abierto: falta baseline completo GREEN, posterior RED conductual seguro según T-347 y GREEN final.
- H10 abierto: el body cita runs antiguos; actualizar CI/Preview/evidencia tras implementar el fix.
- H11 permanece cerrado; policy/pgTAP pertenecen a T-348 ya mergeada.
- P3: Lautaro073 confirma el visto bueno; no inventar review de GitHub.
- El informe independiente se registra en rama docs/revisiones porque la PR es de P2.

**No apruebo ni mergeo.**