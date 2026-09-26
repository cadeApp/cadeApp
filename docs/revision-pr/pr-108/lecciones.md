# Lecciones — PR #108 / CC-010

Numeración continua del proyecto. El máximo en las ramas remotas al iniciar esta revisión es `AG-107`. Esta PR continúa en `AG-108`.

---

## AG-108 · Adaptar código de registry (shadcn/ui) exige auditar operadores non-null (!) frente a `noUncheckedIndexedAccess`

**Origen:** `PR108-H01` (`src/ui/input-otp.tsx:40`)

Al incorporar componentes oficiales de shadcn/ui o de cualquier registry externo, el código upstream suele usar el operador non-null assertion (`array[index]!`) para satisfacer TypeScript cuando `tsconfig.json` activa `noUncheckedIndexedAccess: true`.

En cadeApp, la regla de calidad en `AGENTS.md §4` es categórica y no admite excepciones:

> *«Prohibido: any, @ts-ignore, ! non-null, .only, .skip sin issue, desactivar reglas de lint o checks.»*

Si ESLint no cuenta con una regla activa que lo marque en el linter (`@typescript-eslint/no-non-null-assertion`), la aserción pasa desapercibida en los checks automáticos. Además de violar la norma del repositorio, introduce fragilidad en runtime: si en la UI se renderiza un slot con un índice no provisto por el contexto de `input-otp`, desestructurar `slots[index]!` lanza `TypeError: Cannot destructure property ... as it is undefined`.

> **Regla propuesta.** Al adaptar primitivas copiadas desde shadcn/ui o registries externos, se audita expresamente la presencia de `!`. En accesos indexados a arrays o tuplas bajo `noUncheckedIndexedAccess`, se utiliza desestructuración segura con fallback (`const slot = slots[index]; const char = slot?.char ?? ''; ...`), garantizando tipado estricto, resiliencia ante índices fuera de rango y cumplimiento de `AGENTS.md §4`.


---

## Ronda 2

AG-108 queda confirmada por el cierre de PR108-H01: el código upstream de un registry no hereda automáticamente las excepciones de estilo del proyecto. En cadeApp se adapta a las reglas locales antes de considerarlo contractual.

No se propone una regla nueva adicional. H02/H03 quedan cubiertos por el principio ya existente de enumerar la clase completa del contrato y demostrar que el control falla cuando se retira la propiedad protegida.
