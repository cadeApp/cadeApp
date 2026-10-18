# Revisión independiente — PR #403 / T-367 — Ronda 4

**Fecha (Argentina):** 2026-10-17  
**SHA funcional examinado:** `1f37cd52ad634e20d550fa5c7cbee0ec9030ed47`  
**Rama PR:** `feat/T-367-avatar-perfil` → `develop`.  
**Resultado: CON BLOQUEANTES (1 operativo/integración: PR403-H09).** **La implementación T-367 no tiene bloqueantes de código nuevos identificados.** No aprobar ni mergear con `e2e-preview` fallido.

## 1. Correcciones de R3

**H08, CORREGIDO y comprobado con E2E real del SHA.** Se contrastaron cuatro archivos del delta desde R3: `courier-profile-view.tsx`, `components.test.tsx`, `courier-onboarding.spec.ts` y bitácora `T-367.md`. Ningún otro archivo modificado por el agente; `docs/revision-pr/**` sin adulteración.

- `courier-profile-view.tsx:321` ahora usa exclusivamente en el fallback del avatar `<User ... role="img" aria-label="Avatar de perfil no disponible" />`. El `User` del menú no se modifica.
- `components.test.tsx:788,818` exige `screen.getByRole('img', {name:'Avatar de perfil no disponible'})` en los casos de URL nula y de evento `onError`.
- `courier-onboarding.spec.ts:1578,1593,1606-1607` reemplaza los tres selectores globales `svg.lucide-user` por la consulta de rol y nombre accesibles; si Storage devuelve una ruta inexistente, también exige que la `img` de foto esté ausente.
- Bitácora `docs/tasks/log/T-367.md:155-189`: el autor registra GREEN→RED→GREEN del harness H08 (1 caso pasó, mutación falló por `Unable to find an accessible element with the role "img" and name "Avatar de perfil no disponible"`, restauración pasó). **No volví a correr la mutación del autor**; no atribuir ese RED a verificación ejecutada por mí.
- **E2E de T-367 realmente pasó en CI:** run `39082879612`, job `117543358816`, línea ~558: `✓ ... courier-onboarding.spec.ts:1500 ... T-367 ... (29.1s)`. Suite Chromium completa: **87 passed (26.0m)**. Por tanto, para los requisitos efectivamente ejercidos, H02/H07/H08 se verificaron mediante Playwright real, no sólo inspección.

**H01/H03/H06:** continúan corregidos en fuentes, sin nuevos cambios desde R3; las pruebas unitarias están en GREEN. **H05:** documentación de la mutación visual presente; la evidencia del autor no se reejecutó en esta sesión y continúa con la calificación más limitada `arreglado-sin-verificar` (sin bloquear por duplicación de prueba, dado E2E real).

## 2. PR403-H09 — BLOQUEANTE operativo: integración con develop desactualizada

**Clasificación:** MEDIO — integración / cobertura E2E.  
**SHA examinado:** `1f37cd52ad634e20d550fa5c7cbee0ec9030ed47`.

El `e2e-preview` requerido para merge **terminó FAILURE** en run `39082879612`, pero **NO falló T-367**:

