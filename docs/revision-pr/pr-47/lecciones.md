# Lecciones de la PR #47 (T-000) para `AGENTS.md` y las reglas

**Fuente:** 18 registros (15 hallazgos de la ronda 1, 2 regresiones introducidas al arreglar, 1 desvío de alcance). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).
**Destino sugerido:** `docs/agy-kit/AGENTS.md` y `docs/agy-kit/.agents/rules/`.

---

## El hallazgo meta: los checks verdes no eran evidencia

De los 16 defectos, **los 16 convivieron con `typecheck`, `lint`, `test` y `build` en verde**. En 11 casos el check era literalmente cierto pero sobre un subconjunto que no incluía el defecto.

Los tres modos de falla, por frecuencia:

| Modo | Casos | Qué pasaba |
|---|---|---|
| El código nunca se ejecutó | H01, H11 | Nada consumía el módulo todavía, así que el build no podía fallar |
| El control no alcanzaba el archivo | H09, H10, R01 | `next lint` no lee la raíz; un `override` desactivaba la regla |
| El test no podía fallar | H04 | Aserción tautológica sobre un paquete de terceros |
| El desvío no lo miraba nadie | H14, H15, A01 | Ningún check compara el diff contra los «Archivos permitidos» de la ficha |

**Esto es lo más importante para `AGENTS.md`.** El agente reportó "4 checks verdes" de buena fe y era cierto; el problema es que trató *verde* como sinónimo de *verificado*.

---

## Lecciones propuestas

Cada una nace de hallazgos concretos. La columna «origen» permite rastrear si vale la pena mantenerla en el futuro.

### AG-01 · Un módulo sin consumidor no está verificado
**Origen:** H01 (crítico), H11

`src/lib/env.public.ts` tenía un bug que hacía lanzar a todo componente cliente que lo usara. El build estaba verde porque **nadie lo importaba todavía**.

> **Regla propuesta.** Cuando una tarea entrega un módulo que aún no tiene consumidores, el agente crea un consumidor de prueba temporal, lo ejerce con el comando real (`next build`, `next start`, el test), comprueba el resultado y recién después lo borra. Un módulo que nunca se ejecutó no se reporta como verificado: se reporta como *escrito, sin ejercer*.

### AG-02 · Reglas de ESLint: siempre AST, nunca texto
**Origen:** H02 (alto), H07

La detección de `'use client'` usaba `node.directives` (que es de Babel, no de espree) con un fallback `startsWith` sobre el código fuente. Cualquier comentario previo la desactivaba.

> **Regla propuesta.** En una regla de ESLint, toda decisión sale del AST. Prohibido `getSourceCode().getText()` con `startsWith`/`includes`/regex para decidir si una regla aplica. Para especificadores de import, anclar por segmento de ruta, nunca `includes` de subcadena.

### AG-03 · El comentario se verifica como se verifica el código
**Origen:** H03 (alto)

El comentario decía «piso tipográfico de lectura a 14px» y el código conseguía exactamente lo contrario: `text-sm` quedaba en 12,25px y `text-xs` en 10,5px.

> **Regla propuesta.** Si un comentario afirma un valor, un umbral o un efecto observable, el agente lo comprueba con el mismo rigor que al código. Cuando no puede comprobarlo, lo escribe como intención (`Objetivo: ...`), no como hecho.

### AG-04 · Toda prueba se demuestra en rojo
**Origen:** H04 (alto) — el principio 8 del plan **ya existe** y no se aplicó

El principio 8 dice: «Toda prueba nueva se demuestra fallando al romper la regla que prueba». El test de `server-only` era un `require()` de un paquete de terceros cuyo `index.js` es un `throw` de una línea: pasaba por construcción.

No hace falta una regla nueva — hace falta **un paso obligatorio y un artefacto**.

> **Regla propuesta.** Antes de cerrar la sesión, por cada prueba nueva el agente: (1) rompe la regla que la prueba protege, (2) pega la salida en rojo en la bitácora, (3) restaura. Si no logra ponerla en rojo, la prueba no cuenta como cobertura del DoD y se dice explícitamente en el informe.

### AG-05 · Allowlist por defecto, nunca enumerar lo prohibido
**Origen:** H05 (alto), H08

Dos veces el mismo error: `no-restricted-imports` enumeraba paquetes prohibidos (el DoD pedía «fuera de la lista aprobada») y `boundaries/entry-point` enumeraba archivos prohibidos, olvidando tres.

