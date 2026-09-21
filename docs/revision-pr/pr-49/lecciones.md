# Lecciones de la PR #49 para `AGENTS.md` y las reglas

**Fuente:** 12 hallazgos en 3 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Todo lo que esta PR entregó como **texto** funciona; casi nada de lo que entregó como **comando ejecutable** funciona. Los clientes, la regla de ESLint y el barrido de claves están bien y probados. En cambio el CLI declarado no se instala, el script `db:types` no corre —y cuando lo intenta, borra los tipos—, la vinculación remota no existe, y la validación de drift quedó prometida en un CI que nadie se comprometió a construir.

La causa común es que **los tres checks del DoD (`typecheck`, `lint`, `test`) no ejecutan nada de lo que la tarea entrega**. Corren sobre un `node_modules` ya instalado y sobre tests que comprueban que los strings estén en `package.json`. Un entregable que es un comando necesita un control que lo **corra**, no uno que lo lea.

## Lecciones propuestas

### AG-18 · Tocar `package.json` obliga a probar una instalación limpia
**Origen:** H07

Se agregó `"supabase": "2.116.0"` a `devDependencies` sin regenerar `pnpm-lock.yaml`. Los tres checks quedaron en verde porque corren sobre el `node_modules` que ya estaba instalado; `pnpm install --frozen-lockfile` da `ERR_PNPM_OUTDATED_LOCKFILE` y el binario nunca existió. El test de paquetes aprobados sí mira `devDependencies`, pero solo valida que el **nombre** esté permitido.

> **Regla propuesta.** Si el diff toca `dependencies` o `devDependencies`, el DoD no está cumplido hasta correr `pnpm install --frozen-lockfile` con salida exit 0 y pegar esa salida en la bitácora. Si el paquete trae un binario, correr también `pnpm <binario> --version`. `pnpm-lock.yaml` entra automáticamente a los «Archivos permitidos» de cualquier ficha que permita `package.json`.

### AG-19 · Nunca redirigir la salida de un comando sobre un archivo versionado
**Origen:** H08

`"db:types": "supabase gen types ... > src/types/database.types.ts"`. La shell trunca el destino **antes** de ejecutar, así que un fallo deja el archivo en 0 bytes. Comprobado: `database.types.ts` pasó de 405 bytes a 0 con el comando fallando.

> **Regla propuesta.** Un script que genera un archivo versionado escribe primero a un temporal y lo mueve solo si el comando salió con exit 0 y salida no vacía. Si hace falta lógica (y en Windows hace falta, porque los scripts de pnpm corren por `cmd`), va como script de `tools/`, no como una línea de `package.json`.

### AG-20 · Verificar los argumentos, no solo el nombre del comando
**Origen:** H09

El test hace `expect(pkg.scripts['db:types']).toContain('supabase gen types')` y pasa, mientras `--project-id cadeapp-staging` pasa una etiqueta local donde el CLI espera el ref remoto del proyecto. El control mide el prefijo del comando.

> **Regla propuesta.** Una prueba sobre un comando verifica sus argumentos contra la documentación de la herramienta, citándola en la evidencia. Si el comando no se puede ejecutar en el entorno de la prueba, se dice explícitamente que la verificación es documental y el hallazgo queda como `analisis`, no como verificado.

### AG-21 · Una obligación que se difiere tiene que aterrizar en el DoD de otra ficha
**Origen:** H06, H10

H06 pedía no exigir un comando imposible de correr. El arreglo cambió el DoD a «en CI se valida que no haya drift de tipos» y lo marcó `[x]`. No hay CI, y **T-003 —la ficha que crea `ci.yml`— no menciona drift en su DoD**. La obligación dejó de ser imposible y pasó a ser de nadie. Lo mismo con la vinculación remota: es la mitad del objetivo de T-002 y no está en ningún lado.

> **Regla propuesta.** Si un hallazgo se resuelve difiriendo trabajo a otra tarea, el arreglo **incluye editar el DoD de esa otra ficha** con un criterio demostrable, en el mismo commit. Mientras eso no esté, la casilla del DoD original va sin marcar y con la nota de a dónde se difirió. «Lo hace CI» no es una resolución si ninguna ficha se comprometió a construir ese control.

