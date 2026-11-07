# Lecciones de PR #654 — T-428

**Hallazgos propios:** 0 (archivo `hallazgos.jsonl` vacío). No se propone regla nueva en `AGENTS.md` a partir de un único hotfix.

## Evidencia de proceso

1. **Fixture y contrato evolucionan juntos:** CC-042 volvió vehiculares las licencias y seguros. Una fixture que siembra `license` sin `vehicle_id` deja de representar un documento visible del vehículo activo. El cambio mínimo recupera la propiedad sin debilitar la aserción.
2. **Separar gate de test objetivo:** el gate trusted terminó success y el test `courier-onboarding.spec.ts:1056` pasó sin retry, pero otro test (T-407) requirió dos retries. Registrar ambos hechos, no convertir un `flaky` externo en defecto de T-428 ni en `todo pasó a la primera`.
3. **Identificar tarea por fuente verificable:** #636 corresponde a QA/T-407; T-426/#649 es notificaciones. El número de tarea no se deduce de una mención cruzada.
4. **Evidencia y SHA exactos:** el `head_sha` del evento `workflow_run` no equivale al checkout del PR; la prueba real se identifica con el `ref` de `actions/checkout` y el status publicado sobre el SHA de implementación.
5. **No confundir controles:** `approval-policy` lee el cuerpo de la PR, no los comentarios; un informe en comentario por sí solo no lo hace pasar.

## Seguimiento

- No tocar tests de auditoría desde T-428; su tratamiento pertenece al alcance de T-407/#636 aunque la issue figure cerrada.
- Tras el merge **manual** de #654, mergear `develop` en #647 y ejecutar su gate sobre el nuevo SHA; no rebase.
- No afirmar mutaciones o pruebas locales que esta revisión no ejecutó.
