# Informe revisar-pr — T-374 / PR #427 — ronda 2

**Fecha:** 2026-10-19  
**SHA funcional y documental del autor revisado:** `6fbd2de3542e991ed6eef4fb49c956e19d5464d1`  
**Base:** `develop@1e69477dae1e50cd67c307c9a0f987366f90c98e`  
**Resultado:** **SIN BLOQUEANTES TÉCNICOS (0)**, con un **gate de CI E2E Preview aún no satisfecho**. No autoriza merge.

## PR427-H01 — alcance regularizado y verificado

- La PR documental #429 está mergeada en develop y contiene `docs/tasks/T-374.md` con permisos explícitos para `.github/workflows/e2e-staging.yml`, `.github/workflows/verify-workflows.test.mjs`, la ficha, su bitácora y `docs/revision-pr/**`. No se amplió T-315 retrospectivamente.
- El diff completo de #427 en la base actual muestra únicamente **dos archivos funcionales**: una línea `timeout-minutes: 20 → 45` en el job `e2e` de staging y una aserción `assert.match(e2eJob, /^\\s+timeout-minutes: 45$/m)` dentro del test de workflows existente.
- Los restantes cambios son los informes históricos del revisor, la bitácora T-374 y tres casillas de su DoD. No se modificaron código de producto, specs, fixtures, workers, rutas de descubrimiento, `global-settings`, triggers, secretos, concurrencia ni el `continue-on-error`.
- El merge `b716660c` incorporó la rama develop que contiene la ficha y la rama remota permanece mergeable; ninguna modificación adicional de código se detectó después de `f1e47062`.
- **Estado de PR427-H01:** `arreglado-verificado` en el SHA indicado arriba, por inspección independiente de la ficha y el diff, sonda propia de mutaciones sobre fuentes remotas y confirmación de CI 79/79.

## Validación del control — no confundir niveles de evidencia

1. **Ejecución automatizada oficial sobre este SHA:** [CI 39305084513](https://github.com/cadeApp/cadeApp/actions/runs/39305084513) = `success`. Logs de `unit`: 79/79 pruebas de workflows y 6/6 ADR. `db-tests`: pgTAP 31 archivos / 2868 pruebas, resultado `PASS`. Typecheck, lint, build, audit y bundle-budget también verdes.
2. **Sonda independiente ejecutada sobre el texto real del HEAD publicado:** extracción del job `e2e` con el mismo algoritmo `job()` usado en el test; regex de timeout coincidió con el archivo original y dejó de coincidir con tres mutantes: 45→44, 45→46 y 45→20 con un `timeout-minutes: 45` distractor en otro job. Otros dos mutantes alteraron workers a 2 e insertaron `continue-on-error: true`: los guards preexistentes los detectaron. Ver harness reproducible en `evidencia/comandos.md`.
3. **Evidencia del autor:** bitácora T-374 con GREEN 79/79 → RED 78/79 tras 45→20 → GREEN 79/79, SHA-256 conservado y árbol limpio. **No se reejecutó ese harness exacto en un clon local independiente:** el acceso de red a GitHub desde el contenedor está restringido. No se presenta como reproducción de la suite completa.

## Gate externo pendiente: E2E Preview

- [Run 39305230026](https://github.com/cadeApp/cadeApp/actions/runs/39305230026), **intento 1**, E2E del PR #427: terminó `cancelled` al llegar al límite de 45 minutos del **workflow Preview**, con **85 passed / 4 flaky / 2 failed** (44,4 minutos). No es un PASS.
- Los dos tests fallidos fueron `main-flow.spec.ts:719` (T-360) y `t373-courier-cancellation-history.spec.ts:45` (T-373), con errores en `page.goto`, login y timeouts. No se pueden etiquetar como transitorios o preexistentes sin más evidencia.
- **Intento 2** de ese run estaba `in_progress` al cerrar esta revisión. El commit status `e2e-preview` sigue `pending`. Es un gate requerido de PR y **bloquea el merge por ahora**. La PR #427 **no** modifica `e2e-preview.yml`, sus specs ni el timeout de Preview; no debe ampliarse alcance de T-374 para ocultar este problema.
- `approval-policy` del HEAD revisado estaba rojo al realizar la inspección porque faltaba un informe `SIN BLOQUEANTES` en el cuerpo de la PR. Puede actualizarse con este informe fiel al estado de CI; `approval-policy` verde **no** reemplaza E2E Preview verde.

## Observaciones y condiciones de merge

- **BLOQUEANTES de implementación:** ninguno.
- **MEJORAS dentro de T-374:** ninguna obligatoria.
- **Gate operativo indispensable:** esperar la conclusión auténtica del intento 2 de E2E Preview. Si no pasa, diagnosticar con artefactos privados la causa de T-360/T-373, sin cambiar la cobertura ni aumentar los timeouts por intuición; una corrección fuera de la ficha requiere issue/tarea/PR aparte.
- `git diff --check` sobre todo el histórico puede señalar espacios finales en `revisiones/ronda-1.md` (salto Markdown de la ronda anterior). No lo edité, para preservar esa ronda; no es regresión funcional de T-374.
- **No revisado:** los E2E reales de staging solo se ejecutan después del próximo deployment. La ampliación a 45 se validó estáticamente y con la suite del workflow, no contra staging desplegado.
- **Autorización:** únicamente Lautaro073 decide mergear a develop. No realizar promoción a staging ni tocar #426 antes de integrar esta PR y resincronizar/revisar release.

**Conclusión:** PR427-H01 está resuelto, la implementación T-374 está conforme; la PR **NO está lista para mergear mientras falte un E2E Preview verde**. No se mergeó ni se aprobó la PR.
