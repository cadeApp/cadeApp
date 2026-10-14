# Revisión independiente — PR #310 · T-351 — Ronda 1

**Fecha:** 2026-10-08  
**SHA funcional revisado:** `cf0eed969db81d4eadb260e3fe0ddb9e63f7b6af`  
**Base develop leída:** `d2ad3315ae9403194a35726b25f84996110a9216`  
**Resultado: SIN BLOQUEANTES de código ni evidencia.**

## Alcance y método

Leí la ficha de T-351 desde develop, la bitácora, el diff completo de #310, los commits específicos, la PR de evidencia #309, los logs de pruebas remotos y los checks exact-head de #310. Revisé el funcionamiento de los cálculos de contraste con un cálculo **independiente** a partir de HSL del archivo `src/ui/tokens.css` (ver evidencia).

Cuatro archivos en diff: `src/features/courier-onboarding/components/document-upload-card.tsx`, `identity-form.tsx`, `components.test.tsx`, `docs/tasks/log/T-351.md`. Todos autorizados en ficha. Cero cambios en tokens, contratos, DB, RPC, workflows, dependencias, lógica de compresión/upload, textos o expectativa de pruebas existentes.

`develop` avanzó **un commit** desde la bifurcación: `d2ad331` (T-314: log/revisión + `e2e/specs/map-privacy.spec.ts`), sin rutas superpuestas. El compare muestra ahead 4 / behind 1, PR mergeable=true. No se detectó conflicto por inspección de rutas; GitHub sigue siendo fuente de verdad de mergeabilidad en el instante de hacer merge.

## Código / pruebas de componente

Las dos sustituciones son `text-primary` → `text-primary-dark`, en el texto de acción «Subir» (`DocumentUploadCard`) y en el asterisco DNI obligatorio (`IdentityForm`). La clase de color de «Cargado» queda `text-success`, la de «Reintentar» `text-destructive`, estados `text-muted-foreground`. No cambia el token global.

Se agregaron **seis** tests T-351 en `components.test.tsx`: idle, uploading (compressing true), uploading (compressing false), success, error y asterisco del DNI. En cada test se exige presencia de texto/rol de estado, clase concreta y contraste WCAG >= 4.5:1 derivado de tokens HSL de `src/ui/tokens.css`. Sin mocks para silenciar fallo ni timeouts/retries/skip; expectativas previas no tocadas.

Cálculo sRGB independiente sobre los valores HSL del archivo:
- `primary-dark` → RGB (11,122,125); `primary` → (9,186,189).
- `primary-dark` vs blanco: **5.129:1**, vs fondo de página: **5.006:1**, vs hover `primary/5` sobre blanco: **4.919:1**. Todos >= 4.5.
- Mutación de referencia solo **en cálculo en memoria**, sustituyendo `primary-dark` por `primary`: da 2.395, 2.337 y 2.297 respectivamente, **RED en las tres superficies**. No se tocó repo ni se reescribieron tests.
- La bitácora del autor documenta adicionalmente mutación RED de colores success/error y de variable `--success`; comprobamos que esas expectativas existen, sin presentarlas como mutaciones corridas independientemente en Vitest.

## E2E (PR #309 temporal, cerrada sin merge)

Verifiqué las líneas **reales** de GitHub Actions de estas pruebas, distinguiendo evidencia por test, porque #309 hereda fallos de main-flow/notifications/viaje ajenos a T-351:

| Paso | Commit | Job | Test provisional T-351 | DoD onboarding T-309 |
|---|---|---|---|---|
| RED color-contrast | `bf80693` | 113221577705 | **RED** four «Subir», color-contrast ratio 2.29/2.39 | RED |
| GREEN | `ff51dd5` | 113422451922 | **GREEN** | **GREEN** |
| RED label (htmlFor) | `8ba3e95` | 113432563439 | **RED** getByLabel(/DNI frente/i).toBeAttached | RED |
| Revert A | `7efd1e9` | 113444259041 | **GREEN** | **GREEN** |
| RED DNI frente omitido | `9162795` | 113455619811 | **RED** getByLabel(/DNI frente/i).toBeAttached | GREEN; **no detecta ausencia de tarjeta** |
| Revert B | `bc19634` | 113466915959 | **GREEN** | **GREEN** |

Ese resultado demuestra que el provisional ejerce la precondición de cuatro documentos que el test T-309 por sí solo no comprueba. Los mutantes quedaron revertidos por commits explícitos. Los RED son de **UI real**, no se obtuvieron cambiando expectations.

## CI exact-head `cf0eed96`

Comprobado con API y logs de GitHub:
- `typecheck` ✅, `lint` ✅, `unit` ✅ **123 archivos / 1948 tests**, `build` ✅, `audit` ✅, `bundle-budget` ✅.
- `db-tests` ✅ **Files=19, Tests=1854, Result: PASS**. No se ejecutó Supabase local.
- `Vercel` ✅; `e2e-preview` ✅ **43 passed** (primera etapa) y **3 passed** (segunda), run [37825667006](https://github.com/cadeApp/cadeApp/actions/runs/37825667006).
- `approval-policy` ❌ sobre HEAD funcional, **por falta de informe independiente en el cuerpo de la PR**. Es un problema documental de cierre, corregido al publicar esta revisión; **no se puede usar ese check como PASS hasta observar una nueva ejecución**.

## Límites y decisión

- El cálculo sRGB fue independiente; **NO** ejecuté `pnpm typecheck/lint/test` desde un worktree propio ni corrí Vitest/Playwright local. Los verdes de estas suites son los de GitHub CI y están claramente atribuidos.
- En esta ronda no detecté defectos nuevos, alcances extra ni opciones 🔵 de producto para Lautaro073.
- Condiciones de merge: informe independiente presente, `approval-policy` PASS reciente, todos los checks de CI/Vercel/E2E del HEAD documental en verde, confirmación GitHub mergeable. No alterar umbrales ni falsear tests para conseguir verde.
- Usuario autorizó explícitamente el merge de la **PR productiva #310**; #309 es REVIEW ONLY / NEVER MERGE y permanece cerrada sin merge.
