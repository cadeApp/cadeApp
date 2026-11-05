# PR #610 — T-422 · Revisión independiente

- **PR:** https://github.com/cadeApp/cadeApp/pull/610
- **Rama:** `feat/T-422-e2e-runner-build`
- **SHA revisado:** `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9` · base `develop`: `7d07fdf80d94bce49580ec84cc39722b5bff4756`.
- **Ronda 1:** 2026-11-04 (Argentina, UTC−3).
- **Resultado:** CON BLOQUEANTES (2) y MEJORA A IMPLEMENTAR (1). No aprobada ni mergeada.
- **PR original:** Draft. La carpeta `pr-610` no existía al iniciar; se crea exclusivamente desde la revisión.

## Índice

- `revisiones/ronda-1.md`: hechos, hallazgos, decisiones y alcance.
- `hallazgos.jsonl`: tres hallazgos estructurados.
- `lecciones.md`: patrones sin asignar un AG nuevo innecesario.
- `evidencia/comandos.md`: reproducción y transcripción del harness independiente.
- `evidencia/mutaciones-pr610.mjs`: script ejecutable desde un clon del SHA.

## Decisiones P1 confirmadas antes del cierre

- **D01=B:** excepción explícita para que `docs/tasks/T-422.md` nazca en esta PR y no en develop; aceptada, no se exige PR aparte.
- **D02=B:** separar `pnpm build` de los secretos privilegiados.
- **D03=B:** ampliar la cola compartida a `queue: max`; debe cubrir tanto `e2e-preview` como `e2e-mutation`, y actualizar su documentación y control.

La D03 autoriza la **excepción concreta de alcance** para el cambio mínimo de `.github/workflows/e2e-mutation.yml` y sus tests de concurrencia. No autoriza refactors ni tocar los specs E2E.

## Evidencia disponible

CI SHA `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9` · run `41945869055`: `build`, `typecheck`, `lint`, `unit`, `db-tests`, `audit` y `bundle-budget` SUCCESS. En unit: 192 archivos de Vitest PASS; 80/80 workflows y 6/6 ADR. En db-tests: `Files=42, Tests=3396, Result: PASS`; mutaciones del job verificadas. La corrida corresponde al SHA revisado.

El nuevo `workflow_run` solo puede ejecutarse realmente una vez mergeado el workflow a `develop`. Este CI no prueba el nuevo E2E; se documenta como límite.
