# Ronda 1 — PR #208 / CC-016

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `37c5fd892e535ea4cf68b74c4f65e3f650b6c3ff`  
**Resultado:** **CON BLOQUEANTES (1)**

## Preflight

- Rama: `cc/CC-016-merchant-courier-projection`.
- HEAD funcional: `37c5fd892e535ea4cf68b74c4f65e3f650b6c3ff`.
- develop actual al cierre: `cb4111273da663f7591aec370a44767c4e677b82`.
- merge-base: `6577d9e427c5efc0a79a2c374f0f74d847732f4d`.
- Comparación actual: **ahead 1 / behind 16**.
- La PR sigue Draft y no tiene threads de review previos.
- El autor no escribió `docs/revision-pr/pr-208/**`.
- Los 16 commits nuevos de develop no pisan ninguno de los 14 archivos funcionales de CC-016, pero sí incluyen cambios de workflows/tests de E2E; por eso el CI anterior no representa la integración actual.

## H01 · La rama está 16 commits detrás de develop y el CI verde ya no cubre la base vigente · BLOQUEANTE

El CI #879, run `36984430924`, fue ejecutado sobre el merge ref `3430a5f1ec9fedb60291dda95357014a4dafcccf`, que integraba el HEAD funcional con la base vieja `6577d9e427c5efc0a79a2c374f0f74d847732f4d`.

Durante la revisión, develop avanzó hasta `cb4111273da663f7591aec370a44767c4e677b82`. La comparación actual informa `behind_by=16`. Entre esos commits entraron, entre otros, cambios a:

- `.github/workflows/e2e-preview.yml`;
- `.github/workflows/e2e-staging.yml`;
- `.github/workflows/verify-workflows.test.mjs`;
- el flujo de estado de documentación del courier de T-324.

No hay solapamiento directo de rutas con los 14 archivos funcionales de CC-016, por lo que no se observa un conflicto de contenido. Aun así, una contract-change de DB/dominio no puede cerrarse con checks calculados contra una base que ya no es develop actual.

**Corrección:** merge normal de `origin/develop` en la rama del PR, sin rebase, force-push ni amend. Después, volver a ejecutar los checks sobre el nuevo HEAD y obtener CI completo GREEN, incluido `db-tests` y regeneración de `database.types.ts`.

## Inspección funcional de CC-016

No encontré otro bloqueante de código en esta ronda.

### RPC y seguridad

`supabase/migrations/20261002083000_cc016_request_offer_couriers.sql`:

- usa `SECURITY DEFINER`;
- fija `search_path = public, pg_temp`;
- toma la identidad exclusivamente de `auth.uid()`;
- exige rol `merchant` y `app_private.is_active_operational_actor()`;
- comprueba que la solicitud pertenezca al actor;
- devuelve `NOT_FOUND` tanto para solicitud inexistente como ajena;
- no modifica policies de `couriers` ni `profiles`;
- revoca `EXECUTE` a `public` y `anon` y expone la función solo a `authenticated`;
- proyecta únicamente nombre, vehículo y estados/nivel documental.

### Frontera de servidor

`getRequestOfferCouriersRpc` valida input y output con el contrato de dominio, verifica que el `requestId` de la respuesta coincida y transforma la lista en un mapa por courier. Los objetos de salida son `.strict()`, por lo que un campo sensible adicional se rechaza.

`getMerchantRequestWithOffers` y `getRequestOffersLiveServer` dejan de embeber `couriers/profiles`. Si la RPC falla o falta el courier de una oferta, fallan cerrado; no vuelven a fabricar `Repartidor + docLevel 0`.

### DB y tests del SHA funcional

El run `36984430924` sobre la base vieja quedó GREEN y sirve como evidencia del **SHA funcional**, no como evidencia final de integración:

- Vitest: **112/112 archivos**, **1652/1652 tests**;
- DB: **14 archivos**, **1645 tests**, `Result: PASS`;
- `cc016_request_offer_couriers.sql .. ok`;
- `pnpm db:types --local` generó tipos y el job terminó GREEN con el posterior `git diff --exit-code`;
- typecheck, lint, build, audit y bundle-budget: GREEN.

La batería pgTAP comprueba grants, `SECURITY DEFINER`, `search_path`, dueño/ajeno, consentimiento, conjunto exacto de claves, ausencia de datos sensibles y niveles 2/1/0.

## Evidencia RED del autor

El body declara tres mutaciones. Esta revisión comprobó por inspección que las aserciones correspondientes están conectadas al comportamiento que pretenden proteger:

- quitar el chequeo de dueño en el fake contradice el test de comercio ajeno;
- quitar `.strict()` permite campos extra y contradice las pruebas de salida sensible;
- omitir una oferta cuyo courier falta contradice el test fail-closed del live reader.

No marco esas mutaciones como runtime independiente: el entorno de revisión no pudo obtener un checkout ejecutable por resolución de red. No se fabricó una ejecución ni se tomó la declaración del autor como prueba propia.

## Ajuste administrativo realizado por la revisión

El issue #35 / T-303 estaba cerrado con label `hecha`, contradiciendo su ficha y la propia bitácora, que exigen Flow 4 real GREEN después de aplicar CC-016. La revisión:

- reabrió #35;
- quitó `hecha`;
- agregó `bloqueada`;
- dejó comentario explicando que depende de #200 / PR #208 y del gate real posterior.

No cambia alcance ni producto; restaura el estado acordado.

## Decisiones

No hay 🔵 decisiones nuevas pendientes para Lautaro073. El diseño de CC-016, el comportamiento visible y el criterio de cierre posterior de T-303 ya estaban decididos.

## Criterio para Ronda 2

No pedir nueva revisión hasta que:

1. se haya hecho merge normal de `origin/develop` en la rama;
2. `git rev-list --left-right --count origin/develop...HEAD` dé `0 <ahead>`;
3. CI del nuevo HEAD esté GREEN;
4. `db-tests` muestre el archivo CC-016 y `Result: PASS`;
5. la regeneración de `database.types.ts` no deje diff;
6. no se debiliten tests, expectativas ni controles para conseguir verde.
