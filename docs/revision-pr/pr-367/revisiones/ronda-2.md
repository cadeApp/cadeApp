# PR #367 — Ronda 2: corrección documental verificada por diagnóstico CI

**Fecha:** 2026-10-15. **HEAD con defecto:** `a18abc2211063096687ed507d069d857c44dada1`.

**Hallazgo PR367-H01, bloqueante en R1 omitido por esta revisión:** el job `unit` del [CI 38683250335](https://github.com/cadeApp/cadeApp/actions/runs/38683250335) terminó en `failure` en `tools/verify-fichas.test.ts` con 2 tests RED genuinos: autorreferencia ausente en Archivos permitidos de T-367/T-368; falta de filas en `docs/implementation-plan.md §8`. No es un problema preexistente ni un test falso: estas fichas nuevas lo provocaron.

## Arreglo
- Agregadas las rutas `docs/tasks/T-367.md`, `docs/tasks/T-368.md` y `docs/implementation-plan.md` a Archivos permitidos de cada ficha.
- Incorporadas filas T-367/T-368 a §8 y sincronizado literalmente el primer checkbox DoD de cada ficha con la última columna del plan; `tools/verify-fichas.test.ts` también verifica esta igualdad y habría fallado si solo se agregaba la fila.
- No se cambió el test, CI, dependencias ni código productivo.

**Estado: arreglado-sin-verificar hasta comprobar unit/CI del nuevo HEAD.** La inspección de las nuevas entradas no sustituye la ejecución. El error de R1 se registra explícitamente; el dictamen final debe basarse en el HEAD corregido.
