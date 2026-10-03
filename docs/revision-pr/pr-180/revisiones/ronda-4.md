# Ronda 4 — PR #180 / T-307

**Fecha:** 2026-10-02  
**Base revisada:** `bb2fe2a05a8fb8020b24f1eed581dc8f901e62a3`  
**Resultado:** **SIN NUEVO BLOQUEANTE DE CÓDIGO PROPIO / VERIFICACIÓN E2E T-307 SIGUE BLOQUEADA POR T-327**

## Qué cambió desde Ronda 3

No hubo un nuevo commit del agy. La evidencia nueva proviene del Preview del commit del revisor `bb2fe2a05a8fb8020b24f1eed581dc8f901e62a3` y del avance de `develop`.

## Evidencia remota

- CI `37040809661`: GREEN.
- e2e-preview `37040956911`: RED global.
- Infra: resolve-preview, Supabase Develop y health pasaron.
- Playwright: **8 passed / 1 failed**.
- Único fallo: T-303 Flow 4 / #200.
- `notifications.spec.ts`: **no ejecutado**.

Por lo tanto el rojo global sigue siendo ajeno a T-307 y el spec de T-307 sigue sin evidencia remota.

## PR180-H07 — detectado y corregido por la revisión

El test de Realtime usaba el nombre real del courier como marcador de que la nueva oferta apareció. Eso lo acoplaba a #200, que actualmente hace que el comercio vea `Repartidor` aunque la oferta exista.

La revisión aplicó un fix mínimo:
- la oferta insertada lleva un `message` único basado en `stagingContext.testRunId`;
- se verifica que ese marcador no esté antes del INSERT;
- luego se exige segunda GET + marcador visible + monto visible;
- ya no se exige el display name real del courier.

Este oráculo mide la oferta concreta y no depende de la proyección documental/courier de #200.

## Sincronización

La rama estaba 5 commits detrás de `develop`. Esos commits modifican únicamente los workflows trusted y sus tests. La revisión los integra mediante merge normal, sin rebase.

## Estado

- H01 ✅
- H02 🟡 arreglado-sin-verificar
- H03 ✅
- H04 ✅
- H05 🟡 arreglado-sin-verificar
- H06 🟡 arreglado-sin-verificar
- H07 🟡 arreglado-sin-verificar; fix mínimo aplicado por revisión
- D01 ✅
- T-327/#205 🔴 sigue impidiendo ejecutar `notifications.spec.ts` en el gate trusted

No hay decisiones 🔵 pendientes para Lautaro073.

No aprobar ni mergear PR #180 todavía.
