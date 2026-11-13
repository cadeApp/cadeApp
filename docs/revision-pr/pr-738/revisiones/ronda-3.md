# Ronda 3 — PR #738 / T-436 (ficha documental)

**Fecha:** 2026-11-12 (Argentina, UTC−03:00).  
**Resultado: SIN BLOQUEANTES documentales.** PR738-H05 **arreglado-verificado por inspección de la ficha**.  
**SHA del autor revisado:** `3d890c1526e44e09acc93fbe78d90bd6053ed3d1` · **Base:** `develop@3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc`.  
**Rama:** `feat/T-436-csp-enforce`; no aprobar ni mergear.

## Alcance de esta ronda

Se leyeron commit/diff, ficha, bitácora, fila T-436 del plan, cuerpo del PR y comentarios, y se contrastó el nuevo DoD con el contrato real de `e2e/AGENTS.md`, `docs/tasks/T-347.md`, `.github/workflows/e2e-mutation.yml`, `.github/workflows/e2e-mutation.mjs`, `e2e/mutations/manifest.json`, `tools/verify-fichas.test.ts`, T-391 y las rondas anteriores.

- **Commit `3d890c1526e44e09acc93fbe78d90bd6053ed3d1`:** exactamente `docs/tasks/T-436.md`, `docs/tasks/log/T-436.md`, `docs/implementation-plan.md` (solo fila T-436). El autor no modificó la carpeta `docs/revision-pr/pr-738/`.
- Al consultar GitHub, `develop` seguía en `3c4d26b`; rama 13 commits por delante y 0 detrás, PR abierta y mergeable. **No se ejecutó `git merge-tree` local.**
- En `docs/tasks/T-436.md:63-75` aparecen explícitamente `e2e/mutations/manifest.json` y `t436-csp-connect-{https,wss}.patch`, y están listados también en la columna de Archivos permitidos del plan. La columna DoD **coincide carácter por carácter** con el primer ítem del DoD de la ficha (`T-436.md:91`).
- `T-436.md:56-61,129-146,179-181` reconoce expresamente que el workflow `e2e-mutation` solo ejecuta sobre `target=develop` **ya mergeado**. Divide **gates pre-merge** (E2E real `e2e-preview`, GREEN y RED→GREEN del bypass `script/fetch/img` sin retries, validación del catálogo) de **mutaciones trusted post-merge** (dos `RED_CONFIRMED` y no cerrar #669 antes de obtenerlas).
- Los patches previstos solo pueden alterar `src/security/headers.ts` y deben declarar `id`, `invariant`, `patch`, `spec`, `grep` y `expectedFailure` asociado a una aserción **observada**, no a DNS/timeout/falla fabricada. El catálogo y patches **no se crean en esta PR documental**, sino en la PR de implementación.
- **D4-A** está en `T-436.md:56-61`, en la bitácora `docs/tasks/log/T-436.md:39-51` y en el cuerpo de PR. El origen es **selección automática del agente con la recomendada, sin aprobación personal explícita de Lautaro073**; no se afirma aprobación manual. D1-C/D2-A/D3-A se mantienen y la deuda XSS inline continúa en [#739](https://github.com/cadeApp/cadeApp/issues/739) (urgencia alta).

## Resultado por hallazgo

| ID | Estado en ronda 3 | Evidencia |
|---|---|---|
| **PR738-H01** | arreglado-verificado en **ronda 2**, sin nueva regresión | REST/Storage/Realtime desde browser real `T-436.md:118-128` |
| **PR738-H02** | arreglado-verificado en **ronda 2**, sin nueva regresión | Alta/baja de orígenes diferenciada `T-436.md:97-108` |
| **PR738-H03** | arreglado-verificado en **ronda 2**, sin nueva regresión | Host de bypass interceptado y RED verdadero `T-436.md:150-163` |
| **PR738-H04** | arreglado-verificado en **ronda 2**, sin nueva regresión | Captura de eventos antes de navegación y espera `T-436.md:92-101` |
| **PR738-H05** | **arreglado-verificado en ronda 3 (documentación)** | Catálogo autorizado + pre/post-merge separado `T-436.md:56-75,129-146,179-181` |

### PR738-H05 — verificación independiente

**Diagnóstico de R2:** el DoD solicitaba `RED_CONFIRMED` como gate de PR sin autorizar `e2e/mutations/**`, aunque el workflow trusted solo admite `develop` ya mergeado.

**Arreglo inspeccionado en el SHA `3d890c1526e44e09acc93fbe78d90bd6053ed3d1`:**

1. **Alcance:** la lista autoriza dos archivos `.patch` concretos y `manifest.json` solo para las entradas T-436. No modifica el workflow ni amplía a `.github/**`.
2. **Gates de implementación antes del merge:** `pnpm exec vitest run src/security/headers.test.ts`, typecheck, lint, test, `pnpm exec vitest run tools`, E2E-preview real con SHA final y RED del bypass contra el comportamiento de Report-Only seguido de GREEN, sin `e2e-mutation` trusted.
3. **Posterior al merge:** dispatcher con `target=develop` y dos mutaciones independientes; cada una debe producir control GREEN y mutante RED por `expectedFailure` observado (`RED_CONFIRMED`). Queda el issue #669 abierto hasta reunir ambas evidencias.
4. **Mecanismo real:** `e2e/AGENTS.md:15-27` y `docs/tasks/T-347.md` solo permiten un patch catalogado en `develop`, probado en loopback y sin pushear ni desplegar código mutado. `.github/workflows/e2e-mutation.mjs` valida los campos y el path `src/**`. La ficha ya respeta este contrato.

**Resultado:** H05 resuelto por **inspección independiente de la especificación**, `verificado_en_sha=3d890c1526e44e09acc93fbe78d90bd6053ed3d1`. **No afirma haber ejecutado `RED_CONFIRMED`, que pertenece a la etapa post-merge.**

## Observación editorial no bloqueante

En `T-436.md:39` todavía dice **«Las tres son»** cuando ya hay **cuatro** decisiones D1–D4. La procedencia de D4-A sí consta literalmente en bitácora y cuerpo PR, por lo que no afecta la autorizabilidad de los pasos ni exige otra ronda. Al volver a editar la ficha, usar «Las cuatro son» para claridad. No crear obligación de repetir CI exclusivamente por esta redacción.

### Nota para la implementación (no bloqueante)

El `manifest.json` de `e2e-mutation` elige **un solo `grep` por entrada**. Por eso la futura mutación HTTPS debe apuntar a un test real cuyo fallo observe los flujos REST **y** Storage, o documentar claramente qué prueba está seleccionada; no declarar ambos RED si solo se probó uno. El `expectedFailure` se debe calibrar con una corrida negativa real sobre checkout efímero/local permitido **antes** de escribirlo en el manifest (sin publicar mutaciones de seguridad en Preview).

## Pruebas y límites

- **Verificado por este revisor:** inspección independiente de HEAD/base/diff y fuentes; pruebas estáticas de consistencia ejecutadas contra el texto del SHA `3d890c1526e44e09acc93fbe78d90bd6053ed3d1` (permisos de los tres archivos, gates pre/post, invariantes de workflow, decisiones, DoD idéntico). Cinco mutaciones **documentales en memoria** (eliminar manifest, eliminar patch WSS, eliminar etapa post-merge, quitar «sin disparar trusted» y desincronizar DoD) fueron detectadas por los controles; **no constituyen ejecución de E2E**. Ver `../evidencia/comandos.md`.
- **Reportado por el autor, no reproducido aquí:** `pnpm exec vitest run tools`: 10 archivos / 123 tests en verde; `git diff --check` limpio.
- **Estado GitHub Actions observado:** CI del SHA `3d890c1526e44e09acc93fbe78d90bd6053ed3d1` run `43350144313` estaba **in_progress** (conclusion `null`) al consultar; **no se afirma CI verde**. Estados de Vercel `success` no reemplazan CI.
- **No ejecutados por el revisor:** clone/merge-tree, typecheck, lint, pnpm test, Playwright, `e2e-preview` ni `e2e-mutation` (sin checkout local); la PR es **documental**, los E2E de implementación pertenecen a la siguiente PR y a la fase post-merge.

## NO TOCAR

- No exigir CC: issue #669 marca que no hace falta; no toca base/esquema/RPC.
- No exigir nonces ahora (D1-C): deuda estricta #739, reconocida.
- No disparar `e2e-mutation` con la PR ni modificar su frontera trusted.
- No exigir los patches o nuevas pruebas E2E **implementados en la PR de ficha**.
- No alterar rondas 1/2 ni la ficha, bitácora o PR desde la carpeta de revisión.

**Cierre de ronda: SIN BLOQUEANTES documentales.** H05 corregido; el revisor no aprueba ni mergea. Lautaro073 decide el merge cuando correspondan los gates oficiales. Los resultados de runtime se comprobarán en la **PR futura de implementación** y en `develop` post-merge.
