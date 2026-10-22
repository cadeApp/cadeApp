# PR #132 / T-316 — Ronda 1

**SHA revisado:** `5daa66074efb5c8e197ecdb24370c37a9badaeb1`  
**Base:** `develop@f620a3982c51b5ea837271a776a7d28a99c2ceb1`  
**Resultado:** **CON BLOQUEANTES (1)**

## Decisiones

### D01 — ficha T-316 ausente en develop

`docs/tasks/T-316.md` devuelve 404 en develop y nace dentro de esta PR, aunque AGENTS §1 y regla 50 exigen ficha previa.

**Decisión Lautaro073: 1-A.** Se acepta como excepción de proceso solo para T-316. Se registra como `PR132-A01`; no requiere PR administrativa retroactiva y no crea precedente.

### D02 — ubicación de PRODUCTION_APP_URL

La ficha dice que producción necesita `PRODUCTION_APP_URL` en el environment `production`, pero el workflow decide si crea el job con:

`if: vars.PRODUCTION_APP_URL != ''`

Las variables de environment no sirven para esa decisión previa al runner. Lautaro073 eligió **2-A**: `PRODUCTION_APP_URL` será una **repository variable**. `CRON_SECRET` permanece como secret del environment `production`.

La implementación actual ya referencia `vars.PRODUCTION_APP_URL`, por lo que D02 requiere corregir ficha/bitácora y configuración externa, no cambiar el workflow.

## Confirmación de la causa original

El run de deploy `36543241685` sobre `develop@f620a398...` falló en `vercel deploy --prebuilt --prod` con:

`Error: Hobby accounts are limited to daily cron jobs. This cron expression (*/10 * * * *) would run more than once per day.`

Por tanto, sacar el cron de uptime de `vercel.json` es una respuesta directa al fallo observado.

## BLOQUEANTE

### PR132-H01 — los tests no cubren todo lo que el DoD afirma

**Archivo:** `.github/workflows/verify-workflows.test.mjs`  
**Severidad:** medio · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice

La suite nueva comprueba el schedule exacto, existencia de workflow_dispatch, presencia de `concurrency:`, staging y parte del curl de staging, además del `if` de producción. Pero deja sin proteger propiedades expresas del DoD.

Batería independiente contra las aserciones actuales:

```
baseline                                      GREEN
cancel-in-progress: false -> true            GREEN
group: health-cron -> health-cron-${run_id}  GREEN
quitar guard de CRON_SECRET en staging       GREEN
quitar Authorization solo en production      GREEN
quitar --fail solo en production             GREEN
vercel cron 0 6 -> 99 99                     GREEN
```

Consecuencias:

- `cancel-in-progress: true` contradice “sin cancelar”.
- un group distinto por run permite solape entre ejecuciones y contradice “sin solapar”.
- declarar `CRON_SECRET` en env no demuestra que falte de forma visible si está ausente; el guard con `exit 1` no está testeado.
- production no tiene su curl/auth/secret cubierto; el test solo inspecciona staging para esa semántica.
- el regex `^\d{1,2} \d{1,2} \* \* \*$` considera válido `99 99 * * *`, que no representa una hora/minuto válidos.

### Arreglo requerido

1. Afirmar `concurrency.group: health-cron` y `cancel-in-progress: false`.
2. Validar rangos reales del cron diario: minuto 0–59 y hora 0–23, con los otros tres campos `*`.
3. Aplicar el mismo contrato a ambos jobs, staging y production:
   - environment correcto;
   - `CRON_SECRET: ${{ secrets.CRON_SECRET }}`;
   - guard de secreto ausente con `exit 1`;
   - exactamente un curl activo;
   - `curl --fail`;
   - Bearer con `$CRON_SECRET`;
   - URL `"$APP_URL/api/cron/health"`.
4. Para production, además:
   - `if: vars.PRODUCTION_APP_URL != ''`;
   - `APP_URL: ${{ vars.PRODUCTION_APP_URL }}`.

No fabricar una suite paralela ni debilitar controles existentes.

## MEJORAS

Ninguna adicional en esta ronda.

## No revisado todavía

- CI final: diferido mientras H01 siga abierto.
- Ejecución real del schedule después del merge a la rama por defecto.
- Existencia/valor efectivo de la repository variable `PRODUCTION_APP_URL` y de secrets de environments; la revisión no lee ni modifica configuración sensible/remota.

## Veredicto

**CON BLOQUEANTES (1): PR132-H01.**

A01 aceptado. D02 resuelto como 2-A. Sin más decisiones pendientes.
