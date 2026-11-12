# Informe revisar-pr — PR #707 / T-433 — Ronda 1

**Fecha:** 2026-11-12 (Argentina)  
**Autor de la revisión:** ChatGPT, revisión independiente  
**PR:** https://github.com/cadeApp/cadeApp/pull/707  
**Head auditado:** `cdd964438d8f4ed726fa0f2eeaad3ee28621b1bf`  
**Base de comparación:** `develop@395fdce5f034e2d7c630c2d9f0272ee018477f3a`  
**Resultado: CON BLOQUEANTES (1 documental).** No se aprueba ni mergea.

## Resumen

| ID | Tipo | Severidad | Ubicación | Diagnóstico |
|---|---|---|---|---|
| PR707-H01 | BLOQUEANTE | alto | `docs/tasks/T-433.md:45-54,104` | D3 verifica Vercel y manda actualizar el secret «del repo» solo si se rota; no verifica el secreto **efectivo** de GitHub en jobs con environment. |
| PR707-H02 | MEJORA | bajo | `docs/tasks/T-433.md:36` | CC-040 no documenta la ruta `/api/push/send` que D1-C cita como motivo para descartarla. |
| PR707-H03 | MEJORA | medio | `docs/tasks/T-433.md:41-58` | Un largo de 32 caracteres no demuestra entropía; falta instrucción de generación segura sin divulgar el valor. |
| PR707-H04 | MEJORA | bajo | `docs/tasks/T-433.md:43-44` | `serverEnv` es lazy; fallan los accesos que lo disparan, no se demostró que absolutamente todas las rutas del servidor lo hagan. |

## H01 — BLOQUEANTE · Verificar por separado GitHub Actions y Vercel, con precedencia correcta

**Diagnóstico.** D3-A pide verificar `CRON_SECRET` en Vercel antes de promover y, **solo si hay rotación**, actualizar «el del repo (e2e-preview, e2e-mutation)» y los secrets de environments staging/production. Sin embargo:
- `.github/workflows/e2e-preview.yml:45,143`: el job que recibe `CRON_SECRET` usa `environment: develop`.
- `.github/workflows/e2e-mutation.yml:27,99,124`: los jobs de control y mutación también corren en `environment: develop`.
- `.github/workflows/e2e-staging.yml:29,39`: consume el secreto efectivo del environment `staging`.
- `.github/workflows/health-cron.yml:22,29,43,50`: los jobs usan `staging` y `production` respectivamente.

GitHub prioriza un secret del **environment** sobre uno del repositorio con el mismo nombre: https://docs.github.com/en/actions/reference/security/secrets. Si hay un override de `develop`, rotar solo el del repo no cambia lo que reciben esos jobs. Además, que el valor de Vercel tenga ≥32 caracteres **no prueba** la longitud ni igualdad del secret efectivo de Actions: si no se rota Vercel, el procedimiento actual ni siquiera exige contrastarlo.

**Riesgo (condicional, no incidente confirmado).** E2E podría fallar por `serverEnvSchema` al recibir un secreto corto; `health-cron` podría devolver 401 tras rotar únicamente el Vercel secret; si son iguales pero débiles, `min(32)` no evita adivinación. **No se consultaron nombres configurados ni valores actuales de secrets.** El hallazgo es un defecto comprobado de la especificación de rollout, no una afirmación de mala configuración existente.

**Evidencia independiente (documental).** Control de texto sobre el SHA auditado: wiring de los cuatro workflows OK, pero D3 carece de las 3 obligaciones para GitHub develop/precedencia/verificación efectiva. Corrección simulada **en memoria** → 3/3 presentes; mutación que elimina de nuevo la mención a `environment develop` → RED. Ver script íntegro y límites en `../evidencia/comandos.md`.

**Arreglo mínimo exacto, sin cambiar D3-A.** En `docs/tasks/T-433.md` `Decisiones / D3-A` y checklist `DoD`:
1. Verificar **independientemente** que el secret de Vercel y el secret efectivo de Actions de cada ámbito sean válidos antes de activar `min(32)` o promover. No condicionar la comprobación de GitHub a que Vercel se rote.
2. Aclarar: `e2e-preview` y `e2e-mutation` usan `environment: develop`. Para `CRON_SECRET`, si existe secret en ese environment prevalece sobre el del repo; en caso contrario aplica el del repo. `e2e-staging`/`health-cron` usan `staging`; `health-cron` producción usa `production`.
3. Si hubo rotación, sincronizar el secreto del cron que recibe el **deployment Vercel** y el que utiliza el **caller Actions** correspondiente, y registrar un gate de funcionamiento (cron autorizado/health-cron exitoso, no 401) antes de continuar. Nunca copiar, pegar ni imprimir valores en CI, issues, bitácora ni informe.
4. En `DoD` establecer que se registra en #666 solo constancia `sí/no` por ambiente de esta doble verificación y que se bloquea la promoción si falta. La ejecución humana queda diferida a los checkpoints de implementación/promoción, **no a esta PR documental**.

**Comprobación RED→GREEN solicitada al autor:** usar el harness de `evidencia/comandos.md` desde `/tmp` contra la ficha. El original debe fallar H01; después del arreglo debe pasar, y al quitar en memoria la referencia al environment `develop` debe fallar otra vez. Esto solo demuestra integridad del runbook, no prueba secrets reales.

## H02 — MEJORA · Corregir procedencia contractual de la ruta

