# Informe de revisión independiente — PR #315 / T-347 + T-313 — Ronda 1

**Fecha:** 2026-10-09 · **SHA de código revisado:** `c6220ba587ffaab7c27fe83f2746600d60e0cbb7`
**Base original:** develop `24aad21` · **develop luego de merge #314:** `92cd258545f25e162ada062c0c22c02ff17840b8`
**Resultado: CON BLOQUEANTES (1)**. No aprobar ni mergear PR #315.

## Lecturas y método

- Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, fichas T-347/T-313 **de develop**, bitácora `docs/tasks/log/T-347.md`, comentarios, patch del PR y código del spec en PR #251 (`77d430b`).
- La ficha T-347 permite los cuatro archivos modificados: `verify-workflows.test.mjs`, `manifest.json`, `t313-courier-merchant-guard.patch` y bitácora. No cambia código `src/**` real, migraciones, middleware ni tests E2E.
- `manifest.json`: ids distintos; `expectedFailure = ["toHaveURL","Expected pattern: /\\/courier\\/feed/"]`, asociado al caso `DoD: Un courier no entra a (merchant)`. La PR #251 está abierta y ese spec no existe aún en develop. Diferir únicamente esa lectura es la decisión D06-C.
- El patch afecta una sola línea de `src/features/auth/guards.ts` y su `index b5c2de5` concuerda con el blob real `b5c2de551e4bf435966a9bbc3739dddee32d38d9` en develop **después** del merge #314. No se considera demostración de `git apply --check` ejecutado.
- El runner ya existente mantiene `target=develop`, usa el catálogo trusted de default branch y rechaza resultados distintos de control GREEN + mutante RED por aserción específica. No se ejecutó ni se solicitó `repository_dispatch`.

## PR315-H01 — BLOQUEANTE · alto · P08-control-no-cubre-lo-que-dice

**Archivo:** `.github/workflows/verify-workflows.test.mjs:1866-1868`
**Estado:** ABIERTO · **Origen:** agente · **Detección:** análisis con reproducción del predicado en memoria, NO ejecución del test runner completo.

### Diagnóstico

La validación del catálogo comprueba que el spec contiene `test('DoD: Un courier no entra a (merchant)'` y en **cualquier lugar del archivo** la cadena `'.toHaveURL('`. Esa segunda búsqueda no demuestra que el caso invoque el helper con la aserción ni que la primera ruta exija `/courier/feed`. El spec de #251 contiene varios `toHaveURL` ajenos al caso.

### Mutaciones independientes del revisor

Se tomó el contenido real de `e2e/specs/merchant-registration.spec.ts` de PR #251 (`77d430b`) y se evaluó **exactamente el predicado actual** `spec.includes(test...) && spec.includes('.toHaveURL(')`, antes y después de cada mutación de memoria.

| Estado | Cambio concreto en memoria | El predicado informa |
|---|---|---|
| Control | Spec original de #251 | GREEN |
| M1 | Quitar `await expect(page).toHaveURL(expectedUrl);` del helper `expectMerchantPanelBlocked` | **GREEN indebido** |
| M2 | Quitar la llamada `await expectMerchantPanelBlocked(page, path, expectedUrl);` del bucle del caso courier | **GREEN indebido** |
| M3 | Cambiar la primera ruta `/merchant/dashboard` para esperar `/merchant/dashboard` en vez de `/courier/feed` | **GREEN indebido** |

En los tres casos se altera una propiedad que el test dice proteger y el predicado sigue verde: **falso negativo del control estructural**, no afirmación sobre Playwright runtime. El harness completo para repetir `node --test` en un worktree temporal está en [evidencia/comandos.md](../evidencia/comandos.md). No se ejecutó en esta sesión.

### Arreglo exigido — decisión 1-A

En `.github/workflows/verify-workflows.test.mjs`, extraer y verificar específicamente el bloque `test('DoD: Un courier no entra a (merchant)'` y el cuerpo real de `async function expectMerchantPanelBlocked`, evitando coincidencias globales con otros casos:

