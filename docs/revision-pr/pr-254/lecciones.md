# Lecciones de la PR #254 para `AGENTS.md` y las reglas

**Fuente:** 8 registros tras cuatro rondas (`H01`–`H07` y `R01`). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

`P08-control-no-cubre-lo-que-dice` fue el patrón dominante. R3 agregó una regresión `P07-coincidencia-demasiado-amplia`; R4 la cierra con evidencia runtime.

## Ronda 4

No se propone AG nueva.

- **R01** confirma P07: un locator debe ser accesible y único. En Next, `role=alert` global puede colisionar con el route announcer; el contenido/área debe formar parte del selector.
- **H05** refuerza **AG-70**: cuando una mutación no se puede ejecutar por un guard fail-closed, la evidencia correcta es “no reproducido”, no una salida esperada redactada a mano.
- La decisión D01 agrega una separación útil: una propiedad puede quedar **aceptada por riesgo/proceso** sin fingir que fue verificada. El estado `aceptado` conserva esa diferencia.
- **H07** confirma el chequeo de sincronización por ronda: la validez de un Preview depende de la base contra la que finalmente se va a integrar.

## Follow-up

Issue #289 debe resolver la deuda de proceso: ejecutar mutaciones RED sobre un checkout efímero en un runner trusted, sin:
- secretos remotos en hosts locales;
- commits rotos publicados;
- debilitamiento de guards fail-closed;
- mocks que sustituyan la propiedad bajo prueba.

## Advertencia de proceso

Rondas 1–3 fueron registradas por la revisión en la rama del autor. El procedimiento vigente para PR de P2/P3 exige `docs/revisiones`. R4 corrige el canal de entrega sin volver a tocar la rama ajena; el histórico previo se copia al registro canónico, no se reescribe en la rama del autor.