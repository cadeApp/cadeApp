# Lecciones — PR #611 · T-422

**Ronda 1, 2026-11-05: ninguna lección AG nueva.** No se detectó un defecto accionable en el diff documental.

## Observaciones que quedan registradas

- **Atribución correcta de `workflow_run`:** la corrida de GitHub Actions aparece asociada a un SHA de `develop`, pero el checkout efectivo y el estado publicado identifican el SHA de la PR probado. Validar el `checkout` real y no inferir el target por el encabezado del run.
- **Afirmación operacional ≠ verificación independiente:** el comando de Ignored Build Step y su confirmación de guardado están en la bitácora; el deployment omitido de la rama `docs/` refuerza una parte, no demuestra toda la política. La decisión D01=A acepta ese límite sin falsear el nivel de evidencia.
- **Ronda de documentación ≠ reejecución funcional:** 6 mutaciones de datos de bitácora detectadas por control propio, contrastadas con logs públicos. No interpretarlas como 6 mutaciones del workflow ni del producto.
- **Pendientes de otra tarea:** el banner conserva ocultación optimista antes de persistencia. La issue #614 se reabrió tras el cierre automático; exige su propia corrección y revisión, sin arrastrar T-414 dentro de la #611.

No se recomienda cambiar `AGENTS.md` ni las reglas por un solo cierre documental sin nuevos hallazgos. La próxima ronda solo se abre si cambia el SHA de código relevante, aparecen evidencias contradictorias o hay nuevos cambios materiales en esta PR.
