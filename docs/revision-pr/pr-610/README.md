# PR #610 — T-422 · Revisión independiente

- **PR:** https://github.com/cadeApp/cadeApp/pull/610
- **Rama:** `feat/T-422-e2e-runner-build`
- **SHA inicial de R1:** `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9`; **SHA verificado R2:** `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`.
- **Rondas:** R1 2026-11-04 · R2 2026-11-04 (ART).
- **Resultado R2:** SIN BLOQUEANTES (tres hallazgos anteriores verificados); paso operativo postmerge pendiente. No aprobada ni mergeada.
- **PR original:** Draft. La carpeta `pr-610` no existía al iniciar; se crea exclusivamente desde la revisión.

## Índice

- `revisiones/ronda-1.md`: hechos, hallazgos, decisiones y alcance (inalterado).
- `revisiones/ronda-2.md`: cierre de H01-H03, mutaciones independientes, chequeos CI y límite postmerge.
- `hallazgos.jsonl`: tres hallazgos originales, marcados `arreglado-verificado` en R2.
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

**Ronda 2 (2026-11-04 ART):** revisado HEAD `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7`. **SIN BLOQUEANTES**: H01, H02 y H03 `arreglado-verificado` por control independiente sobre este SHA (27/27 expectativas), CI 41950852316 verde (7/7 jobs; Vitest 3532; workflow 82; ADR 6; DB 3396). El gate nuevo `workflow_run` no corre de verdad antes del merge: primer E2E GREEN y corte Vercel solo-develop son pasos posteriores obligatorios. No se aprobó ni mergeó.
