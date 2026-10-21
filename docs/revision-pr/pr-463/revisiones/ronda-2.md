# Ronda 2 — PR #463 / T-381

**Fecha:** 2026-10-20. **SHA funcional revisado:** `00b3f6d5f020154515f3cc9ea360f251880d992e` (rama `feat/T-381-merchant-panel-refresh`). **Base:** `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265`.

## Resultado: SIN BLOQUEANTES de código — gate final pendiente

No se encontraron nuevas decisiones ni bloqueantes después del arreglo de PR463-H01. **Esto NO autoriza merge sin CI oficial E2E y checks de protección**, ni es aprobación formal.

### PR463-H01 — corregido y contrastado

El commit `00b3f6d5f020154515f3cc9ea360f251880d992e` modifica **únicamente**:
- `src/features/requests/hooks/use-merchant-panel-refresh.test.tsx` (+15/-1), y
- `docs/tasks/log/T-381.md` (+20).

No cambia hook productivo, contratos, migraciones, RLS/RPC, dependencias, workflow ni ficha.

En el test revisado, primero se ejercita `focus` por sí solo (1 llamada); `hidden` no genera refresco; **`visible` se dispara de forma aislada**, sin `focus` ni callback Realtime. Antes de 400 ms mantiene una llamada; al alcanzar 400 ms alcanza dos; después la ráfaga combinada agrega **solo una** llamada (tres en total). El cleanup sigue cubierto. En producción persisten tanto `document.addEventListener('visibilitychange', onVisibilityChange)` como la guarda `visibilityState === 'visible'`.

El autor documentó el rojo de I01 antes del arreglo (27/27 GREEN con listener quitado), el rojo después (`1 failed / 26 passed`, esperado 2 recibido 1), y la restauración GREEN (27/27); su SHA y `git ls-remote` coinciden con el HEAD de GitHub. **El RED de Vitest es evidencia del autor, no una ejecución independiente de esta revisión.**

**Control propio:** sondeo estructural ejecutado leyendo los blobs exactos del HEAD. Condiciones positivas: bloque `visible` sin disparar foco/Realtime, borde `debounce - 1` y `+1`, expectativa explícita `toHaveBeenCalledTimes(2)`, ráfaga separada a 3 y registro real del listener. **Resultado: baseline PASS; mutación estructural I02 (quitar la línea de registro del listener en una cadena en memoria) produce FAIL en el contrato estático.** Este sondeo NO ejecuta React/Vitest y NO reemplaza el rojo runtime.

**Verificación adicional de ejecución independiente del autor:** job oficial GitHub Actions `unit` #`118875895826` sobre **el mismo SHA**. Log leído por la revisión:
- `use-merchant-panel-refresh.test.tsx` → **4 tests PASS**
- `merchant-requests-list.test.tsx` → **23 tests PASS**
- `Test Files 153 passed (153)`
- `Tests 2994 passed (2994)`
- Checks `typecheck`, `lint`, `build`, `audit` y `bundle-budget`: success.

El estado `arreglado-verificado` indica que **la revisión comprobó el arreglo por estructura más CI unit real del SHA**, NO que ejecutara por su cuenta la mutación I01 en Vitest. Se conserva esa limitación en `verificado_metodo` y en `evidencia/comandos.md`.

### PR463-A01 / D01 — aceptada, sin cambios

Lautaro073 eligió A: se mantiene `page.goto('about:blank')` del E2E de T-366 antes del seed para no provocar reconciliación anticipada. No amplió nuevamente el alcance. El E2E del autor contra Preview refiere `request-states` 15 passed; revalidación oficial E2E pendiente.

### CI y condiciones de merge

- El CI del `00b3f6d5` estaba con **`db-tests` en progreso** al redactar y `approval-policy` en fail por reporte faltante. `e2e-preview` oficial no se ejecutó en rondas, de acuerdo con decisión de Lautaro073.
- **Bloqueo de proceso (no bloqueante de código):** ejecutar **gate oficial completo**, incluido `e2e-preview` en el último push funcional con `CI=true --workers=1`, Chromium, reintentos iguales al CI y `global-settings`; comprobar T-366 y T-381. Un flaky debe quedar identificado, no escondido.
- La carpeta de revisión se actualiza en un commit documental **posterior** al SHA funcional; no exigir el gate E2E otra vez solo por ese commit de documentación, tal como establece la regla de usuario.
- Sin nuevos `🔵 DECISIÓN`. Sin mejoras que justifiquen otro cambio.

**Dictamen:** ronda de código sin bloqueantes. Mantener PR abierta sin merge hasta que el gate oficial requerido esté verde (o incidentes ajenos resueltos bajo su propio criterio). **No aprobar ni mergear.**
