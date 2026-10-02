# Lecciones — PR #180 / T-307

## Ronda 1

No se agrega número AG nuevo.

- **H01 / P08:** un E2E de Realtime no puede sustituir la aplicación por dos `fetch()` manuales al mismo mock. La propiedad observable tiene que ser la UI actualizada por el canal real.
- **H02 / P08:** “hubo alguna request” no equivale a “la query se refetcheó”. Si el propio test genera una request que satisface el detector, el control certifica su estímulo y no el comportamiento del producto.
- Para reconexión, registrar la URL exacta de la query activa y tomar un contador baseline antes de `setOffline(false)`; ninguna request manual del spec debe poder satisfacer la aserción.
- **H04 / AG-36:** la autorrevisión del agy se conserva para contraste, pero no puede ocupar la ronda de revisión independiente ni marcarse como verificación.
