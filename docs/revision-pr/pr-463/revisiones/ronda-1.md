# Ronda 1 — PR #463 / T-381

**Fecha:** 2026-10-20. **Revisión independiente.** `HEAD` inspeccionado: `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68`. Base develop: `cf2fbe13ab7ee8348b4805dadccef5416abb9265`.

## Resultado: CON BLOQUEANTES (1)

Un bloqueante de **cobertura de un ítem obligatorio del DoD**. El código productivo que escucha `visibilitychange` está presente; no hay en esta ronda una falla productiva demostrada.

### PR463-H01 — Bloqueante / P08-control-no-cubre-lo-que-dice

- **Archivo:** `src/features/requests/hooks/use-merchant-panel-refresh.test.tsx`, test «foco y visibilidad visible refrescan con debounce; oculta no; una ráfaga da un solo refresco».
- **Clase completa examinada:** primer montaje, reingreso, rerender, foco, visibilidad visible/oculta, Realtime, ráfagas, debounce, desmonte y limpieza del canal; E2E de suspensión; regresión T-366.
- **Causa:** la parte positiva de visibilidad ejecuta `document.dispatchEvent(new Event('visibilitychange'))`, `window.dispatchEvent(new Event('focus'))` y el callback Realtime dentro del mismo `act`, y luego comprueba UN refresco. El refresco por foco o Realtime basta para satisfacer esa aserción aunque falte por completo el listener de visibilidad. El caso negativo (`hidden`) también pasa sin listener. No existe prueba positiva independiente de visibilidad.
- **Efecto:** se puede perder el refresco cuando la pestaña vuelve a ser visible **sin recibir foco ni Realtime** y el test continuaría verde. El DoD exige visibilidad como disparador autónomo; por ello bloquea cierre.
- **Mutación independiente I01 propuesta:** eliminar solamente `document.addEventListener('visibilitychange', onVisibilityChange);` mediante transform de Vitest en memoria. El código restante conserva foco y Realtime. El resultado esperable **por inspección** es verde, señal del hueco de cobertura, **NO ejecutado por esta revisión** (no hay clon ni dependencias instaladas en el entorno). Harness completo en `evidencia/comandos.md`.
- **Arreglo exacto:** en ese mismo test, después del caso oculto, emitir `visibilitychange` con `visible` sin disparar foco ni Realtime; avanzar el reloj por `debounce - 1`, afirmar que no refresca; avanzar 1 ms y afirmar un refresco adicional. Después verificar por separado la ráfaga de varios disparadores. Asegurar RED con I01, GREEN restaurado, sin falsificar mocks o expectations. Mantener test de desmonte.
- **Pruebas a ejecutar:** `pnpm exec vitest run src/features/requests/hooks/use-merchant-panel-refresh.test.tsx src/features/requests/components/merchant-requests-list.test.tsx`, `pnpm typecheck`, `pnpm lint`; loguear resumen real RED/GREEN.
- **Alcance permitido para arreglo:** solo `src/features/requests/hooks/use-merchant-panel-refresh.test.tsx` y `docs/tasks/log/T-381.md`, salvo hallazgo técnico nuevo demostrado y consultado.
- **Naturaleza del hallazgo:** análisis directo de estructura de prueba. No se marca `verificado-runtime`.

### PR463-A01 / D01 — Ampliación aceptada

`e2e/specs/request-states.spec.ts` (T-366): se añade `waitForURL('/merchant/dashboard')` y `page.goto('about:blank')` **antes de sembrar** solicitudes vencidas. Esto evita una reconciliación anticipada por el nuevo Realtime y preserva las aserciones posteriores de T-366. La ficha T-381 ampliaba los archivos permitidos durante implementación; el cambio excedía la ficha de **origin/develop**, por eso requirió decisión.

**Lautaro073 aceptó opción A el 2026-10-20.** No revertir ni expandir la ficha más allá de este ajuste; no es una verificación independiente del GREEN. El autor declara T-366 `1 passed` y `request-states.spec.ts` `15 passed` local Preview; CI final pendiente.

## Verificaciones y límites

- **SHA remoto** comprobado mediante refs de GitHub: `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68`, rama y PR coinciden; develop `cf2fbe13...`. `compare_commits`: 3 commits por delante, 0 por detrás, sin conflictos reportados por metadata `mergeable=true`. No se ejecutó `git merge-tree` local por falta de clon.
- **Siete archivos modificados**, dentro de la lista original salvo ajuste T-366 que quedó aceptado. Sin SQL/RPC/RLS, dependencias ni cambios de contrato.
- **Inspección productiva:** `useMerchantPanelRefresh` conecta `router.refresh()` tras reingreso, foco, visibilidad y `offers` por Realtime. Marca por documento, `400ms` de debounce, cancelación de temporizador/listeners y hook de canal existente. Se inspeccionó el consumidor real `MerchantRequestsList`, queries de `pending` y el flujo E2E nuevo. Sin otros bloqueantes de código confirmados en la revisión estática.
- **CI oficial para SHA revisado:** unit `153 passed` archivos y `2994 passed` tests (GitHub job `118823496653`); typecheck, lint, build, audit y bundle-budget `success`; `db-tests` terminó `cancelled`; `approval-policy` `failure` por informe aún ausente. `e2e-preview` no confirmado en ejecución oficial durante ronda por decisión del usuario.
- **Evidencia del autor, NO repetida independientemente:** Vitest `241 passed` (`src/features/requests`); 7 mutaciones RED→GREEN; E2E local `15 passed` (`request-states`), `90 passed + 3 flaky` (chromium), `6 passed` (global-settings), `CI=true --workers=1` contra Preview y Supabase Develop. Los 3 flaky no se atribuyen a T-381 sin diagnóstico independiente.
- **Restricción de entorno:** este revisor dispone de lectura y escritura de GitHub, sin checkout local descargable ni acceso a dependencias/credenciales Playwright. Por ello no declara haber corrido mutaciones, pnpm ni E2E. El harness de I01 es reproducible pero no fue ejecutado en esta ronda.

## Dictamen

**No mergear aún.** Corregir H01, hacer revisión de ronda 2 y completar gate final. D01 aceptada sin más decisiones. El comentario del PR contiene el prompt preciso para el agy.
