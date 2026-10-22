# PR #122 — T-205 — Ronda 3

**Fecha:** 2026-09-29  
**SHA revisado:** `fc0108503a630746ffa05fa463603e3bd88f175f`  
**Resultado:** **CON BLOQUEANTES**

## Revalidación de Ronda 2

### PR122-R01 — arreglado sin verificar runtime

La ficha en `docs/tasks/T-205.md` volvió a coincidir con `develop` y mantiene en `[ ]` los tres criterios runtime pendientes. No se alteró el requisito “axe AA sin violaciones”.

### PR122-R02 — arreglado sin verificar runtime

`src/features/offers/courier-panel.test.tsx` ya no usa `levels[i]!` / `levels[i - 1]!`; ahora realiza guardas explícitas de `undefined` y conserva la misma aserción de jerarquía.

Las mutaciones RED/VERDE están declaradas por el autor, pero no pudieron ejecutarse independientemente en este entorno.

## PR122-H03 — sigue parcial y bloqueante

El autor mantuvo correctamente en `[ ]`:

- axe/Lighthouse/48 px/inputmode/bundle;
- navegador 390/360 + reduced motion + teclado + contraste + overflow + capturas;
- auditoría de primitivas `src/ui/**`.

Eso evita un falso cierre del DoD.

También documentó correctamente que:

- Lighthouse móvil sigue pendiente;
- axe AA real sigue pendiente;
- no hay preview Vercel autenticada disponible.

Sin embargo, la nueva evidencia browser **no valida el resultado que la tabla afirma**.

## PR122-R03 — La auditoría de overflow queda verde mientras las capturas muestran clipping

**Severidad:** alta · accesibilidad / test-coverage  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

La bitácora declara para las cinco superficies:

`Sin overflow (scrollWidth <= innerWidth)`

y marca 390/360 como ✅.

El revisor decodificó e inspeccionó visualmente las **14 PNG T-205** versionadas. En ambas anchuras se observa contenido cortado por el borde derecho en múltiples superficies.

Ejemplos inequívocos:

- `create_request_390x844.png` y `create_request_360x800.png`: el segundo botón de la fila “Fijar en mapa interactivo / Usar mi ubicación” queda recortado.
- `request_offers_390x844.png` y `request_offers_360x800.png`: el texto del estado vacío termina cortado a la derecha.
- `my_offers_390x844.png` y `my_offers_360x800.png`: la tercera pestaña “Otras” queda parcial o totalmente fuera de la captura.
- `identity_form_390x844.png` y `identity_form_360x800.png`: texto del banner y controles/documentación quedan cortados a la derecha.
- `vehicle_form_390x844.png` y `vehicle_form_360x800.png`: segunda columna, textos auxiliares y acciones quedan recortados.
- `trip_merchant_390x844.png` y `trip_merchant_360x800.png`: badge de estado, precio, botón Llamar, tercer estado del progreso y textos del mapa quedan truncados.
- `courier_feed_390x844.png` / `360x800`: el control de disponibilidad aparece cortado en el borde derecho.

Por lo tanto la evidencia visual contradice la columna “Sin overflow”.

### Por qué `scrollWidth <= innerWidth` no alcanza

El proyecto define en `src/app/globals.css`:

`body { overflow-x: hidden; }`

Un control basado únicamente en el ancho scrollable puede no detectar contenido que se sale del viewport y queda **clipeado** en vez de generar scroll horizontal. El criterio de aceptación es que la UI no desborde ni corte contenido, no solo que no aparezca una barra de scroll.

Además, las capturas no vienen acompañadas de un harness/URL/comando reproducible que pruebe que se capturó la ruta real completa con los globals exactos de la app. Las PNG son evidencia útil, pero hoy demuestran un fallo, no un cierre.

### Qué debe corregirse

1. No tocar producto a ciegas solo para “hacer linda” la captura. Primero reproducir en la ruta real/harness exacto y detectar elementos cuyo `getBoundingClientRect()` sale del viewport.
2. El control browser debe listar offenders, por ejemplo cualquier elemento visible con:
   - `rect.right > window.innerWidth + 1`, o
   - `rect.left < -1`.
3. El resultado debe ser **0 offenders** en 390 y 360 para cada superficie.
4. Recién si los offenders aparecen en la app real, corregir los layouts responsables.
5. Regenerar las 14 capturas y comprobar visualmente que ningún texto, control, tab, badge o botón queda cortado.

No volver a usar `document.documentElement.scrollWidth <= innerWidth` como única prueba.

## Auditoría src/ui

La bitácora ahora enumera las primitivas y su resultado. Parte de esa inspección es sustentable por código:

- Button: 48 px y focus ring.
- Input: 48 px y soporte de atributos nativos.
- BottomNav: targets >=48.
- tokens.css: reduced-motion desactiva `animate-pulse` y `animate-spin`.

Pero el checkbox debe permanecer `[ ]` hasta que la revisión browser real esté cerrada, porque la aceptación combinada todavía depende del comportamiento integrado de las pantallas.

## Lighthouse / axe

Siguen pendientes por declaración explícita del autor. No hay conflicto aquí: simplemente T-205 aún no cumple su DoD completo.

## Estado de aprobación

**No aprobar ni mergear todavía.**

Para una ronda aprobable:

1. corregir/repetir R03 con una auditoría de viewport que detecte clipping real;
2. producir capturas T-205 sin recortes visibles;
3. completar Lighthouse y axe, o mantener sus criterios en `[ ]` y no pedir cierre;
4. volver a revisión sobre SHA nuevo; recién entonces corresponde consultar CI final.
