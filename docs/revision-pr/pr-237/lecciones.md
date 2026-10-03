# Lecciones de la PR #237 para AGENTS.md y las reglas

**Fuente:** 3 hallazgos de Ronda 1.

## Patrón dominante

No falta una regla nueva. Los huecos ya estaban nombrados: H01 es AG-37/P06 (enumerar la clase completa), H02 es P13 + directiva visual y H03 es un DoD visual explícito tratado como trabajo posterior.

## Sin AG nueva

- H01: un handler genérico para dos documentos y dos etapas fallables requiere license|insurance × compress|upload e incluir estado previo exitoso.
- H02: label asociado y target de 48 px no sustituyen foco visible.
- H03: una tarea visual no está lista para cierre si falta navegador real y 390/360.

Agregar otra regla duplicaría normas existentes; corresponde ejercerlas en tests y cierre de sesión.

## Advertencias

H01/H02 son análisis estático en esta ronda. La mutación independiente del revisor queda para el SHA corregido. H03 no autoriza Docker, Supabase local, secretos ni cambios de workflow.
