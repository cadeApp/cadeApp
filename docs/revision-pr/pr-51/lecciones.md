# Lecciones de la PR #51 para `AGENTS.md` y las reglas

**Fuente:** 11 hallazgos en 4 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Provisorio: la PR sigue abierta con 2 hallazgos sin cerrar —uno es del revisor, el otro es de nivel repo— y ninguno bloqueante. Se completa al cerrarla.

## Patrón dominante

**Algo que parece un control y no lo es.** En la ronda 1 fueron tres: una variable que existe pero apunta al proyecto equivocado, un `if:` que saltea en vez de bloquear, y un test que busca un string en un archivo en vez de mirar el bloque que le importa. En la ronda 3 volvió con otras dos caras: un comando de lint que corre, lee los archivos y no tiene ninguna regla capaz de fallar, y un control que valida el cuerpo del PR probado contra un cuerpo sintético que no es el del PR.

Es una vuelta de tuerca sobre `P08-control-no-cubre-lo-que-dice`: acá el control no es incompleto, es **decorativo**. Los cinco pasan en verde mientras no protegen nada.

Es esperable en T-003 y conviene decirlo: **es una tarea donde casi todo lo que se escribe *es* un control.** La proporción no se traslada a una PR de producto.

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

### AG-26 · Sumar un comando a un check no es sumar cobertura: hay que mirar la configuración que resuelve
**Origen:** H07

Para que `pnpm lint` alcanzara los `.mjs` de workflows se le agregó `eslint --no-ignore --ext .mjs .github/workflows`. El comando corre, no es un no-op —inspecciona los tres archivos— y de las **55 reglas que resuelve, ninguna puede dispararse sobre un módulo de Node**: son todas de React, Next y jsx-a11y, o tienen scope a `src/`, y el `.eslintrc.json` raíz no extiende `eslint:recommended`. Cinco defectos clásicos plantados (variable sin usar, código inalcanzable, bloque vacío, `debugger`) pasan en verde. Lo único que lo hace fallar es un error de sintaxis, que `tsc` ya atrapa.

La prueba que acompaña el arreglo verifica que el comando **esté en `package.json`**, lo que se lee como «cubierto».

> **Regla propuesta.** Cuando se extiende un check a una carpeta nueva, la evidencia no es que el comando corra: es **plantar un defecto del tipo que ese check debería atrapar y verlo fallar**. Para lint, un `no-unused-vars`; para typecheck, un error de tipos; para tests, una assert que no se cumple. Si el defecto pasa en verde, el comando se agregó pero la cobertura no. Vale mirar `eslint --print-config` / el `tsconfig` efectivo antes de dar el punto por cerrado.

El contraejemplo está en la misma PR: el tercio de `typecheck` de H05 **sí** se demostró así, y encima en el runner de GitHub. Los dos arreglos son del mismo commit; el que se demostró con un defecto real quedó bien y el que se demostró con un `assert` de forma, no.

### AG-27 · Un control que lee el cuerpo del PR se prueba contra el cuerpo del PR
**Origen:** H08

`approval-policy.mjs` exige seis cadenas literales en la sección «Informe de revisión de agy», y sus pruebas lo ejercitan con un cuerpo sintético que las trae todas. El cuerpo real de la PR que construye el control **no las trae**: corriendo `evaluateApprovalPolicy` contra el cuerpo real, da `ok: false`. No se notó porque `pull_request_target` usa la definición de la rama base y el workflow todavía no está ahí, así que el check no corrió nunca de verdad.

> **Regla propuesta.** Un control que valida un artefacto del proceso —el cuerpo del PR, una bitácora, una ficha— se corre **contra el artefacto real** antes de cerrar la tarea, aunque el workflow todavía no esté en la base. Es una línea de `node -e` y contesta la única pregunta que importa: ¿el PR que agrega el control lo pasaría?

## Advertencias

