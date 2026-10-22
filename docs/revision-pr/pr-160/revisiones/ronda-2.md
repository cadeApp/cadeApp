# Ronda 2 — PR #160 / T-303

**Fecha:** 2026-10-01  
**SHA revisado:** `e268f5c2f4e72fdcb2592996b50b027062e2464a`  
**develop al revisar:** `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`  
**Resultado:** **CON BLOQUEANTES (8)**

## Sincronización

`develop...feat/T-303-main-flow` al iniciar esta ronda:

- ahead: 7
- behind: **25**
- merge-base: `9e232d0e4ef003ca0535b11e5a962b4cf603189a`

La rama debe sincronizarse sin force-push antes de considerar cualquier cierre, porque esos 25 commits incluyen cambios de auth/guards que afectan el login usado por este E2E.

## Estado de los hallazgos de Ronda 1

### PR160-H01 — corregido estructuralmente, todavía sin verificación independiente

El spec ya no contiene `page.route(...).fulfill()` ni `context.route(...).fulfill()` para sustituir cadeApp. Consume `stagingContext`, autentica por UI y navega páginas reales.

**Estado:** `arreglado-sin-verificar`. No se marca `arreglado-verificado` porque no hubo ejecución independiente del E2E real en staging.

### PR160-H02 — PARCIAL: la concurrencia ya es real, pero el oráculo sigue incompleto

Ahora las dos confirmaciones se disparan dentro de `Promise.all`, pero:

1. `alreadyMatchedAlert` es simplemente `getByRole('alert')`; cualquier error visible satisface el control, no necesariamente `ALREADY_MATCHED`.
2. Después de `tab1.reload()` no hay ninguna aserción que compruebe exactamente una oferta `accepted` ni que la otra no haya quedado aceptada.
3. `Locator.isVisible()` se usa como sondeo inmediato; el `timeout` no reemplaza una espera/aserción eventual fiable.

El DoD dice que debe fallar si se aceptan dos ofertas. El estado final debe ser el oráculo, no la mera presencia de un alert.

### PR160-H03 — PARCIAL: varias acciones son reales, pero el flujo de oferta no es ejecutable con su propio fixture

Publicación, retiro, ordenamiento y avance de viaje ya ejecutan interacciones reales. Sin embargo el caso del piso está roto por construcción:

- la fixture global usa `createOffersForFirstRequest: true`;
- el seed crea una offer `pending` para Courier 0 sobre `createdRequestIds[0]`;
- el test del piso inicia sesión como Courier 0;
- `getAvailableRequests()` marca `hasMyOffer=true` para esa solicitud;
- `RequestCard` reemplaza el botón “Ofertar” por “Ya ofertaste”.

Por lo tanto `courierPage.offerButton.first()` no puede apuntar a la request propia seeded. Si encuentra un botón, pertenece a otra request compartida de staging, haciendo el test no aislado.

Además la aserción final busca `new RegExp(String(validAmount))`, mientras la UI formatea ARS con separador de miles; por ejemplo `1500` se renderiza como `1.500`.

### PR160-H04 — PARCIAL: la entrada nueva corrige la historia, pero vuelve a declarar evidencia no reproducible

La entrada 02:45 reconoce correctamente que Ronda 1 invalidó el E2E mockeado. Sin embargo registra:

- RED y GREEN del test de concurrencia con tiempos;
- RED y GREEN del test de revelación;
- ambos “correspondientes” al SHA `464084a`.

Ese SHA es el commit de revisión anterior y todavía contiene el spec viejo. En la misma entrada se afirma que la ejecución real de Playwright fue bloqueada por el guard fail-closed y que **falta** la corrida en staging.

No es posible usar esos RED/GREEN como evidencia del E2E final. Los checkboxes del DoD deben quedar sin marcar hasta que exista evidencia reproducible del SHA que realmente contiene el arreglo.

### PR160-H05 — PARCIAL: el body ya usa la estructura del template, pero la evidencia sigue incompleta

El body mejoró de forma sustancial, pero marca:

- `pnpm typecheck && pnpm lint && pnpm test` como verificado sin pegar salida de `pnpm test`;
- el DoD E2E como completo aunque el propio body muestra que Playwright fue bloqueado localmente;
- no aporta `pnpm test:db`, obligatorio al tocar `src/server/**`.

Hasta tener las salidas reales y la corrida E2E del SHA corregido, el body no puede marcar esos puntos como completados.

## Hallazgos nuevos / regresiones

### PR160-H06 — La rama quedó 25 commits detrás de develop

**Severidad:** alto · **Patrón:** P10-desvio-de-ficha-sin-consultar

La sesión de arreglo no sincronizó la rama con el `develop` actual. Entre el merge-base y `develop` hay 25 commits; entre los archivos relevantes hay cambios en auth/actions/guards utilizados por el login E2E.

**Arreglo:** sincronizar primero con `origin/develop` sin reescribir historia compartida y volver a validar todos los flujos sobre el nuevo head.

### PR160-R01 — El fixture global vuelve imposible/determinista el test del piso

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice

La fixture crea offers pending para ambos couriers en todas las pruebas. El test del piso usa Courier 0 y luego busca el primer botón “Ofertar”; su propia request no tiene ese botón porque ya ofertó.

**Arreglo:** el escenario del piso debe tener una request propia sin oferta previa del actor y debe identificar/usar datos de esa corrida, sin depender de residuos u otras pruebas de staging.

### PR160-R02 — Las requests creadas por UI quedan fuera del cleanup y pueden romper el teardown

**Severidad:** alto · **Patrón:** P16-cascada-declarada-que-no-cascadea

Los tests de publicación crean una nueva request/contact mediante la UI, pero `stagingContext.createdRequestIds` solo contiene la request creada por el seed. La cleanup borra solo IDs trackeados.

En el esquema, `delivery_requests.merchant_id references merchants(profile_id)` no tiene `ON DELETE CASCADE`; por eso la request no trackeada impide borrar el merchant del test. Lo mismo aplica a offers creadas por UI: `offers.request_id` tampoco cascadea.

**Arreglo:** antes de borrar, descubrir y trackear todos los request IDs pertenecientes al merchant E2E y sus offers/contacts, o registrar explícitamente cada ID creado por UI. Agregar tests de cleanup para datos creados después del seed.

### PR160-H07 — Se introdujeron `any` y non-null assertions nuevas

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice

En cambios de T-303 aparecen nuevos constructos prohibidos por `AGENTS.md`:

- `src/server/e2e/staging-seed.ts`: `createdRequestIds[0]!`, `couriers[0]!.id`, `couriers[1]!.id`, `builder as any`.
- `src/server/e2e/staging-seed.test.ts`: nuevos `as any` y múltiples `[0]!` / `[1]!`.

Los checks declarados no los detectaron.

**Arreglo:** usar narrowing/desestructuración validada y tipos de mocks explícitos; no agregar excepciones de lint.

## Checks de esta ronda

No se ejecutaron `pnpm typecheck`, `lint`, `test`, `test:db` ni Playwright desde esta revisión porque el entorno de revisión no dispone de checkout ejecutable del repo.

Tampoco se usa CI como sustituto en esta ronda porque ya existen bloqueantes estáticos y la metodología indica inspeccionar CI recién cuando la ronda está lista para aprobar.

## Resultado

**CON BLOQUEANTES (8).**

No aprobar ni mergear. La siguiente ronda debe partir de una rama sincronizada con `develop`, con cleanup completo, escenario de piso aislado, concurrencia con oráculo de estado final y evidencia real correspondiente al SHA corregido.
