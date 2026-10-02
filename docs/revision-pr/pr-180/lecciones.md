# Lecciones — PR #180 / T-307

## Ronda 1

No se agrega número AG nuevo.

- **H01 / P08:** un E2E de Realtime no puede sustituir la aplicación por dos `fetch()` manuales al mismo mock. La propiedad observable tiene que ser la UI actualizada por el canal real.
- **H02 / P08:** “hubo alguna request” no equivale a “la query se refetcheó”. Si el propio test genera una request que satisface el detector, el control certifica su estímulo y no el comportamiento del producto.
- Para reconexión, registrar la URL exacta de la query activa y tomar un contador baseline antes de `setOffline(false)`; ninguna request manual del spec debe poder satisfacer la aserción.
- **H04 / AG-36:** la autorrevisión del agy se conserva para contraste, pero no puede ocupar la ronda de revisión independiente ni marcarse como verificación.

## Ronda 2

No se agrega número AG nuevo.

- **H05 / P08:** esperar que “todavía no se vea” un dato no prueba que la carga inicial haya terminado. Cuando la propiedad a demostrar es una actualización posterior, el E2E debe esperar explícitamente el response inicial, fijar un baseline y exigir una segunda observación después del estímulo.
- Un timeout menor al polling evita un falso positivo por polling, pero no evita un falso positivo por una request inicial todavía en vuelo.
- **Preview READY no equivale a E2E ejecutado.** La evidencia válida debe demostrar que el spec concreto de la tarea corrió contra el SHA concreto.
- Un gate trusted que corre desde la rama por defecto no puede ser “ampliado por la misma PR bajo prueba” y usado como evidencia de sí mismo; cualquier ampliación del gate debe aterrizar primero en la fuente trusted.
- Con Supabase Develop + Vercel Preview ya disponible, “no tengo staging local” deja de ser una justificación suficiente para omitir las mutaciones RED de E2E.
