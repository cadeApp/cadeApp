# Informe de revisión — PR #440 / T-378 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/440  
**SHA revisado:** `0588a5f26d125a5bd83da606d5d11d30fc57fafd`  
**Base:** `develop@54bbdcd7b079fa208e970725efa66832a8fac724`  
**Fecha:** 2026-10-20  
**Resultado: SIN BLOQUEANTES** de código ni cobertura, sujeto a completar los checks operativos pendientes y salir de Draft.

## Resumen

- **PR440-H01: ARREGLADO-VERIFICADO** por inspección propia, mutaciones sintéticas de código fuente ejecutadas en memoria y unit GREEN oficial. La prueba real de mutantes con Vitest (RED) figura en la bitácora del autor, pero no se ejecutó por el revisor.
- **Hallazgos nuevos:** 0.
- **Decisiones para Lautaro073:** ninguna pendiente.
- **Pruebas reales del revisor:** no se dispuso de clon local con dependencias: `git ls-remote` no resolvió `github.com`, `pnpm` no está instalado en el contenedor. Los checks CI sí están verificados contra el SHA.
- **Cambio desde la ronda 1:** desde el commit de revisión `53791825` hasta este SHA se modificaron **únicamente** `src/features/trips/components.test.tsx` (+10) y `docs/tasks/log/T-378.md` (+15), sin modificaciones de producción, contratos, fixtures o configuración.

## PR440-H01 · Control ahora detecta ausencia de flecha, tamaño y foco

**Causa original:** los tests de `TripMerchantView` y `TripCourierView` comprobaban solo `href`, por lo que una eliminación del icono o del área táctil seguía pasando.

**Arreglo inspeccionado en SHA:**
- `src/features/trips/components.test.tsx:69-75`: helper `expectAccessibleBackArrow`, que exige `svg.lucide-arrow-left`, los tokens separados por whitespace `h-12`, `w-12`, `min-h-12`, `min-w-12`, y `focus-visible:ring-2`.
- `src/features/trips/components.test.tsx:181-186`: test del comercio mantiene el `href=/merchant/dashboard` y llama al helper.
- `src/features/trips/components.test.tsx:581-586`: test del repartidor mantiene el `href=/courier/feed` y llama al mismo helper.
- Se verificó que los componentes de producción siguen teniendo `<ArrowLeft ... />`, las clases y los destinos esperados.

**Mutaciones del autor reproducidas en su entorno, según bitácora (no independientes):** antes de arreglar, los 4 mutantes daban 48/48 GREEN (indetectados); después, cada mutante producía 1 failed / 47 passed y el control restaurado 48 passed. La bitácora explica el ajuste `shell: process.platform === 'win32'` para ejecutar `pnpm.cmd` en Windows, sin alterar tests.

**Comprobación independiente ejecutada:** se obtuvieron los componentes y test directamente del SHA y se inspeccionó mecánicamente el bloque del `Link` y la correspondencia entre aserciones y ambas llamadas al helper. Se aplicaron en memoria, sin tocar repositorio, cinco mutaciones por rol:
1. Eliminar SVG de flecha.
2. Eliminar bloque de clases de tamaño de 48 px.
3. Eliminar foco `focus-visible:ring-2`.
4. Eliminar solo `min-w-12`.
5. Eliminar solo `h-12`.

**Resultado para comercio y repartidor:** baseline `true` (2/2); cada mutación deja la propiedad requerida en `false` (10/10 detectadas). Este es un **control estructural sobre código fuente**, distinto de ejecutar Vitest con mutantes; no se presenta como su sustituto. El enlace accesible y `href` se comprueban adicionalmente en la prueba real del componente, cuyo GREEN aparece en CI.

La suite `unit` de GitHub Actions (job `118453520658`) informa `Test Files 148 passed (148)` / `Tests 2894 passed (2894)` para el SHA inspeccionado. El helper se ejecuta dentro de los tests existentes.

## Resto de cambios de T-378

Ya examinados en ronda 1 y **sin cambios de implementación** desde entonces:
- Flecha navegable mediante Next Link, icono accesible, hit target y foco.
- Reemplazo de clases Tailwind inexistentes `danger` por el token real `destructive` para avisos y monto inválido, con `aria-invalid`.
- Motivo requerido al republicar para cambiar de repartidor, `trim()`, límite 500 y envío a la acción existente, respaldado por tests de la UI. El alcance adicional está documentado como autorizado por Lautaro073.

No aparecen clases prohibidas añadidas, mocks adulterados, tests falsos, `skip`, cambios de contrato ni alcance indebido en el diff de la ronda 2.

## CI oficial del SHA de la ronda 2 (consultado antes de cerrar)

| Job | Estado |
|---|---|
| unit | GREEN — 148 archivos, 2894 tests |
| typecheck | GREEN |
| lint | GREEN |
| build | GREEN |
| audit | GREEN |
| bundle-budget | GREEN |
| Vercel Preview | success |
| db-tests | en progreso al consultar |
| e2e-preview | pending al consultar |
| approval-policy | failure anterior al comentario sin bloqueantes; informe pendiente |

No interpretar `pending` como verde ni fallido. En el primer SHA de esta PR existió un error `next/font`; no se reprodujo en los SHAs posteriores.

## Estado y cierre

**Recomendación:** sin bloqueantes funcionales/de cobertura, no pedir tercera ronda de código. Completar `db-tests` y `e2e-preview`, y validar `approval-policy` tras publicar el informe antes de mergear. Al ser una PR Draft, pasar a Ready queda para decisión del propietario. Esta revisión no aprueba ni mergea.

**Método / límites:** comparación remota entre commits, lectura de código y bitácora, comprobación de estructura y 10 mutaciones de propiedades sobre strings fuente realizadas independientemente. El repositorio no fue modificado con la batería. No se ejecutó `pnpm`, `merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` por falta de clon; se validó directamente que el JSONL actualizado parsea y preserva el historial de la ronda 1. No adjudicar runtime rojo mutado al revisor.