# Informe de revisión independiente — PR #708 / T-433 — Ronda 2

**Fecha:** 2026-11-12  
**SHA exacto revisado:** `0d5616b8e7efa85325a2ddeda31a773f4cb838a0`  
**Base:** `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1` (sin avance durante la comparación)  
**Rama:** `feat/T-433-sec08-cron-secret`  
**Resultado:** **SIN BLOQUEANTES DE CÓDIGO (0)**; **PR708-H01 corregido**. Gate operativo D3-A independiente **pendiente**, no mergear.

## Chequeos obligatorios de ronda

- Head de la PR confirmado: `0d5616b8`; desde `9fa2b836` hay **un commit**, que toca únicamente `src/app/api/push/send/route.test.ts` y `docs/tasks/log/T-433.md`.
- El archivo productivo `src/app/api/push/send/route.ts` conserva blob `9c9cc878741fc9e5283ed68effec2f5e0c07916b`. No se cambió la autorización.
- `docs/revision-pr/pr-708/**` conserva íntegros los archivos de R1: el autor **no** tocó ni reescribió la carpeta.
- No se modifica `docs/tasks/T-433.md`; fuente de alcance `develop@dba3314f`; todos los cambios desde R1 están permitidos.
- `develop` sigue en `dba3314f`, y la PR informa `mergeable:true`. No fue posible ejecutar `git fetch`/`merge-tree` desde el container (error DNS `Could not resolve host: github.com`); se usó comparación de GitHub, que no equivale a `merge-tree`.
- Comentarios revisados (R1 y bot Vercel). El issue #666 tiene **0 comentarios**: todavía falta la constancia D3-A.

## H01 · CORREGIDO — comprobación independiente y límites

El agente aplicó el arreglo solo en `route.test.ts`:
1. `CRON_SECRET='test-cron-secret-0123456789abcdefX'` y `PUSH_SEND_SECRET='test-push-send-secret-0123456789ab'`: **ambos 34 bytes** (ASCII), distintos.
2. Test nuevo `SEC-08 (PR708-H01): un secreto incorrecto del mismo largo no autoriza`: crea `invalid = PUSH_SEND_SECRET.slice(0,-1)+'X'`; afirma valor distinto y mismo tamaño byte a byte; ejecuta el Route Handler con payload válido y exige **401**, con `sendPushNotification` **no invocado**.
3. El bypass de `Bearer CRON_SECRET` ahora también necesita comparar contenido, no solo longitud. Sigue habiendo caso positivo `Bearer PUSH_SEND_SECRET` 200, negativas por variable ausente y CC-049.
4. La bitácora declara: control **10/10 GREEN**; mutación `!crypto.timingSafeEqual(...) → false` **2 failed / 8 passed** (caen exactamente bypass y test nuevo); restauración desde buffer **10/10 GREEN**, sin modificación productiva publicada. No se ejecutó el arnés que vive en `docs/revision-pr/**`; el autor refiere haber usado un script propio fuera del repo. Esto cumple la regla de no ejecutar scripts de la carpeta.
5. **Comprobación propia:** se ejecutó un script aislado de Node en `/tmp/pr708-r2-independent.cjs` con los literales exactos del SHA y la condición de autorización. Reprodujo 401 para ambas credenciales incorrectas y 200 para la correcta. Además de `bypass` (comparación eliminada), se probó un **mutante nuevo del revisor**: comparar solo los primeros 40 de los 41 bytes de `Bearer PUSH_SEND_SECRET`. Ese mutante deja pasar el token con último byte erróneo (**200**), pero el original lo rechaza (**401**). Con ello se ejerce la propiedad de igualdad completa y no solamente longitud/prefijo.
6. **Limitación:** los mutantes anteriores se ejecutaron en el **predicado aislado**, no en Vitest ni en el Route Handler completo. No adjudicar al revisor el RED 2/8 de Vitest declarado por el autor. El CI verde del SHA sí ejecutó la suite real con la implementación correcta.

**Clasificación del hallazgo:** `arreglado-verificado` en `0d5616b8`, **método explícitamente limitado** a inspección de código publicado + prueba de predicado aislado + CI unit sobre el SHA. No se presenta como mutación independiente dentro de Vitest.

## Barrido de clase y regresiones

- Se releerán las tres rutas de autorización de la clase, no solo el test de H01: `/api/push/send` autentica exclusivamente con `PUSH_SEND_SECRET`, mientras los crons `/api/cron/health` y `/api/cron/sweep` siguen con `CRON_SECRET` por decisión de ficha. Ninguna ruta productiva cambió desde R1.
- `env.ts` mantiene `min(32)`, optional fail-closed, `refine` de desigualdad. `.env.example` y fixture M10 mantienen el arreglo R1. No se detectaron otros hallazgos.
- Sin cambios de dependencias, DB, RLS, contratos, workflow ni ficha.
- Queda fuera de alcance un refactor de `timingSafeEqual`; no aporta valor a SEC-08 en esta ronda.

## CI y evidencia reproducible

GitHub Actions [run 43182730559](https://github.com/cadeApp/cadeApp/actions/runs/43182730559), **head SHA `0d5616b8`**:

| Control | Resultado observado al revisar |
|---|---|
| `unit` | **204/204 archivos; 3872/3872 tests**, incluido `src/app/api/push/send/route.test.ts` **10 tests**; SUCCESS |
| `typecheck`, `lint`, `build`, `audit` | SUCCESS |
| `bundle-budget` | SUCCESS con warnings de otras rutas; `/api/push/send` **104 kB, OK**, sin regresión observada |
| `db-tests` | **IN_PROGRESS** al consultar; no atribuimos PASS |
| Checks locales de Vitest y `tools` del autor | El autor declara **10/10**, RED **2/8**, GREEN restaurado **10/10**, `pnpm test` 3872, `pnpm exec vitest run tools` 123. Su bitácora confirma 10/10 y 3872; no contiene la línea de tools 123 en la sesión nueva. **No se reprodujeron en el entorno del revisor.** |

En el contenedor de revisión existe Node, pero no `pnpm`; `git ls-remote` no resuelve `github.com`. No se clonó, no se levantó Docker/Supabase ni se tocaron secretos. Se verificaron SHA, blobs, comentarios y logs mediante el conector GitHub.

## NO TOCAR / descartados

| Hipótesis | Resolución |
|---|---|
| Falta de un secreto obligatorio de push | D1-A opta por fail-closed cuando falta; correcto |
| La ruta push debería aceptar el secreto del cron | Es exactamente el bypass SEC-08, corregido y cubierto |
| R2 debería modificar producción | No: H01 era defecto de tests; código productivo intacto |
| Ejecutar scripts documentados en `docs/revision-pr/**` | No se exige ni se hizo; la evidencia independiente corre desde `/tmp` |
| La ausencia de constancia D3-A es un defecto de código | No. Es **gate de operación**, obligatoria antes de merge |
| Warnings de bundle de otras rutas | Advisory preexistente, sin cambio en código de R2 |

## Cierre

**0 bloqueantes de código, 0 mejoras de implementación pendientes, 0 decisiones 🔵 nuevas.**  
**Merge NO autorizado:** falta D3-A en #666; también corresponde confirmar la conclusión posterior de `db-tests` del SHA de código. La firma y el merge siguen siendo de Lautaro073. Un nuevo commit exclusivamente documental de esta ronda no requiere otro CI GREEN por sí mismo.
