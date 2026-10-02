# Revisión PR #198 — T-306

- **PR:** #198
- **Rama:** `feat/T-306-subscription-e2e`
- **SHA funcional revisado:** `5ad81b8e13191c4ef9bc2d96339bf8dea30723ea`
- **develop observado:** `ff5c51f7edd003c152f56a2bd2edc0cf2feab698`
- **Ronda actual:** 2
- **Resultado:** SIN BLOQUEANTES
- **Estado:** lista para merge por Lautaro073
- **Divergencia al cierre funcional:** 12 commits ahead / 0 behind

## Decisiones de Lautaro073

1. Renombrar la suite a `e2e/specs/subscription.global-settings.spec.ts`.
2. Ejecutarla en Preview con el proyecto `global-settings` y `--workers=1`.
3. Separar T-328 del alcance de T-306.
4. Elegir opción 1-A: T-329 agrega el gate confiable opcional antes de cerrar T-306.

## Rondas

- [Ronda 1](revisiones/ronda-1.md): 7 bloqueantes.
- [Ronda 2](revisiones/ronda-2.md): H01–H07 cerrados. Baseline GREEN 3/3 y mutación real sin `publish_request` RED en PR temporal #216.
