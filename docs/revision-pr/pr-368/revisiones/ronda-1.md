# Informe revisar-pr — PR #368 / T-354 — Ronda 1

**Fecha:** 2026-10-15  
**HEAD anterior del autor inspeccionado:** `83734650a04cc438ce117772419f2f3a61142083`  
**HEAD revisado después de autorización documental:** `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960`  
**Base develop consultada:** `eff5274dd5dbb1d6a0fb658299bbbdaceff44911`  
**Resultado:** **CON BLOQUEANTES (2)**. Revisión preparatoria de PR en Draft, todavía sin código de implementación.

## Método y límites
Se leyó la ficha de **develop** antes del diff, el issue #341, la bitácora y los comentarios del PR; también `COMO-ENTREGAR.md`, catálogo P01–P21 y skill `revisar-pr`. Se compararon archivos cambiados y se inspeccionó código de las rutas afectadas en develop. **No hubo ejecución local de typecheck/lint/test/Playwright ni mutaciones RED→GREEN**: no se dispone del clon ejecutable en esta sesión; además la PR no tenía código que comprobar. Ningún check se da por aprobado por inferencia.

## Resumen por prioridad
| Hallazgo | Tipo | Severidad | Ubicación | Diagnóstico |
|---|---|---|---|---|
| PR368-H01 | BLOQUEANTE | alto | diff de PR #368, `docs/tasks/log/T-354.md` | No hay implementación de la unificación de copy |
| PR368-H02 | BLOQUEANTE | alto | pruebas y bitácora `docs/tasks/log/T-354.md` | Ninguna prueba del nuevo comportamiento está demostrada en RED→GREEN, ni accesibilidad/E2E móvil |

## 🔴 PR368-H01 — Falta implementar el objetivo

**Evidencia [ANÁLISIS]:** el diff del HEAD `83734650a04cc438ce117772419f2f3a61142083` contenía solo `docs/tasks/log/T-354.md` (+13), con anuncio de trabajos pendientes. En develop siguen:
- `src/features/courier-onboarding/copy.ts`: `selfieTitle: 'Selfie de validación'`, `selfieSubtitle: 'Sin anteojos de sol ni gorra'`.
- `src/features/courier-onboarding/components/status-view.tsx`: `'Selfie de seguridad'`.
- `src/features/courier-onboarding/components/courier-profile-view.tsx`: `'Selfie de identidad'` y textos generales que dicen «selfie» sin explicar DNI.
- `src/features/admin/copy.ts`: `documentKind.selfie: 'Selfie con DNI'` y `queue.selfieBadge: 'Selfie'`.

**Solución:** modificar SOLO los archivos autorizados de T-354 para que el título completo sea `Selfie con el DNI`, con instrucción exacta decidida, sin cambio de kind `'selfie'`, Storage, acciones, RLS ni contratos. En admin verificar tanto detalle como cola. Verificar lectura íntegra de instrucción en móvil: `DocumentUploadCard` actualmente usa `truncate` sobre texto de estado/subtítulo.

**Cómo verificar:** tests de UI por vista contra texto renderizado; inspección de la carga en móvil 360×800 y 390×844, revisión del nombre accesible del input de imagen, y búsqueda exhaustiva de copys antiguos en los cuatro contextos. Nuevas pruebas RED→GREEN en SHA nuevo.

## 🔴 PR368-H02 — No hay controles que demuestren el nuevo comportamiento

**Evidencia [ANÁLISIS]:** la bitácora registra 315 tests preexistentes de onboarding/admin, pero también declara `tests de RED pendientes de implementar` y verificación de viewport/accesibilidad pendiente. No registra run E2E de PR #368 para la tarea. Ninguno de esos tests verifica todavía el DoD de T-354. Aserciones antiguas existentes en:
- `src/features/courier-onboarding/components.test.tsx` (IdentityForm y múltiples estados de StatusView).
- `src/features/offers/courier-panel.test.tsx` (pending, verifica «Selfie de seguridad» con «Pendiente»).

**Solución:** actualizar esas expectativas con el nuevo texto SIN eliminar las verificaciones de estado ni falsificar mocks; agregar asserts de título + instrucción real en input/tarjeta, perfil y admin, y probar `documentKind.selfie` y `queue.selfieBadge` en vistas renderizadas (no solo igualdad entre dos constantes). Hacer mutaciones independientes: cambiar intencionalmente texto en componente real, omitir instrucción, cambiar nombre accesible, revertir badge; cada control correspondiente debe fallar y volver a verde tras restauración. E2E Preview en entorno Develop y evidencia real; no tocar `e2e/**` fuera de alcance.

**Cómo verificar:** `pnpm typecheck && pnpm lint && pnpm test`, tests específicos, capturas móviles documentadas, E2E Preview con SHA/run/resultado. `pnpm test:db` solo si CC de servidor/esquema aprobado (no previsto).

## Decisiones 🔵, resueltas por Lautaro073
- 1-A: ampliación puntual de la ficha para la aserción en `src/features/offers/courier-panel.test.tsx`. **No se autoriza `src/features/offers/**`**.
- 2-B: `Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones`; preservar texto legible en móvil.
- 3-A: badge administrativo también `Selfie con el DNI`.

La revisión modificó exclusivamente la ficha `docs/tasks/T-354.md` para registrar estas autorizaciones y corregir una nota desactualizada que decía que la PR solo publicaba fichas. La ampliación **solo agrega el test existente indicado**, no contratos ni lógica externa.

## Revisiones adicionales antes de merge
- La rama estaba 4 commits detrás de develop; resolver por merge de `origin/develop` hacia rama de trabajo, **no rebase**. Revisar conflictos, especialmente ficha y numeraciones.
- `approval-policy` no estaba completado; no usarlo como certificado de calidad.
- Body de PR describe el resultado final todavía no presente: actualizarlo con evidencia solo cuando esté implementado.
- No se afirmó verde de CI (ni RED de mutaciones) en esta ronda preparatoria.
- No aprobar ni mergear. Nueva ronda debe leer el nuevo HEAD y verificar los controles independientemente.

## NO TOCAR
`src/domain/**`, `src/ui/**`, `src/server/**`, `supabase/**`, `.github/**`, `.agents/**`, `AGENTS.md`, `e2e/**`, deps y los restantes archivos de `src/features/offers/**`. No adulterar pruebas, snapshots, umbrales, timeouts ni fixtures; no simular RED/verde.
