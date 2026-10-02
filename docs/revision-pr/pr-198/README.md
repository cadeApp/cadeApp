# Revisión PR #198 — T-306

- **PR:** #198
- **Rama:** `feat/T-306-subscription-e2e`
- **SHA revisado:** `97314707933b07657a9b64ed8a305643c5d4157a`
- **develop observado:** `6577d9e427c5efc0a79a2c374f0f74d847732f4d`
- **Ronda actual:** 1
- **Resultado:** CON BLOQUEANTES
- **Estado del PR al revisar:** Draft
- **Bloqueo externo abierto por la revisión:** #209
- **Divergencia observada:** la rama estaba 38 commits detrás de `develop`

## Decisiones de Lautaro073

1. Renombrar la suite a `e2e/specs/subscription.global-settings.spec.ts`.
2. Incorporarla al gate `e2e-preview` usando el proyecto `global-settings` y `--workers=1`.
3. No corregir el defecto productivo dentro de T-306: issue #209 separado y bloqueante.

## Rondas

- [Ronda 1](revisiones/ronda-1.md): 7 bloqueantes. No se evaluó CI general porque la ronda quedó bloqueada en revisión estática; la evidencia del propio autor tampoco contiene una ejecución Playwright de T-306.
