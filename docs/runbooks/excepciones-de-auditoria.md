# Excepciones de `pnpm audit`

El job `audit` de CI corre `pnpm audit --audit-level=high` y bloquea (regla 00: «`pnpm audit` corre en CI; no lo
silencies»). Este runbook es el único lugar donde se admite una excepción, y solo con estas condiciones:

1. El advisory **no tiene versión corregida** publicada. Si la hay, se actualiza o se usa `pnpm.overrides`; no se
   exceptúa.
2. El paquete **no llega a producción**: `pnpm why <paquete> --prod` no lo encuentra.
3. La excepción es por GHSA, en `pnpm.auditConfig.ignoreGhsas` de `package.json`. No se baja el umbral, no se usa
   `--prod`, `|| true` ni `continue-on-error`, y no se ignoran paquetes enteros.
4. La aprueba Lautaro073 en una ficha, y `tools/verify-audit-exceptions.test.ts` la lista. Ese test falla si aparece
   un GHSA que no está acá, si falta su sección, si el paquete entra a producción o si el step de CI cambia.

Cada excepción tiene una sección `## <GHSA>` con los campos de abajo. Al quitarla, se borran la sección, la entrada
de `ignoreGhsas` y la fila del test.

## GHSA-vfj7-8cjw-p6xm

- **Paquete:** `braces` `<=3.0.3` (instalada: 3.0.3). Severidad high: denegación de servicio por agotamiento de la
  pila con patrones de llaves anidados muy profundos.
- **Versión corregida:** ninguna. 3.0.3 es la última publicada y el advisory declara `Patched versions: <0.0.0`.
  Un override no tiene a qué versión apuntar.
- **Alcance:** solo desarrollo. Llega por `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` →
  `micromatch`, `eslint-plugin-boundaries` → `micromatch` y `tailwindcss` 3 → `chokidar` / `fast-glob` /
  `micromatch`. `pnpm why braces --prod` no devuelve ningún camino.
- **Por qué el riesgo es bajo:** esas herramientas expanden globs escritos en la configuración del repo (ESLint,
  Tailwind), no entradas de usuarios. El ataque necesita un patrón controlado por un tercero, y el código del repo
  ya pasa por revisión. En el peor caso se cae un proceso de lint o build, no la app.
- **Aprobación:** T-332, issue #227 (Lautaro073, 2026-10-03).
- **Se quita cuando:** se publique una versión corregida de `braces`, o cuando `eslint-config-next`,
  `eslint-plugin-boundaries` y `tailwindcss` dejen de depender de ella. Lo que pase primero.
