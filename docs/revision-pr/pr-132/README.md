# Revisión PR #132 — T-316

- PR: #132 `[T-316] Chequeo de uptime cada 10 minutos desde GitHub Actions`
- Rama: `feat/T-316-health-cron-actions`
- SHA revisado: `5daa66074efb5c8e197ecdb24370c37a9badaeb1`
- Base: `develop@f620a3982c51b5ea837271a776a7d28a99c2ceb1`
- Ronda actual: 1
- Estado: **CON BLOQUEANTES (1)**
- Decisiones Lautaro073: D01 = 1-A; D02 = 2-A.

## Resumen

La solución funcional va en la dirección correcta: el fallo real de Vercel fue confirmado en el run `36543241685` por el límite de Hobby a crons diarios, `vercel.json` deja solo el sweep diario y el chequeo de uptime pasa a GitHub Actions cada 10 minutos.

Queda un bloqueante:

- **PR132-H01 — P08 test-coverage:** los tests nuevos validan parte del contrato pero dejan verdes mutaciones que rompen el DoD: permiten `cancel-in-progress: true`, un grupo de concurrency distinto por run, ausencia del guard de `CRON_SECRET`, pérdida de auth o `--fail` solo en production y un cron diario inválido como `99 99 * * *`.

Decisiones:
- **PR132-A01:** la ficha T-316 no existía en develop antes de implementar. Lautaro073 eligió 1-A: excepción aceptada solo para esta tarea.
- **D02 / 2-A:** `PRODUCTION_APP_URL` se define como **repository variable**, no como environment variable. `CRON_SECRET` sigue siendo secret del environment `production`. El workflow actual ya usa `vars.PRODUCTION_APP_URL`; hay que corregir ficha/bitácora y configurar esa variable fuera del código.

## Checks

- Rama: `ahead 1 / behind 0`, merge-base exacto con develop.
- Archivos cambiados: solo los 5 declarados por la PR.
- Comentarios/reviews previos: ninguno.
- Fallo original de deploy reproducido desde logs: `Hobby accounts are limited to daily cron jobs`.
- CI general de la PR: **no inspeccionado todavía** porque H01 bloquea la ronda.
- Mutaciones independientes del instrumento: ver `evidencia/comandos.md`.

## Siguiente ronda

Endurecer únicamente el control en `verify-workflows.test.mjs`, corregir documentación de D02 y demostrar RED para toda la clase enumerada antes de volver a revisar.
