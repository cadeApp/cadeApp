# PR #112 · T-123 — Ronda 3

- **SHA revisado:** `da4c103c4e4ab874b0f64250f78c64800d9c07ad`
- **Base:** `7f392e9f0fc020f9dcf6838d1638cbbe4004d7ac`
- **Estado:** Draft · implementación GREEN
- **Resultado:** **CON BLOQUEANTES (1)**
- **Nuevo bloqueante:** PR112-H04
- **Decisiones:** D06-A, D07-A

## Preflight y alcance

- La PR continúa abierta, mergeable y Draft.
- HEAD remoto verificado: `da4c103c4e4ab874b0f64250f78c64800d9c07ad`.
- No se observa necesidad de tocar `src/ui/**` para el hallazgo nuevo.
- H01–H03 permanecen cerrados.
- D05-B sigue siendo una excepción aceptada, no cumplimiento de Regla 25.

## CI del SHA

Run `36304479891`:

```text
typecheck       PASS
lint            PASS
unit            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS

Test Files      73 passed (73)
Tests           886 passed (886)

db-tests        Files=12, Tests=1529, Result: PASS
build           Compiled successfully · 45/45 páginas
```

El código y la regresión general están verdes en CI.

## PR112-H04 — BLOQUEANTE

### A03 no demuestra Escape + devolución de foco

`src/features/admin/components/merchants-table.test.tsx` prueba que el botón “Editar plan” abre el Dialog y que los dos modos envían payloads correctos, pero no prueba la propiedad de accesibilidad de cierre por teclado.

La secuencia que falta es vinculante:

1. obtener el botón “Editar plan” y darle foco;
2. hacer click para abrir;
3. esperar `role="dialog"`;
4. enviar `Escape`;
5. esperar que el Dialog desaparezca;
6. exigir `document.activeElement === editButton`.

Esto es especialmente importante porque A03 usa un `Dialog` controlado abierto desde el botón de la tabla, sin `DialogTrigger` local. El componente base tiene lógica de recuperación de foco, pero la feature no posee un control que impida una regresión.

### RED obligatorio

Agregar el test en `merchants-table.test.tsx` sin cambiar fixtures, mocks ni expectativas existentes.

Después demostrar que el control es sensible con una mutación temporal en `merchants-table.tsx`: en el handler de “Editar plan”, hacer `event.currentTarget.blur()` inmediatamente antes de `setEditing(merchant)`.

Con esa mutación, el test de Escape + foco debe ponerse rojo. Restaurar el archivo exactamente y volver a correrlo verde.

Si el test falla también sin mutación, ajustar únicamente el wiring de A03 para devolver el foco al disparador. **No tocar `src/ui/**`.**

## D06-A — aceptada

La columna “Entidad” de A06 se mantiene como está:
- tipo de entidad;
- ID corto;
- parámetros con etiqueta amigable cuando corresponda.

No se agregan consultas para resolver nombres de comercio/repartidor. Esto evita lookups innecesarios y no amplía exposición de datos personales.

## D07-A — aceptada/diferida

Las capturas se difieren a **T-300/staging** con sesión admin `aal2` real:

- A03 a 1280 px;
- A03 a 1024 px;
- A04 a 1280 px;
- A04 a 1024 px;
- A06 a 1280 px;
- A06 a 1024 px.

En ese mismo carry-over se comprobarán foco visible y contraste. En T-123 estas evidencias quedan **aceptadas/diferidas, no verificadas**.

## Resultado

**T-123 no está lista para merge.**

Queda un único bloqueante: **PR112-H04**. Después del commit del arreglo hace falta una nueva ronda para verificar el test, su mutación RED y el CI del SHA resultante.
