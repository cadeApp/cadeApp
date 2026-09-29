# Lecciones de la PR #67 para `AGENTS.md` y las reglas

**Fuente:** 5 hallazgos en una ronda. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## AG-59 (refuerzo) · `as unknown as AppSupabaseClient` se sigue propagando

Tercera ocurrencia del patrón: PR #61 (`actions.ts`), y ahora PR #67 (`actions.ts` + `queries.ts`).
Cada feature nueva que usa `createClient()` de `src/server/supabase/server.ts` copia el cast
porque el return type no matchea `SupabaseClient<Database>`.

Mientras no se haga el `contract-change` en `server.ts`, esto se va a seguir propagando.
Conviene priorizarlo antes de que haya 5+ features con el workaround.

## AG-61 · Tailwind no reporta clases que no existen

`text-success` no está en `tailwind.config.ts` y Tailwind silenciosamente no genera CSS
para ella. No hay advertencia en build, en lint ni en los tests. El resultado es que el
feedback visual de "Pin fijado" queda sin el color verde que se pretendía.

Esto pasa porque Tailwind genera utilidades por demanda a partir del `content` scan, pero
no valida que las clases usadas en el código correspondan a utilidades reales. Es un
problema estructural sin solución fácil fuera de un plugin de lint o un test de Stitch.

> **Lección:** antes de usar una clase de color, verificar que el token exista en
> `tailwind.config.ts` o en la hoja base de CSS. Si no existe, o se agrega ahí (con un
> PR que toque el archivo) o se usa un token existente. `grep` sobre el config es la
> verificación más rápida.

## Observación sobre la autorrevisión

La autorrevisión del PR declaró "SIN BLOQUEANTES" y "MEJORAS: ninguno". La revisión
independiente encontró 1 bloqueante y 4 mejoras. El bloqueante (H01) es invisible a los
checks automáticos, lo que refuerza la misma observación de PR #56: la autorrevisión
encuentra lo que los checks dicen, no lo que un ojo distinto mira.
