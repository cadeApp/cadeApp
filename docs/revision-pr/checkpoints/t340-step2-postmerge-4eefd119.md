# Checkpoint técnico posmerge — T-340 Paso 2

> REVIEW ONLY / NEVER MERGE. Archivo marcador exclusivo para disparar un Vercel Preview desde una PR temporal. No cambia código de producto, fixtures, migraciones, datos, tests ni workflows.

- **Fecha:** 2026-10-13
- **Base exacta Develop:** `4eefd119b19792e179e46b1243d07ab957137649`
- **Paso 2 lectores:** PR #318 (base del rollout), PR #320 (corrección de fixtures) mergeadas a Develop
- **T-352:** PR #323 mergeada a Develop
- **Migrate Develop:** runs 38365254695 (#320) y 38369888136 (#323), `migrate-develop=success`
- **Referencia:** T-340 issue #258; CC-022 §10; autorización explícita de PR temporal de checkpoint en la ficha T-340
- **Condición para comenzar Paso 3:** comprobar E2E trusted real (Chromium completo y global-settings; `t340-legacy-checkpoint`, privacidad pre/post-match, `multi-drop`, DoD2) en este Preview y SHA. Verificar CI y Deploy Develop. `skipped/cancelled` no son `PASS`.
- **Ejecución:** sin secretos nuevos, sin `db push`, sin scripts de limpieza sobre Supabase remoto y con timeout/retries originales. Reportar run, job, SHA checkout, resultados y posibles flaky.
- **Después del checkpoint GREEN:** cerrar esta PR temporal SIN MERGE, registrar la evidencia en issue #258 y bitácora de T-340 mediante el agente dueño, y **recién entonces** permitir a KiraK72 comenzar la PR separada del Paso 3.
- **Paso 4:** permanece BLOQUEADO hasta merge, migración, despliegue y checkpoint GREEN del Paso 3. No abrir ni desarrollar ambas etapas en paralelo.
