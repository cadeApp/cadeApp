# Evidencia reproducible — PR #132 / Ronda 1

SHA revisado: `5daa66074efb5c8e197ecdb24370c37a9badaeb1`.

## Sincronización

```
base: develop@f620a3982c51b5ea837271a776a7d28a99c2ceb1
head: 5daa66074efb5c8e197ecdb24370c37a9badaeb1
ahead_by: 1
behind_by: 0
mergeable: true
```

`docs/tasks/T-316.md` no existe en develop; D01 fue resuelta por Lautaro073 como 1-A.

## Causa original

Run `deploy` 36543241685:

```
Error: Hobby accounts are limited to daily cron jobs.
This cron expression (*/10 * * * *) would run more than once per day.
```

El error aparece después del build y al ejecutar Vercel deploy.

## Batería independiente de PR132-H01

Se reprodujeron las aserciones nuevas relevantes sobre el contenido exacto de `health-cron.yml`, `vercel.json` y el test del SHA revisado.

Salida:

```
baseline: GREEN
cancel-in-progress false -> true: GREEN
group health-cron -> health-cron-${{ github.run_id }}: GREEN
remove staging CRON_SECRET guard: GREEN
remove production Authorization header: GREEN
remove production curl --fail: GREEN
vercel daily cron 0 6 -> 99 99: GREEN
```

Motivo mecánico:

- el test solo busca `concurrency:`; no afirma `group` ni `cancel-in-progress`;
- `CRON_SECRET` se verifica como env de staging, pero no el bloque que corta con `exit 1`;
- la forma de curl/auth se inspecciona solo en staging;
- production solo comprueba `if` y `environment`;
- `/^\d{1,2} \d{1,2} \* \* \*$/` acepta valores fuera de rango.

## RED exigido en la próxima ronda

Una mutación por vez, restaurando la anterior:

1. `cancel-in-progress: false -> true` → RED;
2. `group: health-cron -> group: health-cron-${{ github.run_id }}` → RED;
3. quitar solo el guard `if [ -z "$CRON_SECRET" ] ... exit 1` de staging → RED;
4. quitar solo el header Authorization de production → RED;
5. quitar solo `--fail` del curl de production → RED;
6. cambiar el cron de Vercel `0 6 * * * -> 99 99 * * *` → RED.

Baseline restaurado debe quedar GREEN. Además, el autor debe agregar una mutación propia diferente dentro de la misma clase.

No se acepta cambiar tests solo para reconocer exactamente estas cadenas: la propiedad debe quedar afirmada para ambos jobs y con rangos cron reales.
