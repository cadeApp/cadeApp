# Revisión independiente PR #322 — T-352 — Ronda 1

**Fecha:** 2026-10-13. **HEAD analizado:** bfc6ce5eabcb536e654a2ad0946ca9c2281cbf56. Base: 0ab96d941854341c75e801c1a326d1e585c87d9d.

## Dictamen: SIN BLOQUEANTES

Esta PR únicamente agrega docs/tasks/T-352.md, docs/tasks/log/T-352.md y una fila en docs/implementation-plan.md. No modifica aplicación, auth, middleware, RLS, migraciones, dependencias, pruebas ni workflows. La ficha implementa la elección de Lautaro073 de separar la optimización de T-340, preserva el alias /merchant/requests, exige mediciones pre/post y deja prohibido subir el timeout de E2E o cambiar los guardias sin autorización.

**Contraste de código real:** src/features/requests/actions.ts devuelve actualmente redirectTo '/merchant/requests'; create-request-form.tsx usa router.push(result.data.redirectTo); el alias /merchant/requests solo llama redirect('/merchant/dashboard'). Hay una navegación intermedia verificable por código. **La cantidad de consultas y el ahorro de tiempo todavía deben medirse, no están certificados por esta ronda.** src/features/requests/actions.test.ts tiene DOS expectativas a actualizar: aprox. líneas 282 y 519. La primera línea del DoD y la fila del plan coinciden literalmente. Se comprobaron permisos internos de archivos, dependencia T-340 #318 y coherencia con issue #321.

### MEJORAS (no bloqueantes)

**PR322-H01 — Meta de rendimiento vs hipótesis:** docs/tasks/T-352.md, pasos 2–4 y DoD. El paso 2 dice «si la medición confirma», pero el paso 3 y el DoD exigen una cadena auth → perfil → comercio menos. Mantener la métrica como objetivo, no como hecho garantizado: medir por separado navegación (ruta/redirect), conteo/costo de consultas y tiempo clic→URL final, en varios intentos equivalentes. Si no baja la cadena real, registrarlo como dato y decidir una nueva mejora autorizada; nunca escribir un GREEN supuesto ni cambiar el timeout. Esta precisión puede añadirse al implementar la ficha o en una corrección documental previa, sin bloquear el alta.

**PR322-H02 — Fuente de auth omitida en «Contratos a leer»:** docs/tasks/T-352.md:10 y 49–52. La función updateSession y las consultas getUser, profiles y merchants viven en src/features/auth/server.ts; src/features/auth/guards.ts es el evaluador de guard puro. El layout src/app/(merchant)/layout.tsx no hace esas lecturas. Agregar src/features/auth/server.ts y src/app/(merchant)/merchant/dashboard/page.tsx como fuentes de **solo lectura** y no atribuirle una triple cadena al layout sin demostrarlo. No autoriza cambios a seguridad.

### BLOQUEANTES

Ninguno.

### Checks y evidencia

- [GitHub CI para el SHA analizado](https://github.com/cadeApp/cadeApp/actions/runs/38343365354): unit 129 suites / 2116 tests PASS; db-tests 21 suites / 1995 tests PASS; lint, typecheck, build, audit y bundle-budget SUCCESS. approval-policy seguía FAIL porque faltaba el informe independiente en el cuerpo de la PR, no por una falla técnica. Vercel es status externo separado.
- El autor dice haber ejecutado pnpm vitest run tools/verify-fichas.test.ts 7/7; **no se reprodujo localmente** en esta sesión. La revisión inspeccionó directamente la equivalencia de ficha, plan y paths.
- El [run E2E 38340200745](https://github.com/cadeApp/cadeApp/actions/runs/38340200745) es la base histórica que motivó la tarea, **no** ejecución E2E de T-352. NO se afirma mejora de latencia ni RED→GREEN de T-352.

### No revisado / dudas para Lautaro073

No hay decisiones de producto abiertas: la separación de PR ya fue elegida. No se reejecutó Playwright, Supabase Develop ni SQL; sin secretos ni Docker locales. No se hizo merge, aprobación ni cambios de aplicación.

**Autorización para merge corresponde solo a Lautaro073.**
