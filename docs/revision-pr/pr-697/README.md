# Revisión independiente — PR #697 / T-432 / CC-049

**PR:** https://github.com/cadeApp/cadeApp/pull/697  
**Rama:** `feat/T-432-sec07-push-hardening`  
**Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`  
**Fecha de revisión:** 2026-11-12

## Estado actual — Ronda 3

**CON BLOQUEANTES (1).** H02 permanece **parcial**: el control de preservación en primera aplicación compara seis columnas, pero omite las dos columnas temporales reales de `push_subscriptions` (`created_at` y `last_seen_at`). Una migración que las altere conserva el test verde. H05 quedó **corregido y verificado** con tabla E01–E19; M02 corregida. H01, H03 y H04 siguen cerrados **solo documentalmente**. Sin decisiones pendientes.

- [Informe Ronda 3](revisiones/ronda-3.md) — SHA revisado `1052fbed3150c0589835c50b446791a4eaa3ab4f`.
- [Ronda 2](revisiones/ronda-2.md) — SHA `3406672db6e88c04c6603d8815b8ec81556dcbd8`.
- [Ronda 1](revisiones/ronda-1.md) — SHA `b9f0bb12f480ce2c95afa42fee6031021611be2b`.
- [Hallazgos JSONL](hallazgos.jsonl) · [Evidencia y arnés](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Alcance y evidencias

Esta PR **solo documenta** CC-049 y T-432; la migración y código quedan para una PR posterior, de modo que ningún RED/GREEN SQL de CC-049 se ejecutó aquí. `develop` se mantuvo en `9dafedab`. El delta desde el commit de revisión R2 cambió únicamente `docs/contracts/CC-049.md`, `docs/tasks/T-432.md` y `docs/tasks/log/T-432.md`; no hubo alteraciones de autor en la carpeta de revisión.

**CI del SHA de contenido `1052fbed`:** build, typecheck, lint, unit, audit y bundle-budget en `success`; log unit: 202 archivos y 3775 tests pasados. `db-tests` estaba **en progreso** al cierre de la inspección: no certificarlo ni exigir un nuevo CI green solo por este commit documental de revisión. El dato de 123/123 de `pnpm exec vitest run tools` procede del autor y no se reprodujo por separado.

Se ejecutaron dos sondas independientes **solo en Node** (matriz y mutación de timestamps), sin Supabase, Docker ni E2E. La evidencia de pgTAP y del transporte pertenece a la PR posterior.

**Decisiones cerradas:** D1-A, D2-A, D3 5000 ms, D4-B y D5-C. **Ninguna nueva**.

El comentario de cierre de ronda 3 tiene el prompt preciso para agy. No aprobar ni mergear todavía.
