# Lecciones de la PR #51 para `AGENTS.md` y las reglas

**Fuente:** 6 hallazgos de la ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Provisorio: la PR sigue abierta con 5 hallazgos sin cerrar. Se completa al cerrarla.

## Patrón dominante

Los tres hallazgos más graves tienen la misma forma: **algo que parece un control y no lo es.** Una variable que existe pero apunta al proyecto equivocado, un `if:` que saltea en vez de bloquear, y un test que busca un string en un archivo en vez de mirar el bloque que le importa. Los tres pasan en verde mientras no protegen nada.

Es una vuelta de tuerca sobre `P08-control-no-cubre-lo-que-dice`: acá el control no es incompleto, es **decorativo**.

## Lecciones propuestas

### AG-23 · Un secreto o variable por ambiente, y el control verifica a cuál apunta
**Origen:** H01

`migrate.yml` usa `${{ vars.SUPABASE_PROJECT_REF }}` en los jobs de staging y de producción. Es una sola variable de repositorio apuntando a staging, y ningún environment define una que la pise: producción aplicaría las migraciones a la base de staging **y reportaría éxito**. El guard solo comprobaba que no estuviera vacía.

> **Regla propuesta.** Todo recurso con más de un ambiente lleva una variable o secreto **por ambiente, con nombre distinto** (`..._STAGING_...`, `..._PRODUCTION_...`), nunca uno compartido que se resuelva por contexto. Y el paso que lo usa verifica **a qué apunta**, no que exista: en producción, fallar si el identificador coincide con el de staging. Un chequeo de no-vacío no distingue la base correcta de la equivocada.

### AG-24 · Un `if:` que saltea no es un control: un job salteado es verde
**Origen:** H02

`if: github.ref_name == 'main' && github.actor == 'Lautaro073'` se leía como «solo Lautaro migra producción». Lo que hace es **no ejecutar el job** cuando lo dispara otra persona, y un job salteado no rompe ningún check. El release saldría con el código y sin la migración, en verde.

> **Regla propuesta.** Una condición de autorización nunca va en el `if:` de un job. Va en el **environment** con revisores obligatorios, que bloquea; o, si hace falta un freno en el YAML, en un **paso que falla** con un mensaje explícito. Antes de dar por bueno un control de CI, preguntarse qué color queda cuando la condición no se cumple: si queda verde, no es un control.

### AG-25 · Un test sobre configuración se ata al bloque, no al archivo
**Origen:** H03

`assert.match(migrate, /environment:\s*(staging|production)/)` buscaba una aparición en todo `migrate.yml`. Con que el job de staging la tuviera, alcanzaba: borrando `environment: production` —la línea que impide que una migración a producción corra sin aprobación— el test seguía pasando. Lo mismo con `/180/` y `/cancel-in-progress:\s*false/`.

> **Regla propuesta.** Un test sobre un archivo de configuración parsea la estructura y comprueba **el bloque concreto** (este job, esta clave), no la presencia de un string en el archivo. Si se usa string matching, se demuestra en rojo borrando exactamente la línea que se quiere proteger — que es como se encontró éste.

## Advertencias

- **Ronda 1 de una PR abierta.** Las tres lecciones salen de un solo caso cada una; conviene confirmarlas cuando la PR cierre.
- **T-003 es plomería de CI**, igual que T-002 lo era de configuración. La densidad de «controles decorativos» es propia de un área donde casi todo lo que se escribe *es* un control; no hay que esperar la misma proporción en una PR de producto.
- **AG-24 es la que más rinde de las tres** y es barata: se aplica leyendo cualquier `if:` de un workflow y preguntando qué pasa cuando da falso.