> **Regla propuesta.** Todo control de fronteras se configura con `default: disallow` más una lista explícita de lo permitido. Una lista de prohibidos solo se acepta cuando el conjunto permitido es infinito, y en ese caso se dice por qué en el PR.

### AG-06 · Cubrir todas las formas sintácticas de una dependencia
**Origen:** H06, H08

La regla solo miraba `ImportDeclaration`. Se escapaban `export * from`, `export {x} from`, `import()` y `require()` — y `export * from` es justamente la forma canónica de las API públicas de feature en este repo.

> **Regla propuesta.** Un control sobre dependencias entre módulos cubre las cinco formas: `import`, `export ... from`, `export * from`, `import()` dinámico y `require()`. El PR lista cuáles se probaron.

### AG-07 · Todo control necesita un caso negativo
**Origen:** H07, R01

Los tres fixtures commiteados probaban que el lint **falla** cuando debe. Ninguno probaba que **pasa** cuando debe. Por eso nadie vio que `includes('/server')` bloqueaba `next/server`.

> **Regla propuesta.** Por cada fixture que demuestra que una regla dispara, hay un fixture hermano de código legítimo y parecido que demuestra que **no** dispara. Los falsos positivos en reglas `error` son tan bloqueantes como los falsos negativos, porque empujan a `eslint-disable` sobre reglas que la regla 20 prohíbe desactivar.

### AG-08 · Verificar que el control alcanza los archivos que dice alcanzar
**Origen:** H09, H10, R01

`next lint` sin `--dir`/`--file` solo recorre `app`, `pages`, `components`, `lib` y `src`: `middleware.ts` —el archivo con la restricción más estricta del repo— nunca se linteaba.

> **Regla propuesta.** Al configurar o modificar un control, el agente escribe un archivo probe que **debe** fallar en la ubicación más lejana que el control dice cubrir, confirma que falla y lo borra. Se pega esa salida en la bitácora.

### AG-09 · «Check verde» se reporta con su alcance
**Origen:** H10 y el hallazgo meta

> **Regla propuesta.** En el informe de `revisar-pr` y en el PR, cada check verde va acompañado de qué abarcó: cuántos archivos, qué directorios, y qué **no** cubre. «`pnpm lint` verde» sin alcance no es evidencia admisible.

### AG-10 · Una API pública se valida desde su consumidor real
**Origen:** H11

Las Server Actions del template no tenían **ninguna** ruta de import válida desde cliente: `index.ts` no las reexportaba, `server.ts` era server-only y el import profundo estaba prohibido por lint.

> **Regla propuesta.** Al definir o modificar la API pública de un módulo (`index.ts`, `server.ts`), el agente escribe un consumidor de prueba desde cada lado de la frontera que esa API dice servir (cliente y servidor), comprueba que compila y lo borra.

### AG-11 · Las plantillas se revisan como código de producción
**Origen:** H12

`src/features/_template/` es la plantilla canónica que todas las features de Fase 1 van a copiar. Un `queryKey` mal puesto ahí se replica en cada módulo.

> **Regla propuesta.** El contenido de `src/features/_template/` y de cualquier andamiaje que se copie se revisa con el mismo estándar que el código de producción, y lleva tests propios. Cuando una parte es deliberadamente un stub, falla ruidosamente (`throw new Error('Implementar...')`) en vez de devolver un valor plausible.

### AG-12 · Accesibilidad mínima desde el primer commit
**Origen:** H13, H03

`maximumScale: 1` más raíz tipográfica de 14px dejaban texto de 10,5px sin posibilidad de ampliarlo. La auditoría de accesibilidad recién llega en T-205, así que nada lo habría detectado durante meses.

> **Regla propuesta.** Incluso en tareas sin DoD de accesibilidad, hay tres cosas que nunca se introducen sin aprobación explícita: bloquear el zoom (`maximumScale`/`user-scalable=no`), fijar `font-size` de `html` en px, y texto por debajo del piso de la cláusula Anti-12px. Añadir a la regla 60.

### AG-13 · Desvío de la ficha: frenar y consultar
**Origen:** H14, H15, A01

La ficha T-000 decía «`middleware.ts` vacío» y se entregó con función y matcher. El plan pedía «versiones exactas» y se usaron rangos caret. Ninguno es un bug; ambos son decisiones que el agente tomó solo.

