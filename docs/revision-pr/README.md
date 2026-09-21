# Revisiones de PR

Registro de las revisiones de código de cada PR, guardado para poder **analizar patrones entre PRs** y mejorar `AGENTS.md` y las reglas de `docs/agy-kit/.agents/rules/` con evidencia en vez de intuición.

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
| `id` | `PR<N>-H<nn>` (hallazgo) o `PR<N>-R<nn>` (regresión) |
| `pr`, `tarea`, `ronda`, `sha` | Trazabilidad al commit exacto |
| `archivo`, `linea` | Dónde |
| `severidad` | `critico` · `alto` · `medio` · `bajo` · `decision` |
| `categoria` | `correctness` · `test-coverage` · `conventions` · `accesibilidad` · `efficiency` |
| **`patron`** | **El campo clave**: la causa raíz, normalizada. Es lo que permite ver reincidencias |
| `causa_raiz` | Por qué pasó, en una frase |
| `deteccion` | `verificado-runtime` · `verificado-build` · `verificado-lint` · `analisis` |
| `evidencia` | El comando y su salida, resumidos |
| `por_que_paso_los_checks` | **Lo más útil para mejorar los controles** |
| `estado` | `arreglado` · `parcial` · `abierto` · `decision-pendiente` |
| `ronda_arreglo`, `residual` | Qué quedó pendiente |
| `leccion` | Referencia a `AG-xx` en `lecciones.md` |

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

Y al revés: si una regla lleva varias PRs sin evitar nada, sobra. `AGENTS.md` largo se lee peor y se cumple menos, así que conviene podarlo con el mismo criterio con que se agrega.

## Al abrir una revisión nueva

```bash
cp -r docs/revision-pr/_plantilla docs/revision-pr/pr-<N>
```

Y completar la ficha. El `hallazgos.jsonl` se puede ir escribiendo a medida que aparecen los hallazgos.
