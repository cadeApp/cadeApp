# Evidencia y comandos — PR #397, ronda 1

**SHA inspeccionado:** `c1264541e03b741e33729d3126c0db33701872a6`. La carpeta de revisión se agrega después mediante commit que NO cambia código ni tests.

## Fuentes reales inspeccionadas

- `supabase/migrations/20261017090000_t369_publication_credits.sql` (2054 líneas), tablas, `release_publication`, `admin_update_setting`, `admin_set_subscription`, `admin_grant_publication_credits`, `admin_register_plan_period`.
- `supabase/tests/t369_publication_credits.sql` (1153 líneas), casos de primera compra, idempotencia, arrastre y solo pruebas seriales; `src/domain/testing/rpc-fake.ts` y `src/domain/rpc-contracts.ts`.
- `.github/workflows/ci.yml` líneas 198–222: runners de T340/CC024/CC025/CC026; no de crédito T-369.
- `docs/contracts/CC-029.md` y `docs/tasks/T-369.md` en develop (sin modificar); `docs/tasks/log/T-369.md` y cuerpo de PR #397 para evidencia del autor.

## Evidencia ejecutada por GitHub Actions (NO local)

- HEAD `c1264541`, run https://github.com/cadeApp/cadeApp/actions/runs/39024846670: `db-tests` PASS; log: `Files=28, Tests=2645`; tipo, lint, build, unit, audit, bundle-budget PASS. El runner de `db-tests` ejecutó pruebas de integración de otras tareas; NO incluye un script t369 multisesión.
- Mutación del autor en PR #398: https://github.com/cadeApp/cadeApp/actions/runs/39022798152; `t369_publication_credits.sql` falló **36/225** y `rpc_requests.sql` **2/1241**; prueba un subconjunto de controles existentes, no nuestros casos faltantes.
- `approval-policy` FAIL antes del informe. No se interpreta como una prueba de seguridad o contabilidad.

## Comprobaciones reproducibles, NO ejecutadas localmente

```bash
git fetch origin
git rev-parse HEAD
git diff --check origin/develop...HEAD
git diff --stat origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck && pnpm lint && pnpm test
pnpm supabase test db supabase/tests/t369_publication_credits.sql
pnpm supabase test db supabase/tests/rpc_requests.sql
node docs/revision-pr/analizar.mjs verificacion
```

**No se arrancó Docker ni Supabase local**, respetando la regla del proyecto: verificar SQL leyendo el job real `db-tests`. Solo después de los arreglos el agy debe ejecutar estos comandos o aportar los logs CI sobre SHA corregido. Ninguna salida hipotética se registra como real.

## Oráculos de nuevas pruebas RED→GREEN (propuesta; no son resultados realizados)

**H01:** en `supabase/tests/integration/t369_publication_credits_concurrency.mjs` abrir sesiones Postgres de verdad usando patrón de `t340_concurrency.mjs`. Preparar 3 créditos y 5 publicaciones concurrentes, exigir exactamente 3 reservas/publicaciones y 2 errores `PUBLICATION_CREDITS_EXHAUSTED`, sin saldo negativo; dos publicaciones de misma solicitud dejan un solo cargo corriente; carreras de match/cancelación/reconciliación y 2 admins registrando operación_key simultánea. Colocar barreras con locks reales/timeout acotado, sin `sleep`. MUTACIÓN: quitar lock de comercio de una copia temporal del SQL en DB efímera (mantener misma prueba) y exigir fallo observable de la invariante, no solo timeout sin corroboración. Runner dentro `db-tests`, en `.github/workflows/ci.yml`, sin eliminar ningún script previo.
**H02:** pgTAP y Vitest para misma clave+nota distinta -> `IDEMPOTENCY_CONFLICT`, mismas notas -> `idempotent=true` y un solo evento en audit log, ambos tipos de alta. MUTACIÓN: quitar comparación normalizada de note y observar GREEN base / RED mutado; no cambiar expectativa.
**H03:** configurar `subscription_grace_days=3`, agenda plan desde `paid_until+3+1`; intentar subirla, probar que no solapa (rechazo o reprogramación atómica); reducción no crea derecho perdido sin regla explícita. Carrera admin setting vs registro del primer período en dos sesiones; locks consistentes y sin deadlock. MUTACIÓN: omitir la guarda y observar rechazo de aserción por superposición.
**H04:** abrir transacción antes del instante de vencimiento, crear/ajustar `expires_at` a un punto entre `transaction_timestamp()` y `clock_timestamp()`; ejecutar `release_publication`; aserción un único lote `refund_conversion` suelto con `granted` correcto, dos intentos no duplican. No usar sleeps: controlar instantes mediante los timestamps de la propia transacción o barreras. MUTACIÓN: restaurar `now()` en copia efímera, debe fallar el test.
**H05:** descuento configurado 0% → compra 1: fila de consumo de primera compra, pct 0; cambiar a 20% → compra 2: pct null y sin nueva fila; cortesía/ajuste previos no consumen; dos compras concurrentes con porcentaje variable preservan exactamente una primera. MUTACIÓN: volver a `if v_pct > 0` y comprobar falla, sin alterar la aserción.
**H06:** comparar literalmente sección Rollback con CC-029; prohibido borrar movimientos o lotes acreditados, incluso durante el piloto.

## Seguridad del experimento

Prohibido adulterar tests, expectations, mocks, datos, reglas, CI, `approval-policy`, branch protections o resultado; mutantes nunca se mergean y deben ejecutarse sobre base efímera. Nada contra Supabase remoto. Toda ampliación de archivos permitidos se registra en T-369 y en la bitácora, citando decisión 1-A de Lautaro073. No escribir en `docs/revision-pr/pr-397/**` desde agy.