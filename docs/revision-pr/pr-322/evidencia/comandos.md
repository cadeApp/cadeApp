# Evidencia de PR #322 · ronda 1

SHA auditado: bfc6ce5eabcb536e654a2ad0946ca9c2281cbf56; base: 0ab96d941854341c75e801c1a326d1e585c87d9d.

## Fuente remota verificada

1. API de GitHub PR #322: 3 archivos, docs/implementation-plan.md, docs/tasks/T-352.md, docs/tasks/log/T-352.md; sin código.
2. Comparación de primera casilla DoD con la fila T-352 del plan: idénticas.
3. src/features/requests/actions.ts: redirectTo '/merchant/requests'. src/features/requests/components/create-request-form.tsx: router.push(result.data.redirectTo). src/app/(merchant)/merchant/requests/page.tsx: redirect('/merchant/dashboard').
4. src/features/requests/actions.test.ts: destino antiguo tanto en toBe('/merchant/requests') como en un objeto toEqual({data:{requestId,redirectTo}}), en torno a las líneas 282 y 519.
5. src/features/auth/server.ts: updateSession sí invoca auth.getUser y consultas profiles/merchants. src/features/auth/guards.ts evalúa el guard; src/app/(merchant)/layout.tsx no lee auth.

CI GitHub: https://github.com/cadeApp/cadeApp/actions/runs/38343365354
- Unit: 129/129 suites, 2116/2116 tests PASS.
- DB: 21 suites, 1995 tests PASS; tipos locales verificados.
- Typecheck, lint, build, audit, bundle-budget PASS.
- approval-policy: rojo antes de informe.
- E2E histórico: https://github.com/cadeApp/cadeApp/actions/runs/38340200745; NO pertenece a la implementación futura de T-352.

## Comandos para repetir en checkout del SHA (no ejecutados en esta sesión)

    git diff origin/develop...origin/docs/T-352-ficha --stat
    pnpm vitest run tools/verify-fichas.test.ts

En la PR posterior de T-352:

    pnpm vitest run src/features/requests/actions.test.ts
    pnpm typecheck && pnpm lint && pnpm test

Prueba RED en esa PR: escribir primero el assert exacto redirectTo '/merchant/dashboard', demostrar que la implementación antigua falla; cambiar solo el destino de éxito y comprobar GREEN. Mutación independiente después: restaurar temporalmente el destino viejo, obtener RED real, restaurar sin commit. Medir con Playwright/observabilidad autorizadas para Develop, sin filtrar secretos ni PII; respetar el timeout original de 10 s.
