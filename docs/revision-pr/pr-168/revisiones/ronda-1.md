# Ronda 1 — PR #168 / T-322

**Fecha:** 2026-10-01  
**SHA funcional:** `97ac25aadc6e4ecd32b769549a096595df332d86`  
**Resultado:** **CON BLOQUEANTE (1)**

## Alcance revisado

La PR modifica solo:
- `docs/tasks/T-322.md`
- `docs/implementation-plan.md`

La ampliación decidida por P1 queda limitada a `src/features/legal/documents.ts` y `src/features/legal/legal-red.test.ts`; no introduce dependencias, migraciones ni cambios de seguridad.

La decisión es coherente con PR167-R01:
- `displayName` y `phone` permanecen obligatorios;
- la Política de Privacidad se publica como v1.1;
- no se alteran aceptaciones históricas;
- no se aprovecha el hotfix para reescribir otras secciones legales.

## PR168-H01 — ALTO — el primer DoD quedó desincronizado de la fila del plan

**Archivos:** `docs/tasks/T-322.md` y `docs/implementation-plan.md`  
**Patrón:** P03-comentario-contradice-codigo

El repositorio tiene un control explícito: `tools/verify-fichas.test.ts` exige que el **primer ítem del DoD de cada ficha sea exactamente igual** a la última columna de su fila en `docs/implementation-plan.md`.

La PR actualizó la fila del plan para agregar la obligación legal:

```text
... Storage mantiene RLS estricta; la Política de Privacidad se actualiza como nueva versión para reflejar la obligatoriedad real de esos datos.
```

pero dejó el primer DoD con el texto anterior:

```text
Alta aceptada muestra un estado neutral «Revisá tu email» sin navegar al onboarding; el registro exige nombre y teléfono; onboarding courier nunca usa IDs temporales y Storage mantiene RLS estricta.
```

Por eso CI falla exactamente en `tools/verify-fichas.test.ts:165`.

**Arreglo requerido:** copiar la nueva frase de la fila T-322 del plan al **primer checkbox del DoD** de `docs/tasks/T-322.md`, sin alterar el resto de la decisión de alcance. Después volver a correr `pnpm test`.

## CI

Run `36916415614`:

```text
typecheck       success
lint            success
build           success
bundle-budget   success
audit           success
db-tests        success
unit            failure

Test Files 109 passed / 1 failed
Tests      1558 passed / 1 failed
Falla: tools/verify-fichas.test.ts
```

No hay otros bloqueantes encontrados en esta PR documental.
