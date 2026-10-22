# Lecciones — PR #536 / T-413

La actualización es una intervención de dependencias de alcance acotado. No se identificaron defectos de código, tests falseados ni nuevas familias de fallas. **0 hallazgos; no corresponde inventar AG-nn.**

Observación de proceso no clasificada como hallazgo: el check `audit` tiene una rama condicional advisory en configuraciones sin contratos/esquema; en este repositorio y SHA verificamos que se ejecutó la rama estricta, y el log confirma GREEN real. `approval-policy` valida el formato del cuerpo, no la autoría del informe: la evidencia independiente sigue siendo necesaria.

Los gates `db-tests` y `e2e-preview` permanecían pendientes cuando se escribió la ronda. Registrar su resultado final antes de mergear, sin fabricar CI green a partir del color del check.

**Autocorrección de herramienta (AG-60 preexistente):** antes de cerrar, se detectó que el primer harness hacía matching de sufijos de nombres de paquetes (`next` dentro de `eslint-config-next`). La evidencia corregida ancla claves YAML completas y muta solo la clave prevista. No se agrega un hallazgo contra el código del autor ni una numeración AG nueva.
