# Ronda 9 — PR #180 / T-307

**HEAD final:** `99cae80ae81c1f0a98e5824d14911ce1ec34ac6a`
**Resultado:** **CON 1 BLOQUEANTE DE PROCESO / CÓDIGO TÉCNICAMENTE GREEN**

## GREEN final

- CI `37217156049` ✅
- trusted `37217237829` ✅
- Realtime ✅
- offline/form ✅
- reconnect ✅
- subscriber directo H10 ✅

## Mutaciones independientes

### H05 Realtime
- mutation `a461853e...`
- trusted `37215513829` ❌
- solo Realtime RED 3/3
- restaurado después

### H02 reconnect
- `refetchOnReconnect:false` solo: trusted `37216094876` siguió GREEN por latch T-333; no se contó como prueba.
- mutación del mecanismo efectivo de reconnect: `7064ba59...`
- trusted `37216660101` ❌
- solo reconnect RED 3/3
- restaurado en `99cae80a...`

El HEAD final tiene 0 diff neto respecto del código sano de Asako previo a las mutaciones.

## H10
✅ arreglado-verificado.

La app ahora propaga el JWT de la sesión a Realtime antes de suscribir el canal y el flujo real queda GREEN.

## H11 — BLOQUEANTE DE PROCESO

La ficha original no autorizaba:
- `src/lib/hooks/use-realtime-invalidation.ts`
- `src/lib/hooks/use-realtime-invalidation.test.tsx`

Asako modificó ambos y se agregó esas rutas a la propia ficha.

Regla aplicable:
- AGENTS.md: tocar solo archivos permitidos; si hace falta otro, detenerse y explicar.
- regla 50: tocar archivo fuera de ficha → preguntar a Lautaro.

### Decisión P1 requerida
A. Autorizar explícitamente, de forma excepcional y retroactiva, que T-307 incluya esos dos archivos. Recomendado por la revisión porque el fix es mínimo, correcto, probado y directamente necesario para cerrar H10.

B. No autorizar la ampliación: separar el fix Realtime en tarea/PR propia y volver T-307 a su alcance original.

Hasta decisión P1: **no aprobar ni mergear #180.**
