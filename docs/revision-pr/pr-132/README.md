# Revisión PR #132 — T-316

- PR: #132 `[T-316] Chequeo de uptime cada 10 minutos desde GitHub Actions`
- Rama: `feat/T-316-health-cron-actions`
- SHA revisado: `0f12b80b22c89a33d61f25f2a7111c1e668f7600`
- Base: `develop@f620a3982c51b5ea837271a776a7d28a99c2ceb1`
- Ronda actual: 2
- Estado: **SIN BLOQUEANTES**
- Decisiones Lautaro073: D01 = 1-A; D02 = 2-A.

## Resumen

T-316 queda técnicamente apta en el SHA revisado.

- **PR132-H01 cerrado/verificado:** el control ahora valida concurrency exacto, rangos reales del cron diario y el mismo contrato de secret/guard/curl para staging y production.
- **PR132-A01** sigue aceptado por decisión 1-A: excepción de ficha previa solo para T-316.
- **D02 / 2-A** quedó aplicada en documentación: `PRODUCTION_APP_URL` es repository variable y `CRON_SECRET` secret del environment `production`.
- `health-cron.yml` y `vercel.json` no cambiaron durante el arreglo de la ronda.

## Evidencia independiente

Se reprodujeron en RED las siete mutaciones declaradas por el autor:

1. `cancel-in-progress: false -> true`;
2. group fijo -> group por `github.run_id`;
3. quitar guard de `CRON_SECRET` en staging;
4. quitar Authorization en production;
5. quitar `--fail` en production;
6. `0 6 * * * -> 99 99 * * *`;
7. `exit 1 -> exit 0` en production.

Batería propia adicional:

- `APP_URL` de production reemplazada por literal -> RED;
- quitar env `CRON_SECRET` de production -> RED;
- invertir la guarda a `-n` -> RED;
- mover curl antes de la guarda -> RED;
- minuto 60 -> RED;
- hora 24 -> RED;
- borde válido `59 23 * * *` -> GREEN.

## CI exacto del SHA revisado

Run CI **#614** sobre `0f12b80b22c89a33d61f25f2a7111c1e668f7600`:

- `typecheck`: success
- `lint`: success
- `unit`: success
  - Vitest: **103 archivos / 1381 tests passed**
  - `verify-workflows.test.mjs`: **29 pass / 0 fail**
  - ADR tests: **6 pass / 0 fail**
- `build`: success
- `audit`: success
- `db-tests`: success
  - pgTAP: **Files=12, Tests=1601, Result: PASS**
  - `db:types` generado con `--local` y sin drift
- `bundle-budget`: success advisory; rutas preexistentes sobre 180 kB permanecen fuera de T-316.

## No revisado / operativo posterior

- La existencia y valor efectivo de la repository variable `PRODUCTION_APP_URL` no se verifican desde la revisión.
- Los secrets de environments no se leen.
- El primer schedule real se ejercita después del merge a la rama por defecto.
- Después del merge debe promoverse nuevamente a staging para comprobar que Vercel ya acepta el deploy sin el cron de 10 minutos.

## Veredicto

**SIN BLOQUEANTES.** H01 cerrado, A01 aceptado y sin decisiones pendientes.