### AG-22 · El dato de una revisión no vive en la rama revisada
**Origen:** proceso, no hallazgo

El commit `04d77e9` metió `docs/revision-pr/pr-49/` en la rama de la tarea; el revert `fbe7054` la borró entera. El informe de la ronda 2, que estaba sin commitear, se perdió y hubo que reconstruirlo.

> **Regla propuesta.** La carpeta de revisión se commitea en la rama `docs/revisiones` antes de cerrar cada ronda, nunca en la rama que se revisa. Ya estaba en `COMO-ENTREGAR.md` para PRs ajenas; vale igual para las propias, y por dos motivos, no uno: evita el desvío de alcance **y** evita que un revert se lleve puesta la revisión.

### AG-16 (refuerzo) · Mover un archivo obliga a actualizar quien lo nombra
**Origen:** H03, H11

Se reescribió la sección 3 de `docs/onboarding.md` para el flujo remoto y quedaron sin tocar la línea 20 del mismo archivo (que manda a `pnpm supabase status`, comando del stack local) y todo `.env.example`, que sigue entregando `http://127.0.0.1:54321` y explicando el flujo con Docker. `.env.example` estaba entre los «Archivos permitidos» y es el archivo que la persona **copia**.

> **Refuerzo.** Cambiar la dirección de un flujo en la documentación obliga a barrer **todos** los archivos que lo describen, no solo el que se está editando. El barrido se hace con `grep` del comando o la URL que se da de baja, y su salida va en la evidencia.

## Qué cambiar, en orden de impacto

1. **AG-18** a la regla de stack (25) y al DoD común: tocar dependencias exige `install --frozen-lockfile` en verde. Es el único de estos que ataja un crítico, y hoy no hay nada que lo cubra.
2. **AG-21** a `AGENTS.md`: diferir trabajo exige editar el DoD de destino en el mismo commit. Es la lección que más se repite entre PRs con otro disfraz (ver abajo).
3. **AG-19** a la regla de scripts: nada de `>` sobre archivos versionados.
4. **AG-22** a `COMO-ENTREGAR.md`: extender la regla de la rama `docs/revisiones` a las PRs propias.
5. **AG-20** a la regla de tests: los controles sobre comandos verifican argumentos.

## Lo que dice el dato entre PRs

`P10-desvio-de-ficha-sin-consultar` no apareció en la ronda 3 y `A01` cerró con **0 archivos fuera de alcance**, por primera vez en tres PRs. Según el criterio del README eso es señal de que el control funciona, no de que sobre: la ficha se amplió explícitamente en vez de desviarse en silencio. **No se toca.**

El patrón nuevo, `P15-entregable-declarado-pero-no-ejecutable`, se lleva tres de los cinco hallazgos nuevos (H07, H09, H10). Es la primera vez que aparece con ese peso, así que todavía es evidencia de una sola PR — pero conviene mirarlo en la #50, porque los tres salieron del mismo hueco: ningún check ejecuta lo que la tarea entrega.

## Advertencias

- **Esta PR no es representativa de una PR de feature.** T-002 es plomería: un CLI, un script de generación, un archivo de configuración y documentación de entorno. Casi todos los hallazgos nuevos son de la clase «el comando no corre», que en una tarea de producto no va a aparecer con esta densidad.
- **AG-20 y AG-19 se apoyan en un solo caso cada uno.** Valen igual por el costo de no tenerlos —AG-19 ataja pérdida de datos—, pero no hay evidencia de reincidencia.
- **H09 no está verificado en corrida**, solo contra la documentación del CLI, porque el CLI no se puede instalar (H07). Si se resuelve H07, conviene confirmarlo ejecutando antes de darlo por cierto.
- **El lockfile desalineado viene de T-000 y se me pasó al revisar la #47.** No lo causó esta PR; lo que sí es de esta PR es depender de que el CLI se instale.