- **PR abierta.** AG-26 y AG-27 salen de un caso cada una, igual que las tres primeras. Conviene confirmarlas cuando la PR cierre.
- **AG-24 es la que más rinde** y es la más barata: se aplica leyendo cualquier `if:` de un workflow y preguntando qué pasa cuando da falso.
- **AG-26 es la que más se repite disfrazada.** Es la misma familia que `AG-20` de la #49 («verificar los argumentos, no solo el nombre del comando») y que `P15-entregable-declarado-pero-no-ejecutable`: tres PRs seguidas encontraron un entregable que se declara y no se ejercita. Ya no es evidencia de una sola PR.

## Lo que dice el dato entre PRs

`origen: ficha` venía subiendo —#47 11%, #48 25%, #49 31%— y en la #51 **no hay ninguno puro: 0 de 11**. Quedan dos `ambos` (18%): H05, donde la ficha dejaba los `.mjs` fuera del alcance de los checks por construcción, y H11, donde la bitácora pide una casilla que el entorno no permite satisfacer. No es que la ficha mejore sola: es que las fichas se arreglaron entre la #49 y la #51 (las PR #50 y #53 sumaron la bitácora, la propia ficha y `docs/revision-pr/**` a las 27). Según el criterio del README eso es señal de que el arreglo funcionó, **no de que el control sobre las fichas sobre**.

Lo que subió en cambio es `origen: agente` sobre controles: 9 de los 11 hallazgos de esta PR son decisiones de implementación, no huecos de la ficha. Es lo esperable en una tarea de plomería de CI, donde la ficha describe qué controlar y el agente elige cómo.

## Qué pasó al aplicarlas (ronda 4)

**AG-26 rindió a la vuelta siguiente, y de más.** La regla decía que extender un check a una carpeta nueva se demuestra plantando un defecto del tipo que ese check debería atrapar. El arreglo de H07 no se quedó en agregar `.github/workflows/.eslintrc.json`: agregó una prueba que **escribe un `.mjs` con `const unused = 1; debugger;`, corre ESLint de verdad y exige que falle**. Los mismos cinco defectos que en la ronda 3 pasaban en verde ahora dan 6 errores y `exit 1`.

Hay un detalle de diseño que conviene guardar con la lección: la prueba escribe el probe **dentro** de la carpeta que se está cubriendo, no en un temporal. Tiene que ser así, porque la configuración de ESLint cascadea por directorio y un archivo en `/tmp` no la recibiría — la prueba mediría otra cosa. Es el mismo razonamiento que hace falta para probar un `tsconfig` con `include` acotado.

**AG-27 se aplicó al revés de lo esperado, y bien.** La regla pedía correr el control contra el artefacto real. El agy lo hizo y encontró que no lo podía satisfacer: el bloque literal lo tiene que generar quien aprueba, según el template. En vez de inventar un informe para poner el check en verde, dejó dicho en el cuerpo de quién es y por qué. **Un control que uno no puede satisfacer sin falsear el artefacto se declara, no se rellena.** Vale sumarlo a la regla.

### Y una para el lado del que revisa

**Antes de llamar «redundante» a un control, comprobar que el otro control existe.** En H09 afirmé que la aprobación de par dentro de `approval-policy.mjs` duplicaba lo que ya pide la protección de rama. No lo duplica: la protección de rama **no existe** en este repo —el plan privado no la habilita y `gh api` devuelve 403 sobre `develop`, `staging` y `main`—, así que esa línea del script es la única que hace cumplir §2 hoy. El dato estaba en la bitácora de la ronda 1 y no lo crucé con mi propio hallazgo.

> **Regla propuesta, para `revisar-pr`.** Cuando un hallazgo dice «esto ya lo cubre X», el hallazgo no está cerrado hasta **verificar que X está activo en este repo**, no que exista en el plan o en la documentación. Una defensa en profundidad de dos capas donde una no está configurada es una sola capa.
