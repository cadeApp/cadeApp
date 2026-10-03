# Informe de revisión — PR #236 / T-333 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/236  
**Head SHA revisado:** `7a0247af065864f3906887f54160542e977d04aa`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — PR236-H01 sigue parcial

## Delta desde Ronda 1

Desde el commit de revisión `47bd862d184d9319ba51be6b8121a86a96495d4d` hay un solo commit de autor y exactamente tres archivos:

- `src/app/providers.tsx`
- `src/app/providers.test.tsx`
- `docs/tasks/log/T-333.md`

No hubo cambios del autor en la carpeta de revisión ni en `e2e/specs/notifications.spec.ts`.

## Lo que sí quedó bien

La implementación no agrega `refetch()`, `invalidateQueries()`, `router.refresh()` ni listeners por hook. Centraliza el mecanismo en `Providers` y devuelve cleanup de los listeners desde el setup de `onlineManager.setEventListener`.

El test usa el `Providers` real y el `onlineManager` real; no mockea la frontera evaluada. La bitácora conserva los RED/GREEN de las mutaciones y corrige las hipótesis descartadas por el artifact.

CI del SHA exacto `7a0247af065864f3906887f54160542e977d04aa`:

```text
unit: 115 passed (115)
tests: 1744 passed (1744)
providers.test.tsx: 1/1
use-request-offers.test.tsx: 14/14
use-realtime-invalidation.test.tsx: 12/12
typecheck: SUCCESS
lint: SUCCESS
build: SUCCESS
db-tests: SUCCESS
bundle-budget: SUCCESS
preview E2E: chromium 20/20 + global-settings 3/3
audit: FAILURE por braces (externo a T-333 / T-332)
```

## PR236-H01 — PARCIAL, no cerrado

### Qué cambió

R1 pidió cubrir navegador → `onlineManager`. El autor agregó:

```ts
onlineManager.setEventListener((setOnline) => {
  const handleOnline = () => setOnline(true);
  const handleOffline = () => setOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  setOnline(navigator.onLine !== false);

  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
});
```

y un test que fuerza `navigator.onLine = false` antes de renderizar, exige `onlineManager.isOnline() === false` y luego despacha `online` / `offline`.

### Por qué ese RED no demuestra la corrección del defecto original

La API oficial de TanStack Query v5 indica que `onlineManager` **ya escucha por defecto** los eventos `online` y `offline` de `window`. `QueryClientProvider` monta/desmonta el `QueryClient`, que se suscribe a los eventos online/focus.

Eso significa que, en una página que ya arrancó online, estas dos líneas del bridge:

```ts
window.addEventListener('online', handleOnline);
window.addEventListener('offline', handleOffline);
```

replican el mecanismo por defecto del framework.

La diferencia nueva y demostrada por el test es:

```ts
setOnline(navigator.onLine !== false);
```

al montar.

Pero el trusted E2E original no arrancó offline. Su secuencia fue:

```text
página online
GET inicial 200
baseline = 1
setOffline(true)  -> aviso offline visible
setOffline(false) -> vuelve online
15 s después: count = 1
```

Por lo tanto, sincronizar el estado inicial offline no explica ese RED.

### El test actual no discrimina bridge vs sync inicial

Hay una mutación crítica que falta ejecutar:

```ts
useEffect(() => {
  onlineManager.setOnline(navigator.onLine !== false);
}, []);
```

sin `onlineManager.setEventListener` personalizado.

Si el test actual queda GREEN —resultado esperable porque los eventos posteriores los seguiría manejando el listener default de TanStack— entonces el control no demuestra que el bridge arregle reconnect. Solo demuestra la sincronización inicial.

La mutación MB de la bitácora neutralizó **todo** el bridge, incluida esa sincronización inicial, así que su RED tampoco discrimina ambas propiedades.

### Corrección de la revisión

R1 prescribió `setEventListener` demasiado pronto. La evidencia disponible solo justificaba demostrar la frontera; no justificaba reemplazar el listener del framework antes de comparar contra su comportamiento por defecto. Esta ronda corrige esa instrucción.

### Arreglo / diagnóstico requerido

No agregar otro mecanismo.

Primero escribir un control de composición que replique literalmente la secuencia fallida con el `Providers` real y una query activa:

1. `navigator.onLine = true`, `onlineManager.setOnline(true)`.
2. Renderizar `Providers` con un componente hijo que ejecute una query con `refetchOnReconnect: 'always'`.
3. Esperar el fetch inicial y fijar baseline.
4. Poner `navigator.onLine = false` y despachar `offline`.
5. Exigir `onlineManager.isOnline() === false`.
6. Poner `navigator.onLine = true` y despachar `online`.
7. Exigir `onlineManager.isOnline() === true` **y una llamada posterior al baseline**.

Luego correr el mismo control contra el estado previo al bridge (`47bd862`, con solo el import de React si Vitest lo requiere).

- Si previo al bridge = RED y actual = GREEN: el bridge queda demostrado y H01 puede cerrar.
- Si ambos = GREEN: el bridge no es la causa; no adulterar el test. Revertir el override innecesario o justificar por separado la sync inicial, y continuar diagnóstico de la diferencia con Playwright real.
- Si ambos = RED: seguir diagnosticando; no agregar refetch manual.

Mantener intactos los controles M1 y M2 ya demostrados.

## PR236-H02 — MEJORA

El cuerpo actual del PR quedó desactualizado:

- dice `src/app/providers.tsx: sin cambios`;
- mantiene «Diagnóstico de reconexión (abierto)» afirmando que un bridge duplicaría TanStack;
- no refleja el commit `7a0247af065864f3906887f54160542e977d04aa` ni el test nuevo.

Antes de cerrar la PR, actualizar el cuerpo para que describa el HEAD real y la evidencia final. No requiere cambio de código.

## CI y estado de merge

- Rama al día con `develop` y mergeable.
- El job `audit` sigue rojo exclusivamente por la vulnerabilidad `braces` ya aislada en T-332.
- El preview E2E de #236 sigue sin contener `notifications.spec.ts`; no se usa como evidencia del control externo de T-307.

## Checklist

- [x] Delta R1 → R2 enumerado.
- [x] Scope respetado.
- [x] Autor no tocó carpeta de revisión.
- [x] Unit exact-head 1744/1744.
- [x] Focales de T-333 presentes en CI.
- [x] Preview E2E exact-head verde para los specs descubiertos.
- [x] M1/M2 documentadas y focales actuales verdes.
- [ ] Control discriminante de secuencia online → offline → online contra baseline.
- [ ] Mutación «solo sync inicial, sin bridge» ejecutada.
- [ ] H01 cerrado con evidencia causal.
- [ ] Cuerpo del PR actualizado.
- [ ] Control externo PR #180 post-merge.
