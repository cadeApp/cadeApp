# PR #132 / T-316 — Ronda 2

**SHA revisado:** `0f12b80b22c89a33d61f25f2a7111c1e668f7600`  
**Base:** `develop@f620a3982c51b5ea837271a776a7d28a99c2ceb1`  
**Resultado:** **SIN BLOQUEANTES**

No hay decisiones nuevas para Lautaro073.

## Sincronización y alcance

El commit de arreglo posterior a R1 toca únicamente:

- `.github/workflows/verify-workflows.test.mjs`
- `docs/tasks/T-316.md`
- `docs/tasks/log/T-316.md`

No toca `docs/revision-pr/**`, `health-cron.yml` ni `vercel.json`.

La rama sigue `behind 0` respecto de develop y GitHub la reporta mergeable.

## D02 / 2-A — aplicada

La ficha ahora especifica correctamente:

- `PRODUCTION_APP_URL` como **repository variable**;
- `CRON_SECRET` como secret del environment `production`;
- guard de job `vars.PRODUCTION_APP_URL != ''`;
- `APP_URL: ${{ vars.PRODUCTION_APP_URL }}`.

La ficha no afirma que la repository variable ya exista. La bitácora registra la decisión.

## PR132-H01 — CERRADO Y VERIFICADO

El test nuevo ahora cubre las propiedades que faltaban en R1.

### Concurrency

Exige el bloque exacto:

```yaml
concurrency:
  group: health-cron
  cancel-in-progress: false
```

Por lo tanto detecta tanto cancelación como groups variables por run.

### Crons de Vercel

Cada schedule se divide en cinco campos y exige:

- minuto numérico 0–59;
- hora numérica 0–23;
- día de mes, mes y día de semana exactamente `*`;
- ausencia de `/api/cron/health`.

El borde válido `59 23 * * *` queda GREEN; `60 23 * * *`, `59 24 * * *` y `99 99 * * *` quedan RED.

### Contrato idéntico para staging y production

Para ambos jobs se comprueba:

- environment esperado;
- APP_URL esperado;
- secret `CRON_SECRET` proveniente de `secrets.CRON_SECRET`;
- guarda exacta por secreto vacío;
- `exit 1` y ausencia de `exit 0`;
- un único curl activo y posterior a la guarda;
- comienzo con `curl --fail`;
- Bearer con `$CRON_SECRET`;
- final exacto en `"$APP_URL/api/cron/health"`.

Production además exige el `if` y APP_URL basados en la repository variable.

### Mutaciones del autor reproducidas

Las siete mutaciones de la bitácora se reprodujeron independientemente y todas quedan RED.

### Batería independiente adicional

También quedan RED:

- production APP_URL reemplazada por un literal;
- CRON_SECRET eliminado del env de production;
- guarda de production invertida a `-n`;
- curl de staging movido antes de la guarda;
- minuto 60;
- hora 24.

El borde máximo válido minuto 59 / hora 23 permanece GREEN.

No se observa residual de H01.

## CI

CI #614 del SHA exacto:

- unit: success — **103 archivos / 1381 tests**
- verify-workflows: **29/29**
- ADR: **6/6**
- typecheck: success
- lint: success
- build: success
- audit: success
- db-tests: success — **Files=12, Tests=1601, Result: PASS**
- bundle-budget: success advisory

Los fallos locales por carreras/timeout descritos en la bitácora no se reproducen en el runner limpio.

El bundle-budget sigue informando rutas preexistentes sobre 180 kB, entre ellas rutas admin y `/design-system`; T-316 no toca código de producto ni bundle.

## No revisado por definición

- valor/existencia real de `PRODUCTION_APP_URL`;
- contenido de secrets de environments;
- primer disparo programado posterior al merge;
- deploy real de staging posterior al merge.

## Veredicto

**SIN BLOQUEANTES.**

- PR132-H01: cerrado/verificado.
- PR132-A01: aceptado.
- decisiones pendientes: ninguna.

Esta revisión no aprueba ni mergea.
