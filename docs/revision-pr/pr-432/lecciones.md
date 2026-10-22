# Lecciones — PR #432 / T-375

**Fuente:** 0 bloqueantes y 1 decisión técnica aceptada (PR432-H01). Ver hallazgos.jsonl.

## Qué funcionó

La restauración ya no depende exclusivamente del finally de la prueba que puede quedar interrumpida. La precondición de inicio no convierte silenciosamente un Develop contaminado en un supuesto estado original legítimo. La responsabilidad de restaurar se registra antes de la escritura, incluso si una respuesta falla después de aplicar el cambio. El CI ejecutó 6/6 E2E global-settings.

## Riesgo separado, sin generar una regla global prematura

Un almacén simulado permite que un false en vuelo se aplique después de un restore verificado; esto **no demuestra** el mismo comportamiento en PostgREST/Supabase. La investigación está en el issue #433, sin generar una lección AG nueva ni una exigencia de rediseño de T-375.

## Disciplina de evidencia

- Bitácora del autor: RED/GREEN Playwright temporal descrito, no guardado.
- Revisión independiente: lógica del helper exacto ejecutada con 9 escenarios y 3 mutaciones que el harness demuestra que son detectadas; script completo reproducible en evidencia/comandos.md.
- CI: Chromium 91/91 y global-settings 6/6 sin timeout forzado.
- No equiparar el CI verde con reproducción independiente del RED por timeout real.

No se propone editar AGENTS.md por un único riesgo cuya manifestación real todavía no se verificó.
