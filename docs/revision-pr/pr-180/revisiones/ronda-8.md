# Ronda 8 — PR #180 / T-307

**SHA revisado:** `a3f85191c476a93ba7b6bdf4e8feccd2d1dc29ae`  
**Resultado:** **CON BLOQUEANTES**

## Trusted exact-head

Preview:

```text
dpl_3oRCVBVgPzjB4AY79DfT4ymnptWj
a3f85191c476a93ba7b6bdf4e8feccd2d1dc29ae
READY
```

Trusted run:

```text
37182950321
22 passed / 1 failed
```

T-307:

```text
Realtime      ❌ RED 3/3
offline/form  ✅ GREEN
reconnect     ✅ GREEN
```

Realtime falla otra vez en línea 99:

```text
Expected offersRequestCount > 2
Received 2
timeout 15 s
```

## PR180-H09 ✅ arreglado-verificado

T-335/#244 sí corrigió la falta de versionado:
- migración declarativa para `offers` y `delivery_requests`;
- DB test de membresía;
- merge de #246;
- `migrate-develop` GREEN sobre el mismo Environment que usa el trusted runner.

H09 se cierra en ese alcance.

## PR180-H10 🔴 bloqueante

**Postgres Changes sigue sin entregar el INSERT real aun con la tabla publicada.**

Lo demostrado:
- Preview exacto y trusted runner válidos;
- sesión merchant válida;
- API autenticada puede leer offers;
- canal llega a readiness/catch-up de forma consistente con los 2 GET previos;
- INSERT real no dispara tercera GET/callback;
- reconnect y offline están sanos.

Lo **no** demostrado:
- causa exacta dentro de Supabase Realtime.

Siguiente diagnóstico obligatorio:
1. consultar en Supabase Develop real `pg_publication.pubinsert/pubupdate/pubdelete/pubtruncate`;
2. reconfirmar `pg_publication_tables` remoto;
3. comprobar Realtime habilitado y revisar Realtime logs;
4. probar un subscriber autenticado directo con la misma tabla/filtro/usuario;
5. solo después elegir fix de DB/config o cliente.

## Prohibido

- tocar/debilitar `e2e/specs/notifications.spec.ts`;
- subir timeout a 30 s;
- aceptar polling como Realtime;
- mocks para poner verde;
- `.skip`, `.only`, sleeps o `force:true`;
- ampliar RLS sin evidencia;
- `REPLICA IDENTITY FULL` “por las dudas”;
- publicar tablas adicionales.

## CI normal

El único RED normal del SHA es `unit` por T-336 heredada de `develop`; no pertenece a T-307.

**No aprobar ni mergear #180.**
