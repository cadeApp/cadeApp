# Lecciones de la PR #273 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos de ronda 1; en ronda 2 uno quedó `aceptado` por decisión explícita y uno `arreglado-verificado`.

## Patrón dominante

No apareció un defecto funcional nuevo en T-342. El único hallazgo corregible fue el formato del body que consume `approval-policy`.

PR273-A01 no se usa como evidencia para endurecer reglas: Lautaro073 confirmó directamente que había aprobado la ampliación de alcance dentro de esta PR.

## Lección propuesta

### AG-02 · Mantener el cuerpo de PR como contrato machine-readable
**Origen:** PR273-H02

`approval-policy` quedó rojo porque la autorrevisión fue resumida y perdió los marcadores que parsea el workflow. Al restaurar el formato exacto, el run 37403363705 pasó.

> **Regla propuesta.** El informe de `revisar-pr` se pega completo y sin renombrar su sección; un resumen adicional no lo reemplaza.

## Qué cambiar, en orden de impacto

1. Mantener `approval-policy` como está: detectó correctamente H02.
2. Evitar resumir bloques que son contratos machine-readable.
3. No crear una regla nueva a partir de PR273-A01: fue una decisión explícita del responsable, no una reincidencia técnica.

## Advertencias

- T-342 es un hotfix de privacidad y el cambio funcional reduce exposición en UI/payloads.
- El riesgo directo por API sigue abierto por CC-023 y no debe confundirse con un defecto de esta PR.
