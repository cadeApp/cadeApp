# Lecciones de la PR #138 para AGENTS.md y las reglas

**Fuente:** 3 hallazgos de Ronda 2.

## Patrón dominante

Una decisión de arquitectura puede quedar parcialmente sincronizada: corregir la regla temática no alcanza si los contratos raíz y controles automáticos conservan el modelo anterior.

## Lecciones propuestas

### AG-01 · Propagar decisiones operativas a todos los contratos de entrada
**Origen:** H01, H03

Cuando cambia una decisión de ambientes/seguridad, revisar también `AGENTS.md`, onboarding, ficha e issue activo; no solo master plan y regla temática.

> **Regla propuesta.** Toda decisión que cambie cómo se usa un ambiente remoto debe buscar y reconciliar referencias contradictorias en AGENTS, onboarding, reglas, plan, ficha e issue antes de declarar la documentación sincronizada.

### AG-02 · Hacer fallar la sincronía cuando falta la fila
**Origen:** H02

El control de fichas omitía silenciosamente las fichas sin fila.

> **Regla propuesta.** Un verificador de sincronía debe fallar ante ausencia de cualquiera de los dos lados; nunca usar la ausencia como condición para omitir la validación salvo excepciones cerradas y documentadas.

## Qué cambiar, en orden de impacto

1. Endurecer `verify-fichas.test.ts` para exigir fila.
2. Sincronizar contratos raíz con D01.
3. Mantener issues activos libres de referencias muertas.

## Advertencias

- La decisión de compartir `cadeapp-staging` es específica de este proyecto.
- La lección del test sí es generalizable a otros controles de sincronía.
