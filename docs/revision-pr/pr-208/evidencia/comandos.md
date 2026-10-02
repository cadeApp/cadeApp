# Evidencia — PR #208 / CC-016 / Ronda 1

## Preflight

Equivalente reproducible:

```bash
git fetch origin
git rev-list --left-right --count origin/develop...origin/cc/CC-016-merchant-courier-projection
git merge-base origin/develop origin/cc/CC-016-merchant-courier-projection
```

Estado observado por la revisión:

```text
HEAD funcional: 37c5fd892e535ea4cf68b74c4f65e3f650b6c3ff
develop actual: cb4111273da663f7591aec370a44767c4e677b82
merge-base: 6577d9e427c5efc0a79a2c374f0f74d847732f4d
ahead: 1
behind: 16
PR: open, Draft, mergeable=true
changed files: 14
```

Los archivos cambiados en develop desde el merge-base no se superponen con los 14 archivos funcionales de CC-016. Sí entraron cambios en los workflows E2E y su test de verificación, por lo que el CI previo no es evidencia de la integración con el tip actual.

## CI reproducido desde logs del run existente

Run CI: `36984430924`  
Merge ref usado por GitHub: `3430a5f1ec9fedb60291dda95357014a4dafcccf`  
Base de ese merge ref: `6577d9e427c5efc0a79a2c374f0f74d847732f4d`

Resumen del job unit:

```text
Test Files 112 passed (112)
Tests      1652 passed (1652)
```

Resumen del job db-tests:

```text
Applying migration 20261002083000_cc016_request_offer_couriers.sql...
supabase/tests/cc016_request_offer_couriers.sql .. ok
Files=14, Tests=1645
Result: PASS
pnpm db:types --local
Tipos generados exitosamente en src/types/database.types.ts
```

El script del job ejecuta después:

```bash
git diff --exit-code -- src/types/database.types.ts
```

El job finalizó GREEN.

## Inspección de seguridad

Se revisó directamente la migración y se confirmó:

```text
SECURITY DEFINER
SET search_path = public, pg_temp
auth.uid() como identidad
rol merchant + app_private.is_active_operational_actor()
ownership: delivery_requests.id = p_request_id AND merchant_id = auth.uid()
foreign/missing -> NOT_FOUND
REVOKE ALL ... public, anon, authenticated
GRANT EXECUTE ... authenticated
sin cambios de RLS
```

La salida SQL contiene únicamente:

```text
courierId
displayName
vehicleType
licenseStatus
insuranceStatus
docLevel
```

## Matriz de pruebas inspeccionada

`supabase/tests/cc016_request_offer_couriers.sql` cubre 24 aserciones, incluyendo:

- owner merchant;
- foreign merchant y request inexistente;
- courier no autorizado;
- sesión sin `auth.uid()`;
- consentimiento pendiente;
- exactitud de claves;
- ausencia de teléfono/patente/`dni_hmac`/status;
- niveles documentales 2/1/0;
- lectura directa de `couriers/profiles` sigue cerrada.

Los unitarios de dominio/server/queries/live cubren parsing estricto, fail-closed y los dos órdenes usados por T-303.

## Mutaciones declaradas por el autor

El body declara:

```text
1. fake sin chequeo de dueño
2. contrato sin .strict()
3. live reader que saltea ofertas sin courier
```

La revisión comprobó estáticamente que cada mutación contradice una aserción concreta. No se registra runtime independiente porque el entorno de revisión no pudo resolver github.com para materializar un checkout; no se fabricó salida RED.

En Ronda 2, después del merge de develop, el autor debe volver a demostrar RED/GREEN sin adulterar tests ni expectativas.

## Estado administrativo T-303

La revisión intentó corregir #35 y observó inicialmente:

```text
state: open
labels: P2, fase-3, bloqueada
hecha: removida
```

Después del commit de revisión, `board-sync` volvió a dejarlo:

```text
state: closed
labels: P2, fase-3, hecha
```

Por lo tanto no se registra la reapertura como un arreglo persistente. El comentario explicativo queda en #35 y #200 continúa abierto como tracker de CC-016 / Flow 4.


---

# Evidencia — Ronda 2

## Sincronización

```text
HEAD revisado: 423b56af4911ca1d1ad6ba9f297c653172167731
develop: cb4111273da663f7591aec370a44767c4e677b82
compare status: ahead
ahead_by: 5
behind_by: 0
merge-base: cb4111273da663f7591aec370a44767c4e677b82
```

Merge commit:

```text
759bdbbf3e324b32fe6f549f51c0688a49eb2dd5
parent 1: a3160e636177efc2a21a7195bea22f1f2478b880
parent 2: cb4111273da663f7591aec370a44767c4e677b82
```

El commit posterior `423b56af4911ca1d1ad6ba9f297c653172167731` cambia solo `docs/tasks/log/T-303.md`.

## RED/GREEN prescripto por Ronda 1

Registro de bitácora inspeccionado:

```text
Mutación A:
fake ownership guard removido temporalmente
RED  Tests 1 failed | 4 passed (5)
GREEN Tests 5 passed (5)

Mutación B:
.strict() removido temporalmente de requestOfferCourierSchema
RED  Tests 6 failed | 36 passed (42)
GREEN Tests 42 passed (42)

Mutación C:
missing courier => continue temporal
RED  Tests 1 failed | 27 passed (28)
GREEN Tests 28 passed (28)
```

La batería coincide con el prompt de Ronda 1. El árbol final no contiene las mutaciones; el commit `423b56af4911ca1d1ad6ba9f297c653172167731` solo registra la evidencia.

Limitación del entorno de revisión:

```text
git clone https://github.com/cadeApp/cadeApp.git
fatal: Could not resolve host: github.com
```

Por eso no se inventa una segunda ejecución local; la verificación independiente de H01 se hace mediante grafo remoto + CI exact-head.

## CI exact-head

Run: `37042771528` — CI #901.

Unit:

```text
Test Files 113 passed (113)
Tests      1670 passed (1670)
verify-workflows: success
verify-adr: success
```

DB:

```text
Applying migration 20261002083000_cc016_request_offer_couriers.sql...
supabase/tests/cc016_request_offer_couriers.sql .. ok
Files=14, Tests=1645
Result: PASS
pnpm db:types --local
Tipos generados exitosamente en src/types/database.types.ts
git diff --exit-code -- src/types/database.types.ts
job: success
```

Otros jobs:

```text
typecheck success
lint success
build success
audit success
bundle-budget success
```

## E2E Preview

Run: `37042913464`.

Resolve job:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

`e2e-preview`: skipped.

La migración no se aplica al Supabase Develop remoto desde la PR; el E2E real de Flow 4 queda para después del merge y de `migrate-develop`.