`docs/contracts/CC-040.md:100-109` describe una **server action** del admin que llama a `sendPushNotification`, no documenta `/api/push/send`. `docs/tasks/log/T-203.md:16` documenta la creación de `src/app/api/push/send/route.ts` y su protección actual con `CRON_SECRET`. La razón de descartar D1-C debe referirse a la ruta preexistente de T-203 y al alcance elegido para SEC-08, **no afirmar** que CC-040 contiene esa frontera. La decisión D1-A puede conservarse sin nueva votación. Control en memoria: ausencia de la ruta en CC-040 y presencia en T-203 verificadas; corregir el texto GREEN, reintroducir la frase RED.

## H03 — MEJORA · Distinguir longitud de fortaleza criptográfica

`min(32)` es una propiedad de longitud, no de entropía. Una cadena de 32 caracteres repetidos la satisface, aunque sea predecible; no se afirma que exista tal secreto desplegado. Agregar en D3-A la exigencia operativa de generar valores **únicos por ambiente** mediante un generador criptográfico de al menos **32 bytes aleatorios** (ej. password manager/CSPRNG) y guardarlos directamente en los secret stores; registrar solamente la comprobación sí/no. Mantener `min(32)` como validación en runtime. Mutación documental: eliminar la instrucción de aleatoriedad debe dejar en rojo el control independiente.

## H04 — MEJORA · Limitar la afirmación sobre serverEnv al comportamiento real

`src/server/env.ts:44-65` devuelve un `Proxy` y llama a `getServerEnv()` desde `get`/`ownKeys`/`getOwnPropertyDescriptor`. La validación es perezosa: un `CRON_SECRET` insuficiente afecta a **cualquier acceso a ese Proxy** que fuerce el parseo del schema, pero no consta que toda ruta HTTP lo haga. Sustituir «hace fallar todas las rutas de servidor» por «hace fallar las rutas/funciones que acceden a `serverEnv`, pudiendo afectar rutas no relacionadas con cron». No altera el riesgo operativo ni D3-A.

## Controles de alcance, trazabilidad y decisiones

- Antes del diff se leyeron `COMO-ENTREGAR.md`, `docs/revision-pr/README.md` y `.agents/skills/revisar-pr/SKILL.md`; antecedentes de lecciones, en particular P08, AG-37, AG-60 y AG-77.
- La ficha `docs/tasks/T-433.md` **no existe en el SHA base**, porque esta es su PR de creación: por tanto, no hay una ficha previa en develop que se esté ampliando. La fila del `docs/implementation-plan.md` agrega exactamente T-433. Los tres archivos modificados están dentro de la whitelist de la ficha creada.
- SHA validado con comparación GitHub: un commit delante de `395fdce5`, cero detrás, 3 archivos, +148/-0; `develop` seguía en esa base. No había carpeta `pr-707` del autor ni comentarios sustantivos previos; solo comentario automático de Vercel. GitHub `mergeable:true`, sin ejecución de `git merge-tree`.
- D1-A (secreto push opcional, 401 sin valor), D2-A (distinto de cron) y D3-A (min 32 con checkpoint humano) **se mantienen**. No se abren decisiones nuevas. La ficha aún debe pasar por la ronda correctiva.
- `src/app/api/push/send/route.ts` hoy compara con `CRON_SECRET`; `src/app/api/cron/{sweep,health}/route.ts` también lo usan. Se verificó que el DoD exige bypass 401, éxito solo con `PUSH_SEND_SECRET`, ruta sin variable fail-closed, y casos de 31/32, igualdad, fixtures M10 y RED de regresión. Son exigencias para la **futura implementación**, no resultados ejecutados en esta PR.

## Checks y limitaciones de evidencia

| Control | Estado en esta ronda |
|---|---|
| Diff, base, whitelist, bitácora, contrato y workflows | inspección GitHub del SHA |
| Auditoría documental independiente + mutaciones en memoria | original RED, corrección candidata GREEN, reintroducción de H01 RED |
| `pnpm typecheck` / `pnpm lint` / `pnpm test` | **no ejecutados**: contenedor sin acceso DNS a GitHub, sin clon |
| `pnpm exec vitest run tools` | **123/123 declarado por el autor**; no reproducido independientemente |
| CI del SHA, job unit/db-tests | **no inspeccionado**: hay bloqueante, conforme al protocolo |
| E2E, Supabase, Docker, Vercel, secrets | **no ejecutados ni consultados** |
| `git merge-tree` | **no ejecutado**; GitHub reporta mergeable pero no equivale |
| Script desde checkout local limpio | no ejecutado; evidencia documental independiente en V8, no prueba npm/Vitest |

La precisión del rojo es importante: **no se mutó ni ejecutó el código de producción** ni se fabricó una prueba Vitest. El test textual de D3 y las mutaciones se hacen exclusivamente sobre texto en memoria; no se declara una ejecución de tests de aplicación ni validación real de secretos.

## Siguiente ronda y NO TOCAR

El autor solo necesita ajustar `docs/tasks/T-433.md` y actualizar `docs/tasks/log/T-433.md`, con evidencia de la comprobación documental y checks. **No modificar** `docs/revision-pr/**`, `.github/**`, código de rutas, tests de aplicación, `.env*` (excepto el `.env.example` de la futura implementación), ni secretos para cerrar esta ronda. Sin nuevas dependencias, sin tests falsos o expectativas adulteradas. Antes de trabajar: `git pull` de esta rama; nunca rebase, force-push ni amend. Luego: nueva revisión independiente sobre el SHA de arreglos. No aprobar ni mergear.