- Proyecto `chromium`: 87/87 PASS, incluida la E2E de T-367. Fuente: job 117543358816.
- Proyecto `global-settings`: prueba `e2e/specs/subscription.global-settings.spec.ts:107` de **T-306** falló en sus tres intentos. La aserción `getByRole('alert').filter({hasText:/suscripción está vencida|SUBSCRIPTION_INACTIVE/i})` no encontró ese mensaje (`toBeVisible`, timeout 10s, línea 136). Resultado: 1 failed, 2 did not run. **No alterar el test para fabricar verde.**
- **Causa de integración fundada por comparación:** la PR conserva la versión de T-306 que exige `SUBSCRIPTION_INACTIVE`. En `develop` el archivo ya fue corregido por **PR #407 / T-371, mergeada**, para el contrato actual `PUBLICATION_CREDITS_EXHAUSTED` de CC-029; además añadió snapshot/restauración exacta del estado de suscripción. Fuente: `e2e/specs/subscription.global-settings.spec.ts` de HEAD y de develop, y SHA de merge develop `0488f8a98f44b67101c7c520696c356d46c161ff`. La rama T-367 sigue atrás de `develop` en **21 commits**. No hay modificación de T-306 ni lógica de publicaciones en los commits propios de T-367, por lo que **no es una regresión del avatar**.
- Evidencia de que la corrección upstream es operativa: la PR #407 tiene run E2E trusted `39069904081` **SUCCESS**; la revisión independiente #407 documenta 86 Chromium + 3 global-settings PASS. No se afirma que el nuevo merge T-367 ya haya pasado.
- **Solución sin modificar T-306 en esta PR:** incorporar `origin/develop` mediante **git merge normal** en `feat/T-367-avatar-perfil`, sin rebase. Conservar íntegramente de `develop` los cambios de T-371 y CC-030/T-370, sin editarlos manualmente ni copiar el test a mano. Si aparecen conflictos ajenos a T-367, reportarlos en vez de decidir al azar. Registrar SHA de merge, ejecutar tests y confirmar nuevo `e2e-preview=success` en SHA final. La mera resolución del merge no autoriza a asegurar que la suite ya pasó.

### Decisión de alcance

El merge de `develop` **no es una ampliación unilateral de T-367**: trae cambios ya mergeados de T-370/T-371; su origen queda auditable por el commit de merge de dos padres. La alternativa de editar a mano T-306 en esta rama está **descartada**: duplica un fix upstream e ignora snapshot/restauración. Desactivar `global-settings`, aprobar pese a gate fallido o modificar workflow está **prohibido**.

No hay 🔵 decisiones de producto o arquitectura para Lautaro073.

## 3. CI y verificación en el SHA de código

| Control | Resultado y fuente |
|---|---|
| CI | `39082823396` = SUCCESS |
| Unit | job `117543157338`: **141 files / 2696 tests PASS**, más 79 workflow tests y 6 ADR tests |
| DB | job `117543157370`: pgTAP **Files=29, Tests=2735, Result: PASS**; generación de tipos y `git diff --exit-code` en verde |
| Typecheck, lint, build, audit, bundle-budget | SUCCESS |
| Vercel Preview | SUCCESS |
| E2E Chromium, incluido T-367 | **87 PASS**, run `39082879612` |
| E2E global-settings | **FAIL** exclusivamente en T-306 obsoleto; dos casos no se ejecutaron |
| approval-policy | FAIL, job `117543153462`: `El PR requiere aprobación vigente de Lautaro073`; esperar a levantar H09 |

No hay clon ni DNS funcional de github.com en este contenedor: **no corrí** pnpm, git merge-tree, Docker, SQL remoto ni mutaciones locales. El veredicto se apoya en lectura de archivos, comparaciones por GitHub y **logs reales de CI** del SHA.

## 4. Acción y cierre

1. Agy: `git pull`, integrar `origin/develop` sin rebase y sin editar tests ajenos, preservar revisión independiente.
2. Resolver sólo conflictos puntuales de integración (si los hay); priorizar la ficha T-367 en `develop` si se conflicta con ella. Registrar los caminos reales en bitácora.
3. Ejecutar `pnpm exec vitest run tools/verify-fichas.test.ts`, pruebas focalizadas T-367, `pnpm typecheck && pnpm lint && pnpm test`, `git diff --check`; el gate E2E se ejecuta automáticamente con Vercel Preview al push normal. No exigir otro CI GREEN **sólo por una edición documental**, pero sí por el merge funcional con develop.
4. Solicitar R5 sobre nuevo SHA: verificar que T-371 E2E global-settings haya pasado y que T-367 mantenga E2E 100% GREEN.

**Veredicto:** **CON BLOQUEANTES (1 de integración/CI, ninguno nuevo del avatar). NO MERGEAR todavía.** La validación humana en staging sigue siendo posterior al merge/promoción.
