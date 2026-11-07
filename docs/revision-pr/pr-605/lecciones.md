# Lecciones — PR #605, T-403

Esta ronda **no asigna un AG nuevo**: reutiliza patrones ya documentados y evita colisionar con la numeración de ramas remotas que no se pudo enumerar desde un clon local.

## PR605-H01 — P08: cobertura por correlación accidental

El fixture de la prueba «sin envío» carece también de vehículo. Al exigir que no aparezca, parece controlar `application_submitted`, pero el falso criterio `vehicle_type is not null` produce idéntico resultado. La demostración lógica (no ejecución SQL) se guardó en `evidencia/comandos.md`.

- **pr-56/AG-37**: enumerar la clase completa antes de reportar un caso; acá comparar las combinaciones vehículo × envío, no solo la fila «sin envío, sin vehículo».
- **pr-68/AG-75**: la mutación tiene que ser **independiente** de las que hizo el autor; las M1–M3 de la bitácora no demuestran la distinción vehículo/envío.
- **pr-63/AG-70**: no escribir «RED» desde lo que se esperaba; la mutación SQL/E2E no se pudo ejecutar en esta revisión y así queda dicho.

El SQL CC-044 actual usa `application_submitted`. El problema es que el E2E no lo defiende frente a un error futuro. Con D01=A el no enviado tiene vehículo y `application_submitted=false`, distinguiendo los predicados. El pgTAP equivalente queda fuera de T-403 y se registró en [#606](https://github.com/cadeApp/cadeApp/issues/606).

## Límites de observación

Las suites y los conteos citados provienen de logs de CI del SHA revisado, no de ejecución local. La tabla de verdad es una reproducción independiente limitada y **no sustituye** pruebas RED/GREEN reales. El presupuesto de bundle de /admin/applicants aparece como 265 kB, pero no se infiere causalidad sin medir la base.

---

## Ronda 2 — sin AG nuevo

La corrección añadió el estado disociador (`vehicle_type='moto'`, `application_submitted=false`) y corroboración positiva de persistencia vía `.select().single()`. Eso responde al patrón `P08` y `pr-56/AG-37` de la ronda anterior. La auditoría estática propia discriminó las versiones y una ablación, pero **no demuestra ejecución E2E** ni reemplaza una mutación SQL real. La práctica aplicable sigue siendo `pr-63/AG-70`: no presentar un RED hipotético como observado. Se conserva el pgTAP como seguimiento #606.

---

## Ronda 3 — cierre sin AG nuevo (2026-11-04)

La verificación independiente se hizo sobre un **job real terminado**, no sobre el GREEN declarado por el autor: `e2e-preview` del SHA `7e52b87` ejecutó `admin-applicants-search.spec.ts` y lo pasó al primer intento (28 s). La comparación entre `5ea4c55` y `7e52b87` contiene únicamente documentación de revisión; por tanto, el gate probó el mismo código corregido. La marca `arreglado-verificado` se registra en `7e52b87`, distinto del SHA donde el autor implementó D01=A.

**No confundir** `114 passed + 1 flaky` con `115 passed`: el caso T-376 del PDF falló en el primer intento esperando «En revisión manual» y pasó en retry #1. La suite de T-403 pasó sin retry. Los 6 tests `global-settings` pasaron aparte. El issue #606 mantiene la mutación SQL aislada como control futuro, sin bloquear la aceptación ya evidenciada por la ejecución real.
