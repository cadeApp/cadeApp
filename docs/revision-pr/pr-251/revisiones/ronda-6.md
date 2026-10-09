# PR #251 · T-313 — Ronda 6

- **SHA revisado:** `bce333fede77737a66d3afae8b43a19ce6dc8747`
- **Fecha:** 2026-10-06
- **Resultado:** CON BLOQUEANTES (1)
- **Nuevos hallazgos:** 0
- **Decisiones nuevas:** 0

## H05 · CERRADO Y VERIFICADO

La segunda corrección coincide con la propiedad que pedía el hallazgo:

1. `LocalRegistrationContext` agrega `pendingCleanupEmails`.
2. El email exacto se registra **antes** del click en “Crear cuenta”.
3. La reconciliación se ejecuta en el `finally` del fixture.
4. `listUsers` usa igualdad exacta del email y pagina hasta agotar `nextPage`.
5. Los errores Admin se propagan.
6. Después se ejecuta `cleanupStagingData(context)`.
7. Se conserva el error combinado si falla el test y también cleanup.

Los runs de Preview posteriores ejercen ese teardown sin `[E2E Lifecycle Error]`.

## H06 · CERRADO Y VERIFICADO

La evidencia del autor fue reproducida desde GitHub Actions.

### Probe RED

- commit: `709d2c3442ac40cb4a5b71ccd06e7b89a3ad7279`
- run: `37425374360`

Fallo exacto:

```text
Expected: "merchant"
Received: "courier"
at merchant-registration.spec.ts:306:33
```

El caso courier general siguió GREEN y el fallo fue discriminante de la nueva aserción.

### Revert

- revert: `7f7c94a31f3d8d9b9f19ce38501258ff49b02b62`
- run: `37428952648`

El caso `Sin consentimiento guardado el comercio no llega al panel` volvió a GREEN.

En el HEAD actual, run `37433304282`, ese caso continúa GREEN.

## H04 · ÚNICO BLOQUEANTE

Trusted Preview del HEAD actual:

```text
35 passed
1 failed
```

T-313:

- ✅ `DoD: Un courier no entra a (merchant)`
- ✅ `DoD: Sin consentimiento guardado el comercio no llega al panel`
- ❌ `DoD: Alta completa y panel visible con la versión de consentimiento registrada`

Fallo actual:

```text
merchant-registration.spec.ts:184
Locator: getByRole('alert')
Expected: 0
Received: 2
```

No hay evidencia nueva que identifique la causa raíz concreta de Auth. Por eso D02-A sigue prohibida hasta tener baseline completo GREEN.

## CI del HEAD

Run `37433113069`: GREEN.

Evidencia interna:

- unit: **121 files / 1921 tests passed**
- db-tests: **18 files / 1811 tests · PASS**
- typecheck: success
- lint: 0 warnings/errors de ESLint (format-check sigue advisory)
- build: success
- bundle-budget: success/advisory
- audit: success

## Sincronización

La rama quedó **33 commits detrás** de `develop`.

La comparación desde el develop que ya incorporó la rama (`80f0b56`) hasta el develop actual muestra solo:
- documentación de revisión/log T-308;
- `e2e/specs/incidents.spec.ts`.

No cambia el runtime de T-313, pero la regla de entrega exige sincronizar antes del cierre final.

## Body de PR

La estructura del template sigue correcta, pero la sección de evidencia quedó vieja:
- CI viejo;
- Preview viejo;
- línea vieja del fallo.

Debe actualizarse después de sincronizar con `develop`, sin marcar DoD/RED global como cumplidos mientras H04 siga abierto.

## P3

No existe todavía visto bueno explícito de P3 sobre `e2e/specs/merchant-registration.spec.ts`.

La aprobación GitHub de Lautaro073 satisface `approval-policy`, pero no reemplaza P3.

## Acción manual de Lautaro073

El alta E2E sigue bloqueada en **Supabase Develop**. La revisión no tiene acceso al proyecto Supabase de cadeApp en el conector disponible, así que la configuración de Auth de Develop debe revisarse manualmente. No tocar Staging.

La decisión vigente es: Develop/Preview no debe depender de correo real. Como los logs no demuestran la causa raíz, no documentar “SMTP” como causa hasta tener evidencia concreta.

## Veredicto

**CON BLOQUEANTES (1): H04.**

No apruebo ni mergeo.
