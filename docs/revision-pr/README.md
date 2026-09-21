# Revisiones de PR

Registro de las revisiones de código de cada PR, guardado para poder **analizar patrones entre PRs** y mejorar `AGENTS.md` y las reglas de `.agents/rules/` con evidencia en vez de intuición.

No reemplaza la revisión en GitHub: es el archivo de lo que se encontró, cómo se comprobó y qué se aprendió.

## Estructura

```
docs/revision-pr/
├── README.md                 # este archivo
├── analizar.mjs              # agrega los hallazgos de todas las PRs
├── _plantilla/               # copiar para una PR nueva
└── pr-<N>/
    ├── README.md             # ficha: SHAs, estado, resumen
    ├── revisiones/
    │   ├── ronda-1.md        # informe completo de cada ronda
    │   └── ronda-2.md
    ├── evidencia/
    │   └── comandos.md       # comandos reproducibles y su salida
    ├── hallazgos.jsonl       # datos estructurados (1 hallazgo por línea)
    └── lecciones.md          # qué cambiar en AGENTS.md y por qué
```

Una carpeta por PR, `pr-<número>`. Un archivo por ronda de revisión: si tras arreglar se vuelve a revisar, eso es `ronda-2.md`, no una edición de `ronda-1.md` — el valor está en ver qué se arregló y qué se rompió al arreglar.

## Por qué `hallazgos.jsonl`

Los informes en Markdown son para leer; el `.jsonl` es para **contar**. Una línea por hallazgo, un objeto JSON por línea, así se agrega entre PRs sin parsear prosa.

Campos:

| Campo | Para qué |
|---|---|
| `id` | `PR<N>-H<nn>` (hallazgo), `PR<N>-R<nn>` (regresión) o `PR<N>-A<nn>` (alcance: desvío de los «Archivos permitidos» de la ficha) |
| `pr`, `tarea`, `ronda`, `sha` | Trazabilidad al commit exacto |
| `archivo`, `linea` | Dónde |
| `severidad` | `critico` · `alto` · `medio` · `bajo` · `decision` |
| `categoria` | `correctness` · `test-coverage` · `conventions` · `accesibilidad` · `efficiency` |
| **`patron`** | **El campo clave**: la causa raíz, normalizada. Es lo que permite ver reincidencias |
| `causa_raiz` | Por qué pasó, en una frase |
| **`origen`** | **`agente` · `ficha` · `ambos`**: si la ficha decía qué hacer con claridad y el agente lo hizo mal (`agente`), si seguirla al pie produce el defecto (`ficha`), o si lo decía en prosa sin ningún control que lo hiciera cumplir (`ambos`) |
| `origen_motivo` | Por qué se clasificó así, citando la ficha o la regla |
| `deteccion` | `verificado-runtime` · `verificado-build` · `verificado-lint` · `analisis` |
| `evidencia` | El comando y su salida, resumidos |
| `por_que_paso_los_checks` | **Lo más útil para mejorar los controles** |
| `estado` | `arreglado-verificado` · `arreglado-sin-verificar` · `parcial` · `abierto` · `decision-pendiente` · `aceptado` |
| **`verificado_en_sha`** | **El SHA en el que se comprobó**, no aquel en que se dijo haberlo arreglado. `null` si nadie lo verificó de forma independiente |
| `verificado_fecha`, `verificado_metodo` | Cuándo y cómo: el comando y su resultado, en una línea |
| `ronda_arreglo`, `residual` | En qué ronda se tocó y qué quedó pendiente |
| `leccion` | Referencia a `AG-xx` en `lecciones.md` |


### Corregido no es lo mismo que corregido y verificado

Un hallazgo pasa a `arreglado-verificado` **solo cuando alguien distinto de quien lo arregló lo comprobó ejecutando algo**, y queda registrado el `verificado_en_sha`: el commit en el que se hizo esa comprobación, no aquel en que se dijo haberlo arreglado.

La distinción no es burocracia. En esta misma PR pasaron las dos cosas que justifican llevarla:

- Un commit anunció «resuelve los 15 hallazgos» y tres estaban a medias; uno de ellos, el test de `server-only`, pasaba en verde sin ejercer lo que decía.
- Un arreglo de un hallazgo **desactivó el control de otro** (`PR47-R01`), con los 23 tests en verde.

Reglas de uso:

- `arreglado-sin-verificar` es un estado legítimo y **hay que usarlo** cuando no se comprobó. Un mensaje de commit no es verificación.
- Si el código cambia después de la comprobación, el `verificado_en_sha` queda viejo: hay que revalidar antes de volver a afirmar que está cerrado.
- El `verificado_metodo` dice qué se corrió y qué dio. «Se revisó» no sirve; «lint: `axios` en `middleware.ts` reporta 2 errores» sí.
- Cuando la comprobación fue lectura de código y no ejecución, se dice (`inspeccion: ...`). Es más débil y conviene que se note.
- Un desvío que se decide aceptar va a `aceptado`, **no** a `arreglado-verificado`: no se comprobó nada, se tomó una decisión. El `verificado_en_sha` guarda el commit donde quedó registrada y `verificado_metodo` dice quién decidió. El script los cuenta por separado, porque mezclarlos volvería a borrar la distinción.

`node docs/revision-pr/analizar.mjs verificacion` lista lo que está corregido sin verificar, para que no se cuele como cerrado.

### Catálogo de patrones

Mantener esta lista estable entre PRs: si cambian los nombres, el análisis pierde sentido.

