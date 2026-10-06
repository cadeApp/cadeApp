# Lecciones de la PR #273 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

La solución funcional de T-342 está cubierta por pruebas y no mostró un defecto técnico nuevo en esta ronda. Los dos bloqueos son de proceso: una ampliación de alcance se hizo dentro de la misma PR que la consume y la autorrevisión no se pegó en el formato contractual del workflow.

## Lecciones propuestas

### AG-01 · Validar el alcance contra la ficha del base, no contra la rama
**Origen:** PR273-A01

La regla ya existe en `AGENTS.md` y en `revisar-pr`, pero el control automático de fichas puede quedar satisfecho por una ficha autoampliada en la misma rama.

> **Regla propuesta.** En toda revisión de alcance, la fuente de «Archivos permitidos» es `origin/develop:docs/tasks/T-xxx.md`. Un cambio a esa misma ficha dentro de la PR no concede permisos a otros archivos del diff.

Más que agregar nueva prosa raíz, conviene reforzar el control automático para comparar el diff contra la ficha del base.

### AG-02 · Mantener el cuerpo de PR como contrato machine-readable
**Origen:** PR273-H02

Acá el control sí funcionó: `approval-policy` quedó rojo porque la autorrevisión fue resumida y perdió los marcadores que parsea el workflow.

> **Regla propuesta.** El informe de `revisar-pr` se pega completo y sin renombrar su sección; los resúmenes adicionales son opcionales, pero no lo reemplazan.

## Qué cambiar, en orden de impacto

1. Evaluar que `verify-fichas` o un check equivalente compare los archivos modificados contra la ficha del **base commit**, no contra una ficha modificada por la propia PR.
2. Mantener `approval-policy` como está: detectó H02 correctamente.
3. No agregar una excepción específica para T-342; resolver la ampliación mediante `develop` y rebase.

## Advertencias

- T-342 es un hotfix de privacidad y el cambio funcional sí reduce exposición en UI/payloads; los hallazgos de esta ronda no cuestionan esa corrección.
- El riesgo directo por API sigue abierto por CC-023 y no debe confundirse con un defecto introducido por esta PR.
