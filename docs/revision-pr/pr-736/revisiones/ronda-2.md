# Ronda 2 — PR #736 · T-435 / CC-051 — 2026-11-12

**Resultado: CON BLOQUEANTES (1 residual: PR736-H04). H01, H02, H03 y H05 corregidos por inspección y oráculo local, todavía sin verificación E2E del SHA nuevo. Sin decisiones 🔵. No aprobar ni mergear.**

| Campo | Verificado |
|---|---|
| SHA de implementación revisado | `6fa6dd5bbc525ce75884f61940af2a5d26c2e2c2` |
| Base develop | `632a04f585d4f3ed511a04c45b9407cfe95ec00a` |
| Previo revisor R1 | `5a79fb3e99c72ba123244faf2bebf97000e3e66c` |
| PR | https://github.com/cadeApp/cadeApp/pull/736 |
| Rama | `feat/T-435-sec12-realtime-capture` |
| Comparación exacta R1→R2 | 1 commit ahead, 0 behind; 2 archivos: spec (+70/−21) y bitácora (+25). No se tocó `docs/revision-pr/pr-736/**` por el autor |
| Mergeability | GitHub `mergeable=true`; no equivale a ejecutar `git merge-tree` |
| E2E anterior | [43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862) sobre `43726568`, test CC-051 PASS; **no sirve para verificar SHA R2** |
| CI del nuevo SHA al revisar | [43281848548](https://github.com/cadeApp/cadeApp/actions/runs/43281848548), **in_progress**: unit, lint, typecheck, build y bundle-budget completed/success; db-tests in_progress |
| e2e-preview del SHA R2 | **No disponible al momento de la revisión** (en cola). No se atribuye PASS |
| Checks propios | Simulador Node independiente: control intacto GREEN, 8 mutaciones adversas de H01/H02/H03/H05 RED; reproducción de carrera H04: actual pierde 1 canal, propuesta no pierde ninguno. **No es Playwright ni servicio Develop** |

## Preflight

Se conservaron las reglas y el contexto de la ronda previa: `COMO-ENTREGAR.md`, README del catálogo, skill, ficha T-435 **en develop**, CC-051 y CC-023, precedentes AG, y bitácora. Se comprobó por GitHub que `develop` continúa en `632a04f5`; el head de #736 es `6fa6dd5bbc525ce75884f61940af2a5d26c2e2c2` y la base no avanzó. Comentarios: comentario independiente R1 y bot de Vercel; no se detectaron threads de revisión que cambien el alcance. GitHub no muestra intervención del agy en la carpeta `pr-736` desde el commit del revisor. No hay cambios de migración, permisos ni contrato.

No hay clon local: `git ls-remote` informa `Could not resolve host: github.com`; no se corrieron `pnpm`, `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` sobre el repositorio. La bitácora declara typecheck/lint/3961 tests/214 tools+e2e green y una batería local de 8 RED, pero el script del agy no fue entregado: **no se adjudica reproducción de esa batería**. La revisión ejecutó una batería **independiente** reproducible en `evidencia/comandos.md`, distinta de Playwright.

## Estado de H01–H05

| ID | Resultado R2 | Evidencia en el código |
|---|---|---|
| **PR736-H01** | **arreglado-sin-verificar** | Líneas 513–518: al terminar la barrera y 5 s, se audita `captured` completo de A/M, los dos IDs, y se preservan conteos cero A borrador y N |
| **PR736-H02** | **arreglado-sin-verificar** | Líneas 268–271, 330–331 y 368–380: booleanos de igualdad exacta `notesMatchesMarker/amountMatches`, ambas claves y `expectSourcePositive` en los tres cambios S |
| **PR736-H03** | **arreglado-sin-verificar** | Líneas 443–448 y 493–498: N devuelve explícitamente código `42501` y datos null; A borrador debe consultar sin error y recibir [] |
| **PR736-H04** | **PARCIAL · BLOQUEANTE** | Líneas 527–547: reset y retiro de canales con `allSettled` correctos; conservar fallo del cuerpo fue buena elección. **Pero** líneas 306–313 + 385–391 permiten registrar un canal después del teardown si `Promise.all` de altas rechaza pronto |
| **PR736-H05** | **arreglado-sin-verificar** | Líneas 422–434 y 482–487: UPDATE publicado e INSERT borrador usan también `updated_at`, sin volver obligatorio el INSERT opcional de A |

La captura previa 43726568 demuestra la ausencia observada de fuga en su fecha, pero no verifica R2. Un hallazgo queda `arreglado-sin-verificar` hasta correr el control corregido en el SHA pertinente; los 8 RED son simulación de expectativas, no del camino de aplicación.

## Bloqueante residual — PR736-H04 · medio

**Localización:** `e2e/specs/courier-private-columns.spec.ts:306–313, 385–391, 526–548`.

El cuerpo usa:
```ts
await Promise.all([
  subscribe(courierClient, 'A'),
  subscribe(merchantClient, 'M'),
  subscribe(anonClient, 'N'),
  subscribe(admin as unknown as SupabaseClient, 'S'),
]);
```
`subscribe` espera `getSession()` (y potencialmente `realtime.setAuth()`) **antes de** `channels.push`. Si A falla rápido y M todavía no termina `getSession`, `Promise.all` rechaza y el `finally` remueve solo lo que esté en `channels` en ese momento. M puede avanzar luego, crear un canal y quedar fuera de la limpieza. Eso incumple «quitar todos los canales, aunque falle una suscripción» de T-435/CC-051. Se reprodujo **sin API remota** en scheduling controlado: una suscripción falla, otra se libera después de `finally`; resultado actual: `created=1, removed=0, orphaned=1`. Con barrera `Promise.allSettled` antes de `finally`, `created=1, removed=1, orphaned=0`.

**Arreglo exacto:** cambiar **solo la barrera inicial de altas** a `const results = await Promise.allSettled([subscribe(A), subscribe(M), subscribe(N), subscribe(S)])` y **después** inspeccionar si `results.some(r => r.status === 'rejected')`; si hay rechazados, lanzar error de precondición con los identificadores A/M/N/S fallidos (no valores/credenciales). Así se espera la finalización de los cuatro creadores antes de limpiar, y se mantiene el requisito de todos SUBSCRIBED antes de mutar. Conservar `bodyCompleted`, los errores verificados de reset y `Promise.allSettled` de `removeChannel`. No añadir sleeps ni exceptuar casos en CI.

**Batería independiente nueva:** además de la matriz H01-H05 de 8 mutaciones en RED, ejecutar script `evidencia/comandos.md` de R2: control de carrera con fallo temprano → `Promise.all` deja huérfano; `Promise.allSettled` no. El escenario adverso es un error de suscripción, no una fuga demostrada en Develop.

**Decisión sobre la desviación declarada:** conservar el error del cuerpo si falla también la limpieza, y registrar el problema secundario, es técnicamente correcto; no genera hallazgo. Una `AggregateError` alternativa no mejora la trazabilidad tanto como mantener el fallo inicial y registrar cleanup por separado.

## Alcance del CI y condiciones de salida

El DoD exige una captura **real** contra Develop y `e2e-preview` verde sobre la implementación. El run antiguo 43262434862 fue `failure` por fallos externos (onboarding #737, map-privacy:34, T-376 flaky) aunque CC-051 pasó. No hay captura del `6fa6dd5b` nuevo al revisar; está pendiente. El CI general [43281848548](https://github.com/cadeApp/cadeApp/actions/runs/43281848548) sigue en progreso en esta instantánea; no se declara green. Aunque el runner termine, la corrección de la carrera de H04 requerirá **un SHA nuevo**, que debe revisarse en la ronda siguiente. No disparar manualmente workflows.

**Resultado final R2: 1 bloqueante residual (H04), 4 correcciones por inspección pendientes de verificación E2E.** No se aprueba ni mergea. No quedan decisiones 🔵 para Lautaro073; solo el arreglo mínimo de test. El revisor no toca el archivo de implementación. Comentar la ronda y prompt acotado en un único comentario; el commit de documentación moverá el head y exige `git pull`. No exigir CI nuevamente únicamente por ese commit documental.
