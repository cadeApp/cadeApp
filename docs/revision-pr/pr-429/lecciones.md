# Lecciones de la PR #429

**Fuente:** dos hallazgos documentales, ambos cerrados en ronda 2. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Una ficha nueva no está completa solo por describir correctamente el cambio funcional: también debe autorizar la ruta genérica de revisión y mantener sincronizado el primer DoD con la fila del plan.

## Qué cambiar, en orden de impacto

1. No se propone cambiar `AGENTS.md`: `tools/verify-fichas.test.ts` detectó ambos defectos en CI y luego comprobó sus correcciones.
2. Ejecutar el verificador dirigido antes de publicar una ficha nueva evita una ronda remota innecesaria.
3. Mantener la separación de autoría: el autor corrige la ficha; el revisor independiente escribe y certifica `docs/revision-pr/pr-429/**`.

## Advertencias

- Es una PR documental de regularización; no demuestra todavía el timeout de #427 ni su guard RED/GREEN.
- Cerrar esta revisión no autoriza mergear #427 ni promover staging.
