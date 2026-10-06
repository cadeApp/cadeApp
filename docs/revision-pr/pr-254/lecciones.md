# Lecciones de la PR #254 para `AGENTS.md` y las reglas

**Fuente:** 8 registros tras tres rondas (`H01`–`H07` y `R01`). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

`P08-control-no-cubre-lo-que-dice` sigue dominando la PR. R3 agrega además una regresión `P07-coincidencia-demasiado-amplia`: al endurecer los E2E se eligieron locators accesibles pero no únicos en el DOM real.

## Ronda 3

No se propone AG nueva.

- **R01** refuerza P07: un locator de Playwright debe ser semántico **y único**. `role=alert` global no alcanza en Next porque el route announcer también usa `role=alert`; el selector debe acotarse por el contenido/área que representa el error. Para controles de formulario, preferir el rol real (`radio`, `checkbox`, `button`) sobre texto visible genérico.
- **H05** vuelve a confirmar **pr-63/AG-70**: una salida RED no se redacta desde lo que se espera. Si el entorno fail-closed corta antes, eso se registra como `no reproducido`, no como demostración de la mutación.
- **H07** refuerza el chequeo de sincronización de cada ronda: un CI verde sobre una rama 48 commits detrás no certifica la integración que se va a mergear.

## Qué cambiar, en orden de impacto

1. Corregir locators con la semántica accesible más específica disponible.
2. Exigir Preview GREEN exacto sobre la rama ya mergeada con `develop`.
3. Mantener separadas evidencia del autor y verificación independiente; no promocionar a `verificado_en_sha` lo que el reviewer no reprodujo.

## Advertencias

- El `e2e-preview` fue útil aquí precisamente porque el host local del autor falla cerrado sin credenciales. No sustituye la honestidad sobre las mutaciones que no se pudieron reproducir.
- Los fallos de R01 son del spec, no de producción: el propio log muestra el mensaje real de DNI duplicado y los flujos MFA pasan.