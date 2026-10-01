# Lecciones — PR #162 / T-320

## Ronda 1

No se agrega numeración AG nueva.

### H01 — una llamada no demuestra una postcondición

Refuerza **P08** y la lección de PR #142: en Auth hay que observar efectos laterales, no solo que un método haya sido invocado. Para `signOut({ scope: 'others' })`, la clase incluye tanto `{ error }` resuelto como una Promise rechazada.

### H02 — no clasificar semántica por copy del proveedor

Refuerza **P07**. Un texto remoto que contiene “session” no equivale a “no hay sesión”. La clasificación debe apoyarse en señales estructuradas.

### H03 — enumerar literalmente los ataques que nombra la ficha

Refuerza **pr-56/AG-37** y **P06**. Una batería de open redirect no queda completa solo porque cubra variantes parecidas; si la ficha llama a out percent-encoding, esa representación debe aparecer en el test.

### H04 — reutilizar el patrón accesible existente

Refuerza **P13**. Login/register ya resuelven toggle de contraseña con target 48×48 y foco visible; una pantalla nueva no debe reimplementar una versión más débil. Tampoco debe componerse `Link > Button` cuando ambos renderizan elementos interactivos.
