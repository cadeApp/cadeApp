# Ronda 7 — PR #180 / T-307

**SHA revisado:** `47152d69d1de0a6b32db21f0ab98a8f36e27e8d9`  
**Resultado:** **CON BLOQUEANTE T-335 / #244**

## Sincronización y alcance

La rama integró T-333 y está `behind_by=0`.

`e2e/specs/notifications.spec.ts` permanece idéntico respecto de `5f8d78a9`; el autor no debilitó el control.

## Trusted E2E

Dos runs post-T-333 reproducen el mismo estado:

| Test T-307 | 37163278613 | 37163835724 |
|---|---|---|
| Realtime oferta nueva | RED 3/3 | RED 3/3 |
| Offline + formulario | GREEN | GREEN |
| Reconnect/refetch | GREEN | GREEN |

Realtime falla siempre en línea 99:

```text
offersRequestCount
Expected: > 2
Received: 2
```

No hay segunda GET posterior al INSERT dentro de 15 s.

## T-333

T-333 queda confirmada como corrección válida para reconnect:
- antes: reconnect RED;
- después: reconnect GREEN en dos trusted runs;
- no corresponde reabrir ese defecto.

## Nuevo bloqueo PR180-H09

Los consumidores Realtime de T-204 escuchan:
- `offers`;
- `delivery_requests`.

No existe en las migraciones/config del repo una alta declarativa de esas tablas en `supabase_realtime`.

La RLS necesaria para que el merchant lea `offers` sí existe, por lo que el siguiente diagnóstico debe realizarse en la publicación real.

Creado **T-335 / #244**, P1.

T-335 debe:
1. consultar `pg_publication_tables`;
2. demostrar RED si falta `offers` o `delivery_requests`;
3. versionar la membresía mediante migración idempotente si falta;
4. no dropear/recrear la publicación;
5. no cambiar RLS ni el E2E;
6. después del merge/migrate-develop, volver a ejecutar T-307.

## CI

Run `37163772846`: todo GREEN, incluidos audit y db-tests.

## Estado de T-307

- H01 ✅
- H02 ✅ control + producto reconnect GREEN post-T-333
- H03 ✅
- H04 ✅
- H05 ✅ control correcto; producto Realtime todavía RED
- H06 ✅
- H07 ✅
- H08 ✅
- H09 🔴 T-335/#244
- offline/form ✅
- reconnect ✅
- Realtime 🔴

No corresponde ejecutar todavía la mutación final de H05 porque el baseline Realtime ya está RED.

**No aprobar ni mergear PR #180.**
