# Ronda 2 — revisión independiente PR #359 / T-360
Fecha: 2026-10-15. **SHA revisado:** `bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5`. **Resultado: CON BLOQUEANTES (4), NO MERGEAR.**

Se leyó ficha desde develop, bitácora, cambios implementados y tests. La consulta de trips comprueba sesión, estados matched/in_transit, oferta del courier y accepted_offer_id; la UI está en posición indicada y respeta disponibilidad OFF por inspección. No se detectaron archivos fuera de globs permitidos. Agy no modificó docs/revision-pr.

## Hallazgos (inspección estática, NO RED independiente ejecutado)
**PR359-H03 (alto, P08)** — `src/features/offers/hooks/use-active-trips.test.tsx`: test de refetch ejecuta `queryClient.invalidateQueries` de forma manual; el otro solo inspecciona suscripciones. No prueba evento Supabase → callback → invalidación → refetch. Arreglo y mutación concreta en prompt.
**PR359-H04 (alto, P15)** — `e2e/specs/main-flow.spec.ts`: E2E T-360 escrito pero declarado PENDIENTE de ejecutar; carece de oráculo de orden DOM y prueba de convergencia sin page.goto; seleccionar oferta .first no demuestra actor. Requiere Preview+Supabase Develop y URL del run.
**PR359-H05 (medio, P08)** — `src/features/trips/queries.ts`: el lookup de delivery_request_drops ignora error y confunde fallo con destino faltante. Manejar fallo sanitizado y tests.
**PR359-H06 (medio, P05)** — `src/features/offers/components/active-trip-card.tsx`: monto mostrado en multi-drop sin 'por entrega', pese a que contrato de cotización lo toma por entrega. Etiqueta y test.

## Estado anterior
PR359-H01: código implementado, sin ejecutar verificación independiente = arreglado-sin-verificar.
PR359-H02: tests nuevos presentes, pero E2E falta y RED/GREEN no reproducido = parcial.

## Checks reales GitHub para SHA `bfbd9e5eb0ef7697ea351708f5c2b6163f174cc5`
- unit, typecheck, lint, build, audit, bundle-budget: SUCCESS (GitHub Actions).
- db-tests SUCCESS: final de log `All tests successful. Files=22, Tests=2205, Result: PASS`. Los fallos intermedios del job se deben a mutaciones SQL esperadas y restauradas.
- approval-policy FAIL: `Falta el informe completo de revisar-pr sin bloqueantes.`. No corresponde ocultarlo ni forzarlo mientras haya hallazgos.
- Vercel Preview READY; E2E específico T-360 aún sin ejecución documentada.
- Sin clon ejecutable con red en esta sesión. Vitest, mutaciones propias y reproducción M1–M8 NO EJECUTADOS por el revisor: los cuatro hallazgos son ANÁLISIS, no VERIFICADO-RUNTIME.

## Decisiones
Se mantienen 1-A/2-A/3-A/4-A, ninguna adicional. Detalle exacto de archivos, tests, mocks, mutaciones, comandos y prohibiciones en el ÚNICO comentario de cierre de ronda 2.

## No tocar
Sin cambios de contratos/RPC/RLS/tipos/CI, sin tests adulterados, ni modificación de carpeta de revisión por el autor. Ronda 3 obligatoria sobre nuevo SHA.