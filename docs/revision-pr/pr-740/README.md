# PR #740 — revisión independiente T-436

**Estado Ronda 2 (2026-11-13):** sin nuevos bloqueantes de código en `f5f9b580a2f99410f801f1a0a29e08214fc48226`. H01 continúa verificado en `3350cdb4`; H02 y H03 corregidos y comprobados con controles independientes de alcance declarado; H04 con corrección inspeccionada y RED/GREEN locales documentados por el autor, **sin e2e-preview productivo verificado**. **NO APROBAR/MERGEAR** antes de obtener CI + E2E-preview GREEN sobre el SHA de implementación, o equivalente solo documental. Los dos `RED_CONFIRMED` sobre develop son post-merge y #669 sigue abierto. [Leer Ronda 2](revisiones/ronda-2.md).

**Historial Ronda 1 · 2026-11-13 · CON BLOQUEANTES (3): PR740-H02–H04.** H01 corregido y verificado. No aprobar ni mergear.

- PR: https://github.com/cadeApp/cadeApp/pull/740
- Rama: `feat/T-436-csp-enforce`; base `develop@d69eff7e8b6a05dff5535bd5a3da15d85b5c7239`.
- SHA de implementación revisado: `3350cdb48eb06893626e6d488549d4183805617e`. Paso 1 `fd27eaf1`, paso 2 `d062028d` y H01 corregido en `3350cdb4`.
- D5-A: Zod `jitless` en Providers. D4-A: `expectedFailure` provisional antes del merge; dos `RED_CONFIRMED` post-merge obligatorios y #669 abierto hasta obtenerlos. **Selección automática del agente con la opción recomendada, sin aprobación personal explícita de Lautaro073.**
- REST desde navegador sigue pendiente y no se declara cubierto. Storage y Realtime tuvieron E2E real PASS previo a enforce.
- `e2e-preview` GREEN sobre `3350cdb4` aún no confirmado al momento de revisar.

Entregables: [Ronda 1](revisiones/ronda-1.md), [hallazgos.jsonl](hallazgos.jsonl), [evidencia reproducible](evidencia/comandos.md), [lecciones](lecciones.md).

Este commit documental mueve el HEAD y vuelve a disparar CI: no exigir CI GREEN **solo por cambios documentales**. `verificado_en_sha` se refiere al SHA del autor comprobado, no al commit de la revisión. No aprobar ni mergear.
