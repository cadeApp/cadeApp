# Revisión CC-002 — 2026-09-23

Informe revisar-pr — T-103 (prerrequisito CC-002) — 2026-09-23 — generado por Codex para Lautaro073

Resultado: SIN BLOQUEANTES técnicos

Checks locales: typecheck ✅ · lint ✅ · test ✅ · test:db n.a. (no hay cambios en supabase/ ni src/server/)

## Alcance

La ficha de T-103 de origin/develop no permite cambios de dominio. Este PR es el contract-change previo, autorizado explícitamente en la sesión por Lautaro073, con su propio alcance en docs/contracts/CC-002.md. T-103 sigue separada en PR #63. Su ficha se amplía únicamente con requests.test.ts y los tipos generados localmente.

## BLOQUEANTES

Ninguno técnico encontrado en los cambios. La decisión final sobre el comportamiento visible y el merge de CC-002 siguen pendientes; este informe no los aprueba.

## MEJORAS

La revisión independiente sugirió proteger que merchant/admin pueden reportar incidentes sin registro courier. Resuelto: ambos casos tienen pruebas positivas y fallaron con una mutación que imponía la guarda courier a todos los actores. Mutación revertida.

## No revisado / dudas para Lautaro073

- Este PR todavía no implementa RPC en Postgres ni el wrapper requests.ts; su DoD se verifica en T-103 después del merge.
- Revisión estática independiente por agente review_cc002 sobre el diff de dominio y luego el diff final/documentación: sin hallazgos abiertos. Los checks locales fueron ejecutados por el agente principal.
- Pendiente validación humana del comportamiento visible del contrato conforme a contract-change. No se registra aprobación P1/P2 en nombre de otras personas.
- Los warnings existentes de React act y Motion en ui-system.test.ts no se modificaron. No fallaron la suite.

## Evidencia ejecutada

Primero, solo pruebas nuevas y sin implementación:

```text
pnpm exec vitest run src/domain/domain.test.ts -t 'CC-002' --reporter=dot
Test Files  1 failed (1)
Tests       23 failed | 3 passed | 18 skipped (44)
```

Los skipped corresponden al filtro de ejecución, no a .skip en código. Los fallos demostraron 14 códigos ausentes y 9 operaciones indebidamente aceptadas. Los 3 casos positivos se demostraron fallando al rechazar también approved. Los 2 casos merchant/admin posteriores se demostraron fallando al exigir registro courier a esos actores. Todas las mutaciones fueron restauradas.

La primera ejecución simultánea de checks no es evidencia verde: typecheck pasó; lint detectó el probe inválido temporal de verify-build-boundaries; test tuvo timeout de 5 s en verify-scaffold (186 pasan, 1 falla). Se verificó que la prueba elimina el probe en finally y se ejecutó una única verificación completa en secuencia para eliminar la interferencia, sin cambiar timeouts ni tests:

```text
pnpm typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json
exit 0

pnpm lint
✔ No ESLint warnings or errors
exit 0

pnpm test
Test Files  18 passed (18)
Tests       189 passed (189)
Workflow tests: 19 passed, 0 failed
ADR tests: 6 passed, 0 failed
exit 0

pnpm exec vitest run src/domain/domain.test.ts --coverage --coverage.include=src/domain/**/*.ts
Tests       46 passed (46)
Dominio:    97.44% líneas, 92.30% ramas, 100% funciones
rpc-fake:   95.18% líneas, 90.36% ramas, 100% funciones
exit 0 (umbrales de cobertura intactos)
```

`git diff --check` sin errores. Sin nuevas dependencias, sin secretos, sin cambios de políticas ni migraciones.
