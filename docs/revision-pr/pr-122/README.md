# Revisión PR #122 — T-205

> La revisión descartada original sigue fuera de vigencia. **Ronda 6 es una corrección del reviewer, sin cambios funcionales nuevos del autor.** Corrige un error de proceso introducido en las Rondas 4–5.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **SHA funcional de autor vigente:** `bae8c771e2a42c20a45764cc984fefb5265de160`
- **HEAD antes de esta corrección:** `2276749641b5bd242707386ac08416381736096c` (solo docs del reviewer)
- **Ronda vigente:** 6 — corrección del reviewer
- **Resultado:** **CON BLOQUEANTE (1)**
- **CI final:** no se consulta todavía porque el DoD runtime de H03 sigue abierto.
- **Ejecución local independiente:** no disponible; no se atribuyen axe/Lighthouse/browser que el reviewer no ejecutó.

## Corrección del reviewer

El protocolo obligatorio para prompts de arreglo dice explícitamente:

- **prohibido crear archivos nuevos**;
- **los scripts auxiliares van en `/tmp`**.

En Ronda 4 el reviewer pidió versionar un harness browser dentro de la rama. Esa instrucción fue incorrecta. Por arrastre, R04–R07 evaluaron y endurecieron un entregable que **no debía haberse exigido dentro del PR**.

Por eso:

- `PR122-R04` — retirado del estado vigente;
- `PR122-R05` — retirado;
- `PR122-R06` — retirado;
- `PR122-R07` — retirado.

No se pide al autor otra ronda para “arreglar” esos puntos.

## Estado válido

- `PR122-H01` — arreglado-sin-verificar.
- `PR122-H02` — arreglado-sin-verificar.
- `PR122-H03` — **parcial y único bloqueante vigente**.
- `PR122-H04` — arreglado-sin-verificar.
- `PR122-R01` — arreglado-sin-verificar.
- `PR122-R02` — arreglado-sin-verificar.
- `PR122-R03` — arreglado-sin-verificar: las PNG actuales ya no muestran el clipping visual original.

## Bloqueo actual

La ficha autoritativa leída desde `develop` exige todavía:

- axe AA sin violaciones;
- Lighthouse móvil ≥ 80 rendimiento y ≥ 95 accesibilidad en las cinco superficies;
- verificación browser 390/360, reduced-motion, teclado, contraste y ausencia de overflow;
- auditoría de primitivas `src/ui/**`.

En la rama estos criterios siguen correctamente en `[ ]`, y la propia bitácora declara Lighthouse y axe pendientes.

Por lo tanto **T-205 todavía no cumple su DoD completo**, pero no hay otro bloqueante de código atribuible a esta corrección.

Detalle: `revisiones/ronda-6.md`.