| Patrón | Qué describe |
|---|---|
| `P01-contrato-de-framework-no-verificado` | Se asumió un comportamiento del framework sin comprobarlo |
| `P02-parseo-de-texto-en-vez-de-ast` | Decisión sobre código tomada con string matching |
| `P03-comentario-contradice-codigo` | El comentario afirma algo que el código no hace |
| `P04-test-tautologico` | La prueba no puede fallar |
| `P05-semantica-invertida-vs-dod` | Se implementó lo contrario de lo que pedía el DoD |
| `P06-enumeracion-incompleta` | Lista de casos que omite variantes |
| `P07-coincidencia-demasiado-amplia` | Patrón que atrapa código legítimo |
| `P08-control-no-cubre-lo-que-dice` | El control no alcanza los archivos que promete |
| `P09-config-que-reemplaza-en-vez-de-fusionar` | Se perdió configuración al sobrescribirla |
| `P10-desvio-de-ficha-sin-consultar` | Decisión de alcance tomada sin preguntar |
| `P11-api-publica-inconsistente` | La API no es alcanzable desde donde dice servir |
| `P12-plantilla-propaga-antipatron` | Un error en andamiaje que se va a copiar |
| `P13-accesibilidad-no-considerada` | Barrera de accesibilidad introducida sin evaluar |
| `P14-referencia-muerta-tras-mover` | Se movió o borró un archivo y quedaron referencias a la ruta vieja |
| `P15-entregable-declarado-pero-no-ejecutable` | Se declaró una dependencia, script o paso que no se puede ejecutar realmente |

## Cómo analizar

Hay un script que agrega los `hallazgos.jsonl` de todas las PRs. Usa solo Node, sin dependencias:

```bash
node docs/revision-pr/analizar.mjs
```

Vistas disponibles:

| Comando | Qué muestra |
|---|---|
| `node docs/revision-pr/analizar.mjs patrones` | Patrones más frecuentes — **los candidatos a regla nueva** |
| `node docs/revision-pr/analizar.mjs checks` | Por qué los checks no atajaron cada cosa — la fuente más rica para mejorar controles |
| `node docs/revision-pr/analizar.mjs abiertos` | Lo que quedó abierto o a medias, en todas las PRs |
| `node docs/revision-pr/analizar.mjs regresiones` | Arreglos que rompieron otra cosa |
| `node docs/revision-pr/analizar.mjs verificacion` | **Qué está corregido y verificado, con el SHA**, qué está corregido sin verificar, y qué espera decisión |
| `node docs/revision-pr/analizar.mjs origen` | **¿Culpa del agente o de la ficha?** Reparto por PR y lista de los atribuibles al plan |
| `node docs/revision-pr/analizar.mjs archivos` | Archivos que reinciden |
| `node docs/revision-pr/analizar.mjs` | Todas las vistas |

El script avisa si alguna línea del `.jsonl` no parsea, así que también sirve para validar el formato después de editarlo a mano.

> `jq` no está instalado en las máquinas del equipo; por eso el script en vez de una receta con `jq`.

## Cuándo tocar `AGENTS.md`

**No después de una sola PR.** Un patrón que aparece una vez puede ser propio de esa tarea; T-000, por ejemplo, era scaffolding puro y por eso concentró errores de configuración que una PR de feature no va a tener.

Criterio sugerido:

- **2 o más PRs distintas con el mismo `patron`** → candidato a regla en `AGENTS.md` o en la regla por tema que corresponda.
- **Una sola PR, pero severidad `critico`** → vale la pena igual, con la advertencia de que es evidencia de un solo caso.
- **Un patrón que deja de aparecer** tras agregar la regla → señal de que funcionó; anotarlo, porque justifica mantenerla.

### Cuándo **no** quitar una regla

Que un patrón deje de aparecer **no es motivo para eliminar la regla**: lo más probable es exactamente lo contrario, que la regla esté cumpliendo su función. Una regla que previene no deja rastro en los hallazgos, y confundir «no aparece» con «no sirve» lleva a desmantelar justo lo que funciona y a que el patrón vuelva.

Antes de tocar una regla por antigüedad, hay que saber si está **respaldada por un control**:

- **Regla con control** (lint, test, check de CI). Cero violaciones significa que funciona. **No se toca.** Si se quiere evidencia de que sigue viva, se rompe la regla a propósito una vez y se comprueba que el control salta — la misma demostración en rojo que pide el principio 8.
- **Regla que es solo prosa** en `AGENTS.md`. Acá no se puede distinguir «se cumple» de «nadie la lee», porque en ninguno de los dos casos hay hallazgos. La respuesta correcta **no es borrarla**, sino convertirla en control. Si no es automatizable, se la deja y se revisa a mano cuando toque una PR del área.

El único motivo legítimo para quitar una regla es que haya quedado **obsoleta** — el framework cambió, la práctica que prohibía ya no existe, o contradice otra regla más nueva. Nunca por silencio estadístico.

Lo que sí conviene vigilar es el tamaño de `AGENTS.md`: un documento largo se lee peor. Pero la salida a eso es mover reglas a la regla por tema que corresponda y apoyarlas en controles, no podarlas por falta de incidentes.

## Al abrir una revisión nueva

```bash
cp -r docs/revision-pr/_plantilla docs/revision-pr/pr-<N>
```

Y completar la ficha. El `hallazgos.jsonl` se puede ir escribiendo a medida que aparecen los hallazgos.
