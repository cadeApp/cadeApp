# Revisión PR #122 — T-205

> La revisión anterior de esta PR fue descartada por indicación de Lautaro073. Este documento la reemplaza por completo y vuelve a numerar la revisión vigente como **Ronda 1**.

- **PR:** #122 — `[T-205] Pasada de accesibilidad y rendimiento en las pantallas de comercio y repartidor`
- **Rama:** `feat/T-205-accesibilidad-rendimiento`
- **Base:** `develop@ae514947a467de4bd2f4e8deb96aff542a3e79c3`
- **SHA funcional revisado:** `5ff06783a0b70558c03d05d91c9b55dd7d1c2b3a`
- **Ronda vigente:** 1
- **Resultado:** **CON BLOQUEANTES (3)**
- **Mejoras no bloqueantes:** 1
- **Estado observado:** PR abierta, no Draft, 0 commits behind / 3 ahead.
- **CI:** no se usa todavía como criterio de cierre porque esta ronda tiene bloqueantes.
- **Ejecución local independiente:** no disponible en este entorno; no se atribuyen tests/build/browser no ejecutados por el revisor.

## Bloqueantes

- `PR122-H01` — la pasada de accesibilidad está incompleta: quedan targets de 40 px, un salto real `h1 -> h3` y animaciones que no respetan el mecanismo de reduced motion del proyecto.
- `PR122-H02` — `dod-t205.test.tsx` declara cobertura amplia pero contiene controles que pueden quedar verdes aunque se rompa la regla que dicen probar.
- `PR122-H03` — la ficha marca como completadas axe/Lighthouse/navegador/capturas sin evidencia reproducible en PR o bitácora; además H01 demuestra que al menos parte de ese cierre es materialmente falso.

## Mejora

- `PR122-H04` — la bitácora referencia como último commit `f7fe5dd`, SHA que GitHub no resuelve; el HEAD funcional real revisado es `5ff06783...`.

Detalle: `revisiones/ronda-1.md`. Evidencia y reproducciones: `evidencia/comandos.md`.
