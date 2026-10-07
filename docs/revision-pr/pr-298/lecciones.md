# Lecciones de la PR #298

## Ronda 1

Los patrones dominantes fueron P08 (el test no cubre lo que dice) y P04 (test tautológico).

## Ronda 2

### Un colector asíncrono debe probar que observó el canal

Una lista de fugas vacía no demuestra privacidad si el response relevante todavía no ocurrió. Para invariantes de red, la prueba debe exigir una evidencia positiva de observación (URL/evento/canal) y recién después afirmar ausencia del dato prohibido.

### Un locator accesible también debe ser unívoco

Usar rol + nombre es correcto, pero si la pantalla tiene dos controles con el mismo nombre la prueba debe acotar por región/sección o comprobar explícitamente cuál elige.

No se propone AG nueva: ambos casos siguen siendo P08 y ya caben en las reglas actuales.
