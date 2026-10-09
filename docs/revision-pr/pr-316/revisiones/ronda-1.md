# PR #316 — Ronda 1 — 2026-10-09

**Informe independiente — T-347**  
**Resultado: SIN BLOQUEANTES (0)**  
**SHA de código verificado: `839d101fa7b2901c029d815a262b3c8809a1d8ee`**; base develop `b8503fa13c21fd172ee3bd79045d66efb35af3ba`.

## Causa y corrección

El run real anterior `37900097487` terminó `CONTROL_NOT_GREEN`: el control hizo la navegación desde `127.0.0.1` a `localhost` y perdió la sesión por cambio de host. Esta PR alinea origen Playwright y `NEXT_PUBLIC_APP_URL` en `http://localhost:3100`, **sin cambiar el bind del servidor**, que sigue en `127.0.0.1`. La prueba usa el `NextURL` real para mostrar que el middleware conserva el origen. La evidencia adicional del autor con cookies ficticias discrimina el cambio de origen; no se le atribuye una prueba de mutación real.

## Alcance y seguridad

6 archivos cambiados, todos permitidos por `docs/tasks/T-347.md`: `.github/workflows/e2e-mutation.{mjs,yml}`, `.github/workflows/verify-workflows.test.mjs`, `e2e/AGENTS.md`, `docs/tasks/T-347.md`, `docs/tasks/log/T-347.md`. La ficha se modificó **solo para reflejar** la nueva base URL del browser; no agregó targets ni relajó la política de secretos. No hay cambios `src/**`, a RLS, catálogo de patches, specs, manifest, `expectedFailure` o dependencias. `repository_dispatch` sigue siendo el único disparador y solo `target=develop`. Los builds de control y mutante conservan comandos, retries=0 y bind a loopback. El patch continúa aplicándose en checkout efímero y se revierte.

La nueva validación `checkBaseUrl` admite exactamente `http://localhost:<puerto>` con puerto 1024–65535; rechaza hosts remotos, esquemas HTTPS, segmentos extra, userinfo, valores engañosos y el origen `127.0.0.1`. El health check continúa probando `127.0.0.1`.

## Reproducción independiente limitada

El entorno del revisor no dispone de clon ni dependencias Next.js; **no se corrió Playwright local ni un servidor con Supabase**. Mediante inspección del SHA exacto y harness propio de Node/V8 (fuente íntegra en `evidencia/comandos.md`), comprobé:
- CONTROL: 3 URLs válidas aceptadas y 15 inválidas rechazadas.
- 4 alteraciones adversariales de `PLAYWRIGHT_TEST_BASE_URL`, `NEXT_PUBLIC_APP_URL` (una o dos fases) y bind son detectadas por el invariante.
- Las garantías de restringir target, no exponer secretos y no cambiar expectativas provienen de la comparación del diff del PR.

**Verificación remota CI sobre el SHA funcional**:
- CI `37902006016`: `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` y `db-tests` success.
- Job unit: 125/125 archivos Vitest, 2014/2014 casos, 79/79 pruebas de workflows y 6/6 ADR. La nueva prueba `e2e-mutation browser origin survives the middleware redirect without losing the session` aparece **ok 65**.
- db-tests: pgTAP `Files=20, Tests=1903, Result: PASS`; comprobación de tipos de BD incluida.
- Trusted Preview E2E, run `37902085806`: success, 58 casos Chromium pasados (uno requirió retry #1), 3 global-settings pasados. El caso `DoD: Un courier no entra a (merchant)` pasó sobre el Preview: esto **NO** reemplaza la mutación local.
- Vercel status: success.
- `approval-policy`: rojo exclusivamente por falta del informe de revisión al momento del check. Este informe se agrega ahora; no declarar nuevo GREEN hasta que se ejecute otra vez.

## Decisión técnica adoptada

- **A: cambiar el middleware productivo** para no canonizar loopback: mayor alcance, riesgo de regresión y no aporta funcionalidad de producción. Descartada.
- **B: browser en localhost, servidor ligado a 127.0.0.1**: mantiene el mismo origen durante redirects reales sin publicar el servicio; elegida.
- **C: cambiar servidor a `localhost` o `0.0.0.0`**: cambiaría la superficie de escucha o fiabilidad de la dirección, sin necesidad. Descartada.

No hay hallazgos bloqueantes probados. **Posibilidad por validar tras el merge:** resolución de localhost y conexión efectiva al servidor ligado solo a IPv4 en el runner; la evidencia real obligatoria sigue siendo control GREEN y mutante RED. Nunca debilitar guardas para alcanzar GREEN.

## Pendientes y regla de cierre

1. Revalidar `approval-policy` tras incorporar el informe a la PR; el commit documental mueve HEAD y puede disparar CI nuevamente.
2. Lautaro073 decide y ejecuta el merge; esta revisión **no aprueba ni mergea**.
3. Lanzar `repository_dispatch` con `target=develop` y `mutation=t313-courier-merchant-guard`; verificar control GREEN **exactamente una vez**, mutante RED por la aserción esperada, `RED_CONFIRMED`, `git apply -R`, artifact minimizado y workflow success.
4. Mientras eso falte, `#289` y **H04 de PR #251** siguen pendientes de cierre funcional, aunque el board los marque cerrados.

**Checks locales del revisor:** typecheck, lint, Vitest, Playwright y pgTAP **no ejecutados** en máquina local; se verificaron los logs remotos sobre el SHA mencionado y el harness aislado.

