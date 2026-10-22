# Informe de revisión — PR #282 / CC-023 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/282  
**Head SHA revisado:** `ced0add71da9daf7d56a8c951bb9253cd9a20537`  
**Base:** `develop` @ `80f0b56a9ff94d3c4e10fb215c63faccd9097365`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (2).**

La propuesta base de grants por columna es válida como mecanismo: PostgreSQL permite revocar el SELECT de tabla y volver a conceder SELECT solo sobre columnas concretas. El problema está en dos supuestos del documento, no en ese mecanismo.

## PR282-H01 — el revoke rompe lectores del comercio

**Severidad:** alto · **Patrón:** P06-enumeracion-incompleta.

CC-023 afirma que ningún lector `authenticated` selecciona `notes` o `cash_change_amount`, pero `develop` tiene lectores activos:

- `src/features/requests/queries.ts:262-276`: `getMerchantHistoryRequests` selecciona `cash_change_amount`;
- `src/features/requests/queries.ts:434-448`: `getMerchantRequests` selecciona `cash_change_amount`;
- `src/features/requests/queries.ts:652-672`: `getMerchantRequestWithOffers` selecciona `cash_change_amount` y `notes`;
- `src/features/requests/components/request-offers-list.tsx:184-186,397-401`: el comercio muestra actualmente el monto exacto de cambio en el detalle de ofertas.

Con el `revoke select on table ... from authenticated` + grant que excluye esas columnas, esas queries directas no pueden seguir leyendo la proyección actual. Por lo tanto son incorrectas las afirmaciones de «ningún lector authenticated», «sin impacto visible» y compatibilidad del rollout.

### Decisión de Lautaro073

**1-A autorizada el 2026-10-06.**

Se mantiene la barrera fuerte: `notes` y `cash_change_amount` no vuelven a tener SELECT directo para `authenticated`. T-345 debe preservar el comportamiento actual del comercio mediante una frontera `security definer`/server-side específica para los datos privados que realmente necesite el dueño de la solicitud, y retirar de las queries directas las lecturas privadas que sean innecesarias.

La corrección debe actualizar CC-023, T-345, su allowlist y su DoD. No se acepta devolver SELECT de esas dos columnas al rol `authenticated`.

## PR282-H02 — SET TABLE reemplaza la publicación completa

**Severidad:** alto · **Patrón:** P01-contrato-de-framework-no-verificado.

CC-023 §3 propone como fallback:

```sql
alter publication supabase_realtime
set table public.delivery_requests (...);
```

PostgreSQL 15 define que `SET TABLE` **reemplaza** la lista de tablas/esquemas de la publicación. En `develop`, `supabase_realtime` contiene al menos `public.offers` y `public.delivery_requests` por T-335. Ejecutar ese fallback dejaría fuera a `public.offers` y rompería su Realtime.

La corrección debe cambiar el fallback por una operación que preserve los otros miembros: quitar únicamente `delivery_requests` de la publicación y volver a agregar esa misma tabla con lista de columnas, o reconstruir explícitamente la publicación completa a partir de miembros verificados. La opción preferida es `DROP TABLE public.delivery_requests` seguido de `ADD TABLE public.delivery_requests (<columnas>)`, dentro de la migración.

Además, PostgreSQL exige que cualquier lista de columnas usada para una tabla publicada con UPDATE/DELETE contenga las columnas de replica identity; el DoD debe verificar esa precondición, no asumirla.

## Checks del SHA revisado

CI sobre `ced0add7`:

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅
- Vercel ✅
- e2e-preview ✅
- approval-policy ❌ porque todavía no existía un informe completo de revisión independiente.

Los checks verdes no cubren los dos defectos porque la PR es documental y no ejecuta aún la migración de T-345.

## Conclusión

No se aprueba ni mergea. La dirección 1-A ya está decidida; agy debe corregir H01 y H02, actualizar la bitácora y devolver la PR para ronda 2.