> **Regla propuesta.** Cuando el agente concluye que conviene desviarse de la ficha, no lo hace: deja el comportamiento que pide la ficha, anota el desvío propuesto en una sección «Desvíos propuestos» del PR y lo consulta en el issue. Es el freno que ya pide §3.8.4 del plan, extendido a las desviaciones de la ficha y no solo a los archivos permitidos.
>
> **Corolario, por A01:** el desvío de «Archivos permitidos» también aplica a documentación y archivos de proceso, no solo a código. Y como **ningún check compara el diff contra la lista de la ficha**, conviene que T-003 agregue uno: leer los «Archivos permitidos» de la fila correspondiente y fallar si el diff los excede. Es barato y cierra la categoría entera.

### AG-15 · Corregido no es corregido y verificado
**Origen:** el ciclo completo de esta PR (rondas 2, 3 y 4)

Un commit anunció «resuelve los 15 hallazgos» y tres estaban a medias. Otro arreglo desactivó el control de un hallazgo previo (`R01`) con los 23 tests en verde. Un tercero rompió `pnpm lint` y no se detectó hasta la ronda siguiente (`R02`).

En los tres casos el mensaje de commit decía la verdad sobre la intención y no sobre el resultado.

> **Regla propuesta.** Un hallazgo no se marca cerrado por haberlo arreglado: se marca cerrado cuando **alguien distinto de quien lo arregló lo comprobó ejecutando algo**, y queda registrado en qué commit se hizo esa comprobación. Estados separados para «corregido» y «corregido y verificado»; el primero es legítimo y hay que usarlo cuando corresponde.
>
> Para la skill `revisar-pr`: la salida de cada revisión incluye un comando reproducible por hallazgo, y la ronda siguiente los vuelve a correr **todos**, no solo los que se tocaron. Si el código cambió después de la última comprobación, el hallazgo vuelve a «sin verificar» hasta que se revalide.

### AG-14 · Un arreglo no puede reducir otro control
**Origen:** R01 (regresión crítica)

El arreglo de H09 introdujo un `overrides` en `.eslintrc.json`. Como en ESLint un override **reemplaza** la configuración de la regla en vez de fusionarla, la denylist de paquetes dejó de aplicarse en `components/`, `hooks/`, `schemas.ts`, `copy.ts` e `index.ts`. Los 23 tests siguieron en verde.

> **Regla propuesta.** Al arreglar hallazgos de una revisión, el agente vuelve a correr la verificación **de cada hallazgo previo del mismo archivo**, no solo la del que está arreglando. Y específicamente: al agregar un `overrides` en ESLint, se enumera qué reglas desplaza y se verifica cada una con un probe, porque el override reemplaza y no fusiona.
>
> Corolario para la skill `revisar-pr`: la salida de una revisión incluye un comando reproducible por hallazgo, para que la ronda siguiente los vuelva a correr todos.

---

## Qué cambiar, en orden de impacto

Si solo se pueden aplicar tres cosas:

1. **AG-01 + AG-09** — la raíz del problema. El agente confundió *verde* con *verificado*. Una frase en `AGENTS.md` sobre reportar el alcance de cada check y ejercer los módulos sin consumidor habría evitado H01, H09, H10, H11 y R01.
2. **AG-04** — el principio 8 ya existe pero no tiene paso obligatorio ni artefacto. Convertirlo en un paso de `cerrar-sesion` con salida en rojo pegada en la bitácora.
3. **AG-05 + AG-07** — configuración de fronteras con `default: disallow` y un caso negativo por cada fixture. Cubre H05, H07, H08 y la mitad de R01.

Las demás son valiosas pero más específicas; conviene sumarlas a las reglas por tema (AG-02 a la 40-testing o a una nueva de tooling, AG-12 a la 60-ui-accesibilidad, AG-13 a la 50-git-y-coordinacion).

---

## Antes de escribir nada en `AGENTS.md`

Dos advertencias, porque este documento sale de **una sola PR**:

- **T-000 es atípica.** Es scaffolding puro: casi todo el trabajo era configurar controles. Un PR de feature va a tener otra distribución de errores. Conviene esperar a 2 o 3 PRs más antes de dar por buenos los patrones `P05`, `P06` y `P08` como recurrentes.
- **No inflar `AGENTS.md`.** Catorce reglas nuevas de una sola PR sería contraproducente: un documento largo se lee peor y se cumple menos. Las tres del bloque de arriba son las que tienen evidencia más fuerte y cobertura más amplia.