1. El caso usa la primera ruta `/merchant/dashboard` con patrón `/\\/courier\\/feed/` y recorre las rutas.
2. El bucle de ese caso efectivamente llama `expectMerchantPanelBlocked(page, path, expectedUrl)`.
3. El helper efectivamente ejecuta `await expect(page).toHaveURL(expectedUrl)`; el matcher no es un comentario.
4. Cada mutación M1/M2/M3 da RED con mensaje específico y el original GREEN. Sumá tests unitarios de validación de fragmentos si son necesarios; no tocar el spec de #251 para acomodar el test.

No basta con `spec.includes('.toHaveURL(')` ni con comprobar otro caso que use el matcher. El RED de `e2e-mutation` **real** continúa reservado a después del merge de #251. No alterar `expectedFailure`, mocks, skips, timeouts ni la guarda productiva para obtener verde.

## Estado de CI y dependencia externa

Sobre el HEAD funcional `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` (checks anteriores al merge #314):

| Check | Resultado observado | Alcance |
|---|---|---|
| unit | ✅ CI: 125 archivos Vitest; 76 pruebas de workflows; 6 ADR | No prueba el vínculo entre matcher y caso courier; H01 escapó |
| typecheck, lint, build, audit, bundle-budget | ✅ | Pasaron en el SHA anterior al commit del revisor |
| db-tests | ✅ 20 archivos/1903 pgTAP, `Result: PASS`; otro bloque 1 archivo/10 pruebas | No se ejecutó Supabase local |
| Vercel Preview | ✅ | Preview del SHA funcional |
| e2e-preview | ❌ 53 pass/3 fail en `fixed-price.spec.ts` | Errores de hidratación/sesión T-339 también observados en otros runs; PR #314 corrige esto |
| approval-policy | ❌ | Falta informe de revisión sin bloqueantes; H01 sigue abierto |

**Decisión 2-A ejecutada:** PR #314 se mergeó a develop con `92cd258545f25e162ada062c0c22c02ff17840b8`; su último HEAD `dc582d2` tenía `approval-policy` y `e2e-preview` verdes. **No equivale a revalidar #315.** Agy debe hacer merge de `origin/develop` en la rama de #315, sin rebase ni force-push, una vez aplicado H01. Confirmar el CI y el trusted E2E sobre el nuevo HEAD.

El estado previo de GitHub `mergeable` se recalculó tras el merge; la API REST posterior informó `mergeable=true`, `mergeable_state=unstable` (checks rojos). No se verificó `git merge-tree` local por no haber clon.

## No tocar / pendientes legítimos

- La mutación `t313-courier-merchant-guard.patch` **no es** modificación productiva en la PR.
- `SPEC_PENDING_MERGE` se limita a id/spec/grep definidos para #251 mientras ese archivo falta. No reportarlo como un bypass general de specs.
- La ejecución de mutación real antes del merge de #251 daría control inválido; esperar la secuencia D06-C.
- Los tres fallos actuales de `fixed-price.spec.ts` no se atribuyen al catálogo; la solución está en PR #314 ya mergeada a develop.
- No ejecutar GitHub Actions manualmente ni tocar entorno Supabase.
- No se repitieron los RED locales declarados por el autor; cualquier rojo suyo se conserva como evidencia **del autor, no verificación independiente**.

## Checklist de siguiente ronda

- [ ] H01 corregido y prueba estructural GREEN auténtica.
- [ ] M1/M2/M3 RED en `node --test`; aportar salida compacta de `# tests / # pass / # fail`.
- [ ] Batería independiente nueva del revisor en el SHA actualizado (no reutilizar la del autor).
- [ ] Merge de develop tras #314, `git merge-tree` limpio y HEAD push verificado.
- [ ] CI del nuevo SHA, incluidos unit, db-tests, e2e-preview, approval-policy cuando corresponda.
- [ ] No dispatch de T-313 antes de merge de #251.

**Veredicto:** CON BLOQUEANTES (1), por insuficiencia comprobada de la aserción estructural. No aprobado, no mergeado.
