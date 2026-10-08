# Revisión independiente — PR #251 / T-313 — Ronda 14

**Fecha:** 2026-10-08
**HEAD funcional:** `56b3c70d66740210de29d1183aa16fed1487eae1`
**Base:** `develop` @ `d2ad3315ae9403194a35726b25f84996110a9216`
**Resultado: CON BLOQUEANTES (2 heredados: H04 parcial y H10), sin hallazgos nuevos.**

## D05-A — implementada y verificada en trusted E2E

El delta respecto de `5c5adfb` incluye exactamente:
- `docs/tasks/T-313.md`: autoriza `src/features/merchants/components/onboarding-form.tsx` exclusivamente para navegación tras éxito;
- `docs/tasks/log/T-313.md`: registra D05-A y RED previo;
- `src/features/merchants/components/onboarding-form.tsx`: elimina `useRouter`, reemplaza `router.push(...); router.refresh();` por `window.location.assign(result.data.redirectTo)`, **después** de verificar `result.ok`.

No se modificaron guardas, middleware, dashboard, migrations, pgTAP ni expectativas E2E. La action sigue devolviendo `redirectTo: '/merchant/dashboard'`, ruta interna fija.

### RED previo real

Trusted Preview `37747382851` sobre `5c5adfb`: **51 passed / 1 failed**.
- merchant persistido, consentimiento registrado;
- RSC a `/merchant/dashboard` devolvió 307 a onboarding;
- GET directo autenticado posterior a dashboard devolvió HTTP 200.

### GREEN después de D05-A

Trusted Preview `37803965180`, job `113403336124`: checkout **explícito** de `56b3c70d66740210de29d1183aa16fed1487eae1`.

```text
✓ DoD: Alta completa y panel visible con la versión de consentimiento registrada
✓ DoD: Un courier no entra a (merchant)
✓ DoD: Sin consentimiento guardado el comercio no llega al panel

52 passed (12.2m) [chromium]
3 passed (1.1m) [global-settings]
```

**Baseline completo de T-313: GREEN verificado.** La secuencia RED funcional anterior → fix D05-A → GREEN actual es válida para navegación y no debe repetirse.

## CI y sincronización

CI `37752334333`: audit, db-tests, unit, build, typecheck, lint y bundle-budget **GREEN**.
`approval-policy` `37753362975`: GREEN.
Vercel commit status: **success**.
Trusted `e2e-preview` commit status: **success**.
Branch: 50 ahead / **0 behind** de `develop`; mergeable. No hay migrations ni SQL propios en diff.

## H04 — avance parcial, NO cerrado

La parte «baseline E2E completo GREEN» está ahora demostrada con SHA y run exactos. Sigue faltando **RED discriminante seguro del control de courier + restauración/GREEN final** conforme a la regla de pruebas. No afirmar que el RED del fallo de navegación demuestre sensibilidad del E2E a una regresión de la guarda courier.

T-347 `e2e-mutation` solo admite `target=develop` y mutaciones catalogadas, no pruebas sobre PRs abiertas con guardas debilitadas. **No pushear ni desplegar guardas desactivadas**, no inventar una mutación ni cerrar H04 por inferencia. La secuencia segura de cierre requiere decisión de Lautaro073 / ajuste de plan antes del merge.

## H10 — documentación todavía desactualizada

El body reconoce D05-A pero afirma:
- Vercel `failure`, rate-limit y ausencia de deploy, **obsoleto** frente al status actual `success`;
- último Preview `37747382851` RED, omitiendo el actual `37803965180` GREEN;
- DoD general y checkbox de RED permanecen sin marcar (el de RED debe mantenerse pendiente hasta la mutación segura de H04);
- informe de agy dice CON BLOQUEANTES (1) y da solo el bloqueo de rate limit, pero falta reflejar H04 + evidencia RED pendiente y H10;
- aparecen caracteres `?` sustituyendo tildes y signos en múltiples textos del body, revisar codificación UTF-8.

Corregir body y bitácora con evidencia actual: 52 Chromium + 3 global-settings, D05-A, P3 confirmado por Lautaro073 y estado residual H04. No inventar RED de courier. Puede marcar el DoD funcional de los tres casos como verificado, **sin** cerrar H04 de cobertura RED.

## P3 y alcance

Lautaro073 confirmó el visto bueno P3; no debe falsificarse un review GitHub. El delta de D05-A respetó el alcance expresamente autorizado.

## Veredicto

**CON BLOQUEANTES (2 heredados); 0 nuevos.** La funcionalidad del flujo está comprobada GREEN. Falta cerrar H10 y resolver la prueba RED segura de H04. No aprobar ni mergear.
