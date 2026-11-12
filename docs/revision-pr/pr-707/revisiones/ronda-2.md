# Informe revisar-pr — PR #707 / T-433 — Ronda 2

**Fecha:** 2026-11-12 · **Revisión independiente:** ChatGPT  
**SHA auditado:** `6f5a142c755827667ed66cc55eedb31ed7e1325d`  
**Base:** `develop@395fdce5f034e2d7c630c2d9f0272ee018477f3a`  
**Resultado: SIN BLOQUEANTES DOCUMENTALES.** Las cuatro correcciones H01–H04 están verificadas por un auditor textual independiente y mutaciones en memoria. **CI oficial no verificado: 3 runs cancelados sin jobs.** No se aprueba ni mergea.

## Cierre de hallazgos

| Hallazgo | Resultado verificable del SHA |
|---|---|
| **PR707-H01** (alto, bloqueante R1) | `docs/tasks/T-433.md:50-67,117-119`: doble verificación independiente de Vercel y GitHub Actions incluso sin rotación, tabla Develop/staging/production, precedencia de secret de environment, sincronización y gate sin 401, constancia sí/no en #666 y bloqueo de promoción. Los jobs reales se contrastaron: `e2e-preview.yml:45` y `e2e-mutation.yml:27` → develop; `e2e-staging.yml:29` y `health-cron.yml:22/43` → staging/production. **Arreglado-verificado documentalmente**; tres mutaciones independientes RED. |
| **PR707-H02** (mejora) | `docs/tasks/T-433.md:36-38` identifica T-203 como origen de `/api/push/send` y reconoce que CC-040 utiliza una server action directa. `docs/tasks/log/T-203.md:16` documenta la ruta. Mutación RED al sustituir T-203 por CC-040. |
| **PR707-H03** (mejora) | `docs/tasks/T-433.md:47-49` exige un secreto por ambiente y fuente CSPRNG/gestor de contraseñas con ≥32 bytes aleatorios; `min(32)` solo controla longitud. Mutación RED si se cambia bytes aleatorios por caracteres repetidos. |
| **PR707-H04** (mejora) | `docs/tasks/T-433.md:44-46` limita el fallo de `serverEnv` a rutas/funciones que acceden al Proxy y activan su validación perezosa. Mutación RED si se vuelve a afirmar que afecta absolutamente todas las rutas. |

**Control independiente RED/GREEN:** a partir de los archivos GitHub del SHA original `cdd9644`, la matriz H01–H04 dio RED/RED/RED/RED. Con `6f5a142c` dio GREEN/GREEN/GREEN/GREEN. Se aplicaron **6 mutaciones propias en memoria** (H01 ×3, H02, H03, H04), todas RED para exactamente su propiedad, y el control sano siguió GREEN. El script íntegro para ejecutar desde `/tmp` con `git show` está agregado en [evidencia/comandos.md](../evidencia/comandos.md). Esto demuestra corrección **documental**, no funcionamiento de los secretos, rutas HTTP o runtime productivo.

## Alcance, bitácora y procedencia

`ec2d54e..6f5a142c`: 1 commit del autor y **2 archivos documentales**: `docs/tasks/T-433.md` (+29/−15) y `docs/tasks/log/T-433.md` (+20/−1). No editó la carpeta `docs/revision-pr/pr-707/`, sin autorrevisión de la revisión. La bitácora confirma H01–H04 y declara 10 archivos/123 tests GREEN. La nota inicial histórica de la bitácora que decía «todas las rutas» queda corregida por su entrada posterior H04, sin reescribir esa historia.

Se hizo una edición **mínima del cuerpo de la PR**, sin nuevo commit ni modificación de código, para actualizar D1-A/D3-A y distinguir el informe propio de agy de esta revisión independiente. No se modificaron contratos, workflows, SQL, secretos, tests ni `src/**`. La ficha T-433 es nueva respecto de develop, no una ampliación oculta de una ficha anterior. Se mantienen **D1-A, D2-A y D3-A**; no hay nuevas 🔵 decisiones.

## CI y límites

- `pnpm exec vitest run tools`: **10 archivos/123 tests**, solo **evidencia del autor en la bitácora**; no se reproduce localmente.
- CI en `cdd9644` (run [43176187220](https://github.com/cadeApp/cadeApp/actions/runs/43176187220)), `ec2d54e` (run [43177935275](https://github.com/cadeApp/cadeApp/actions/runs/43177935275)) y `6f5a142c` (run [43178113665](https://github.com/cadeApp/cadeApp/actions/runs/43178113665)): **cancelled sin jobs**. No se inventan resultados de unit/typecheck/db-tests. `approval-policy` del SHA actual figura SUCCESS, pero no sustituye CI.
- Sin clon local: `git ls-remote https://github.com/cadeApp/cadeApp.git` falló por DNS. No se corrieron `pnpm`, `git merge-tree`, el harness Node desde `/tmp` ni `node docs/revision-pr/analizar.mjs verificacion`. Los JSONL se validaron estructuralmente mediante JS. GitHub reporta `mergeable: true`, que no equivale a un merge-tree ejecutado.
- No se levantaron Docker/Supabase; no se consultaron ni alteraron Vercel, GitHub secrets o deploys. El primer harness de R1 dependía demasiado de frases literales y puede reportar falso RED sobre la corrección; **no se usó para verificar la Ronda 2**. El nuevo control aborda esa debilidad (AG-60).

## Estado y acciones humanas

**Revisión de ficha: cerrada, sin bloqueantes documentales.** **Merge: no realizado ni aprobado.** Si la política del repositorio exige CI exitoso antes de integrar, Lautaro073 debe investigar/reintentar el run cancelado (el revisor no dispara workflows). No exigir otro CI GREEN **solo** por el commit documental que agrega esta ronda.

**SEC-08 sigue abierto** hasta que se implemente en PR separada y se pruebe el bypass real. Antes del merge de la implementación en Develop y de las futuras promociones a staging/main, **solo Lautaro073** debe comprobar ambos secrets efectivos por ambiente, sincronizarlos si hubo rotación, constatar autorización sin 401 y registrar en [#666](https://github.com/cadeApp/cadeApp/issues/666) exclusivamente **sí/no**. Sin esa constancia no se promueve. No es tarea manual necesaria para mergear esta ficha documental.

**Cierre:** commit de revisión solo en `docs/revision-pr/pr-707/` y comentario de la PR. El commit mueve el head: `git pull` antes de continuar, sin rebase, force-push ni amend.
