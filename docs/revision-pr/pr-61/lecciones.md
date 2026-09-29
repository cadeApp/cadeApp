# Lecciones de la PR #61 para `AGENTS.md` y las reglas

**Fuente:** 9 hallazgos en la ronda 1 (`PR61-H01` a `PR61-H09`). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Contraste con la autorrevisión del agy

El cuerpo del PR llegó con el bloque de `revisar-pr` firmado como:

> `Resultado: SIN BLOQUEANTES · MEJORAS: ninguno`

La revisión independiente encontró **4 bloqueantes** (1 alto de consentimiento con fallback y 3 medios de tipado, arquitectura y convenciones de formularios) y **5 mejoras**. Es el mismo patrón de las PRs #56 y #60: la autorrevisión comprueba que los checks corrieron, pero no detecta los supuestos implícitos con los que se escribió el código.

## Lecciones propuestas

### AG-54 (refuerzo) · Un fallback silencioso para la versión de consentimiento produce un registro inválido sin aviso

**Origen:** `PR61-H04` (`actions.ts:59-64`)

El mismo patrón de AG-54 (PR #60, rol por defecto) aplicado a un dato legal: si `platform_settings.pilot_terms_version` no se encuentra, el código inventa `'1.0'` y registra el consentimiento con esa versión. El consentimiento tiene valor probatorio; si la versión es incorrecta, el registro no sirve.

> **Regla (ya propuesta, aplica idéntica).** Si una lectura del servidor falla o devuelve `null` y el dato tiene valor probatorio o de seguridad, la acción debe fallar con un código de error, nunca fabricar un valor por defecto.

### AG-59 · `as unknown as` en código de producción es equivalente a `@ts-ignore`

**Origen:** `PR61-H02` (`actions.ts:19`)

El doble cast se usó para resolver una incompatibilidad de genéricos de `SupabaseClient` sin modificar el tipo devuelto por `createClient()`. El compilador no puede verificar nada después de `as unknown`, por lo que cualquier error de tipo queda oculto hasta runtime.

> **Regla propuesta.** Prohibir `as unknown as` en código de producción (`src/`, excluyendo `*.test.ts`). Si hay una incompatibilidad de tipos legítima, la solución es ajustar el tipo en la fuente (vía `contract-change` si es compartido), no forzarlo en la feature.

### AG-60 · Los formularios usan `react-hook-form` + `zodResolver`, no `useState` manual

**Origen:** `PR61-H03` (`onboarding-form.tsx:17-26`)

La regla 25 ya lo dice, pero esta es la primera evidencia medida: 8 estados con `useState`, validación manual duplicada, sin errores inline por campo. El formulario funciona, pero establece un patrón que se va a copiar a las 6 features restantes de la Fase 1.

> **Regla (ya existente, sin cambios).** La regla 25 la cubre; lo que falta es un control. Considerar una regla de lint que detecte `useState` + `onSubmit` en componentes con más de 3 campos de formulario y recomiende `useForm`.
