# Informe de revisión — PR #138 / T-317 — Ronda 2

**Head SHA revisado:** `f280bc918d3203cc29a2381c68da82611154112f`  
**Base:** `develop` @ `a7f9b172d7988fdec7865d6327f4b7f95b10e06e`  
**Fecha:** 2026-09-30

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alta | `AGENTS.md`, `docs/onboarding.md` | D01 / 1-B sigue contradicha por contratos raíz | contrato |
| H02 | alta | `docs/implementation-plan.md`, `tools/verify-fichas.test.ts` | T-317 no tiene fila y el control la omite silenciosamente | P08 |
| H03 | media | Issue #137 | referencia `verifyMfaAction` inexistente | P14 |

## H01 · D01 incompleta en contratos raíz

**Estado:** [ANÁLISIS]

### Diagnóstico

La regla temática ya permite el flujo acotado contra `cadeapp-staging`, pero `AGENTS.md §6` todavía prohíbe cualquier comando contra Supabase remoto y `docs/onboarding.md` afirma que no hay credenciales de staging en la máquina. Un agente que siga el contrato raíz debe frenar T-317.

### Arreglo

Distinguir llamadas de aplicación explícitamente autorizadas de operaciones/credenciales privilegiadas. Mantener prohibidos service-role, DB credentials, tokens de infraestructura y comandos administrativos remotos.

## H02 · T-317 ausente del plan; control P08

**Estado:** [VERIFICADO POR LECTURA DE CONTROL]

### Diagnóstico

La tabla de Fase 3 no contiene T-317. `verify-fichas.test.ts` obtiene `dodDelPlan.get(f.id)` y hace `if (!esperado) continue`, por lo que una ficha completamente ausente del plan pasa verde.

### Arreglo

Agregar primero un test que exija fila para toda ficha no exceptuada y demostrar RED natural con T-317. Luego agregar la fila T-317 y obtener GREEN.

## H03 · Issue #137 con referencia muerta

**Estado:** [ANÁLISIS]

El issue activo todavía nombra `verifyMfaAction`; el símbolo real es `verifyAdminMfaAction`.

## CI

El workflow `CI` run #629 para `f280bc9` concluyó `success`. Los bloqueantes son de contratos/planificación, no de CI.

## Nota de proceso

PR #139 ya contiene implementación aunque la ficha aún no está en `develop`. No bloquea #138, pero #139 debe esperar a que #138 se mergee y luego rebasarse sobre `develop`.
