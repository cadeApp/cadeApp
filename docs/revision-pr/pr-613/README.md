# PR #613 — T-422 · Timeout del gate y espera de cierre de novedad

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/613 |
| Tarea | T-422 · issue #608 |
| Autor | @Lautaro073 |
| Rama | `fix/T-422-e2e-timeout-dismiss` → `develop` |
| Head revisado | `95f95eedda08ab5b1bb04d289e100ed7649a2b8a` |
| Base | `fb08ab5f7ee76bf3d1dab6703ec659aafe330d90` |
| Tamaño | 5 archivos, +40/-2 |
| Estado R1 | **SIN BLOQUEANTES** · pendiente de merge a criterio de Lautaro073 |

## Rondas

| Ronda | SHA revisado | Hallazgos bloqueantes | Informe |
|---|---|---|---|
| 1 | `95f95eedda08ab5b1bb04d289e100ed7649a2b8a` | 0 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Decisiones
- **D01=A, Lautaro073 (2026-11-05):** no modificar el producto desde T-422. La persistencia optimista del banner es un problema preexistente de T-414: seguimiento en [#614](https://github.com/cadeApp/cadeApp/issues/614), con tarea y tests separados.
- Se acepta la ampliación de ficha ya consignada por el autor para incluir exclusivamente la espera en `e2e/specs/announcements.spec.ts`, sin tocar `src/**`.

## Comprobación de R1
- E2E [run 42075421860](https://github.com/cadeApp/cadeApp/actions/runs/42075421860): checkout exacto del SHA revisado, 116/116 Chromium (32,6 min) y 6/6 global-settings (2,5 min), 37 min de job; `announcements.spec.ts:67` pasó al primer intento.
- CI [run 42073826935](https://github.com/cadeApp/cadeApp/actions/runs/42073826935): unit 193 archivos / 3568 tests, workflows 85/85, db-tests `Files=42 Tests=3396 Result: PASS`, typecheck, lint, build y bundle-budget verde.
- [evidencia/comandos.md](evidencia/comandos.md): controles de inspección y batería independiente de mutaciones sobre copias en memoria; el harness fue probado en un fixture aislado y **no se ha ejecutado contra un clon local del SHA** por falta de acceso a GitHub desde el contenedor.
- [hallazgos.jsonl](hallazgos.jsonl) vacío: ningún hallazgo propio y accionable dentro de T-422 en esta ronda.

## Seguimiento
- El cambio documental de esta revisión mueve el head: para continuar, `git pull` sin rebase/force/amend. El `verificado_en_sha` nunca se traslada al commit documental.
- No interpretar un CI disparado solo por el commit documental como un nuevo requisito para repetir el E2E.
- El estado Vercel de esta rama muestra failure y `approval-policy` había fallado por la ausencia del informe antes de publicarlo; son señales separadas del gate `e2e-preview` que está en success. Verificar los checks exigidos por la protección de rama antes de mergear.
- Después del primer gate nuevo GREEN ya verificado, corresponde aplicar manualmente el **Ignored Build Step de Vercel para construir solo `develop`**, conforme al runbook T-422. No se cambió configuración de Vercel desde esta revisión.
- [lecciones.md](lecciones.md): sin lección AG nueva.

## Análisis posterior
Distinguir sincronización del test de persistencia de producción. Issue #614 fuera del alcance de esta revisión.
