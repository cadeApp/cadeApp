# Lecciones de la PR #298

## Ronda 1

Los patrones dominantes fueron P08 (el test no cubre lo que dice) y P04 (test tautológico).

## Ronda 2

### Un colector asíncrono debe probar que observó el canal

Una lista de fugas vacía no demuestra privacidad si el response relevante todavía no ocurrió. Para invariantes de red, la prueba debe exigir una evidencia positiva de observación (URL/evento/canal) y recién después afirmar ausencia del dato prohibido.

### Un locator accesible también debe ser unívoco

Usar rol + nombre es correcto, pero si la pantalla tiene dos controles con el mismo nombre la prueba debe acotar por región/sección o comprobar explícitamente cuál elige.

No se propone AG nueva: ambos casos siguen siendo P08 y ya caben en las reglas actuales.

## Ronda 3

### P08 — rojo del E2E no es rojo de una mutación
El Preview real detectó cinco fallos de una suite recién incorporada. `pnpm typecheck`, `pnpm lint`, `pnpm test` y discovery de Playwright no son evidencia de E2E funcional; toda afirmación de GREEN debe referir al SHA y run real.

### P08 — `.first()` de un ancestro no define ámbito semántico
Un `div` que contiene el encabezado puede abarcar el formulario entero. Para un control homónimo, el ámbito debe ser la Card más cercana que contenga ambos, o una región accesible inequívoca.

### P08 — pruebas de rol deben entrar autenticadas
Seed de datos no equivale a sesión del navegador. Al cambiar de courier a comercio, cambiar sesión/contexto de forma explícita antes de visitar rutas protegidas.

La regla de `e2e/AGENTS.md` (GREEN del caso base y mutaciones trusted después de mergear) ya establece el proceso; sin nueva regla AG.

### No leer cuerpos de responses CDP después de un momento arbitrario

El nuevo control de privacidad observa el response vivo pero falla al hacer `response.text()` por `Network.getResponseBody` sin recurso. Para pruebas críticas, conservar el body en el momento de interceptarlo mediante `route.fetch` y fallar explícitamente ante imposibilidad de lectura.

## Ronda 4

### P08 — una suite verde puede coexistir con un crash en otro caso del mismo mock

El caso de cero llamadas a Google quedó verde porque solo midió intercepciones, aunque el `Marker` clásico rompió dos páginas. La prueba de mocking debe exigir un test positivo de funcionamiento, no solo contar tráfico.

### P08 — mocks de SDK: cubrir interfaces de ambos caminos

El E2E postmatch usa `AdvancedMarkerElement`; el E2E del selector de pin puede usar `Marker` clásico sin mapId. Un stub compatible con el primer camino puede seguir incompleto para el segundo. La traza reveló `setDraggable` ausente. La API de listeners debe soportar cleanup idempotente.

No se crea regla AG nueva: P08 ya captura la causa general. No se afirma que el test aislado pruebe el runtime integrado.

## Ronda 5

### Validar el SHA efectivamente ejecutado, no el head del workflow dispatcher

El workflow `e2e-preview` usa `repository_dispatch` y su GitHub `head_sha` es `develop`. El SHA del PR debe comprobarse dentro del job de checkout y cotejarse con el código revisado. En R5 se encontró `git checkout --force 10f0e4fe`, luego la bitácora movió el HEAD sin cambiar el spec.

### Una prueba de mock debe exigir que el componente se haya montado

El smoke de intercepciones podía quedar verde con el mapa crasheado. H07 se cerró al agregar comprobación de MapPicker/MapContainer montados y completar `Marker.setDraggable`. No se propone AG nuevo porque es P08, ya cubierto.

### Mantener separada evidencia ejecutada de evidencia declarada

La ejecución CI 52/52 se validó leyendo logs. El autor informa mutación de Marker GREEN/RED y unit local 2004/0, pero esas últimas no fueron reproducidas en esta sesión de revisor y quedan señaladas como evidencia del autor, no propia.
