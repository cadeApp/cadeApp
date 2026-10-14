# Ronda 1 — PR #180 / T-307

**Fecha:** 2026-10-01  
**SHA funcional revisado:** `a62abb26d5fbde522f7cf41a2363e0b2e0b30126`  
**Resultado:** **CON BLOQUEANTES (3)**

## Sincronización y alcance

- PR #180: `feat/T-307-notificaciones-resiliencia` → `develop`.
- Al revisar, la rama estaba **5 commits ahead / 9 behind** respecto de `develop`; GitHub la reportaba mergeable, pero debe integrar `origin/develop` antes de la siguiente ronda.
- El delta funcional permitido es `e2e/specs/notifications.spec.ts`, ficha/bitácora T-307 y entregables de revisión.
- `docs/implementation-plan.md §8` exige T-206 como dependencia de T-307 y la ficha la omitía. Lautaro073 resolvió **D01 = 1-A**: agregar T-206 en la ficha durante la corrección. T-206 ya está mergeada, así que no agrega trabajo funcional.
- El autor había escrito `docs/revision-pr/pr-180/**` y firmado su propia ronda como “SIN BLOQUEANTES”. Esa evidencia se invalida como revisión independiente y se conserva en `autorrevision-agy-r1.md`.

## Evidencia focal

Se auditó el control actual con un harness independiente en `/tmp/pr180-control-audit.mjs`:

```text
H01 CONTROL VERDE sin UI ni Realtime: direct fetch/mock basta
H02 CONTROL VERDE sin refetch de TanStack: /api/health autogenerado basta
```

Esto demuestra el problema del instrumento: las dos propiedades centrales pueden quedar verdes sin que exista el comportamiento de aplicación que el DoD dice medir.

No se ejecutó la batería completa `pnpm typecheck && pnpm lint && pnpm test` en esta ronda: hay bloqueantes de diseño de prueba y el protocolo difiere CI completa hasta que la ronda esté en condición de aprobar. No se levantó Docker ni Supabase local.

## BLOQUEANTES

### PR180-H01 — El caso “Realtime” no ejerce Realtime ni la UI
**Severidad:** alto · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Archivo:** `e2e/specs/notifications.spec.ts:24-86`

El test intercepta `/api/live/requests/:id/offers`, cambia una variable local `offerDelivered` y ejecuta dos `fetch()` manuales desde `page.evaluate`. Está parado en `/login`: no monta `RequestOffersList`, no observa una tarjeta de oferta y no depende de `useRealtimeInvalidation`.

Por eso el control puede pasar aunque se elimine por completo la suscripción Realtime de la aplicación. La prueba debe abrir el detalle real de una solicitud de un comercio autenticado, insertar una oferta de prueba después de montar la pantalla y esperar que **la UI** muestre esa oferta sin reload, polling manual ni `fetch()` disparado por el propio spec.

### PR180-H02 — El supuesto refetch de reconexión se autofabrica
**Severidad:** alto · **Categoría:** test-coverage · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Archivo:** `e2e/specs/notifications.spec.ts:130-155`

`refetchOccurred` acepta cualquier URL que contenga `/api/` o `_rsc`; inmediatamente después el propio test ejecuta `fetch('/api/health')`. Esa llamada satisface la bandera aunque ninguna query de TanStack se refresque. Además, `expect.poll` acepta como éxito `navigator.onLine`, que tampoco demuestra refetch.

El control debe observar **el endpoint exacto de una query activa** (por ejemplo `/api/live/requests/<id>/offers`) y exigir una petición nueva causada automáticamente por `setOffline(false)`, sin click en “Reintentar”, sin `/api/health` manual y sin fallback a `navigator.onLine`.

### PR180-H03 — El DoD declara `pnpm test` cumplido sin evidencia coherente
**Severidad:** medio · **Categoría:** conventions · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Archivos:** `docs/tasks/T-307.md`, `docs/tasks/log/T-307.md`, cuerpo del PR

La ficha marca `pnpm typecheck && pnpm lint && pnpm test` como completado, pero la evidencia adjunta solo pega typecheck, lint y el spec E2E. La bitácora, a la vez, registra `test ❌ (1579 passed, 2 preexistentes ...)`. No puede quedar un checkbox cerrado con evidencia contradictoria.

Después de arreglar los E2E hay que ejecutar el comando exacto del DoD, registrar su resumen real y marcarlo solo si termina en verde. Si falla, se documenta el fallo; no se altera, silencia ni fabrica una prueba para obtener verde.

## Hallazgo de proceso resuelto por la revisión

### PR180-H04 — El autor escribió la carpeta de revisión
**Severidad:** medio · **Categoría:** conventions · **Patrón:** P08-control-no-cubre-lo-que-dice

El commit `f584d36076850f5dfef94dd8adec265d3e7a1f75` fue hecho por asako669 y agregó `docs/revision-pr/pr-180/**`, incluyendo una ronda autofirmada “SIN BLOQUEANTES”. Conforme a AG-36, la ronda se preserva como `autorrevision-agy-r1.md` y la carpeta vuelve a ser propiedad de la revisión independiente. El autor no debe tocar `docs/revision-pr/**` en la corrección.

## MEJORAS / decisión aplicada en la corrección

- **D01 = 1-A:** en `docs/tasks/T-307.md`, agregar T-206 a “Dependencias (mergeadas en develop)” para sincronizar la ficha con `docs/implementation-plan.md §8`.

## Informe revisar-pr

Informe revisar-pr — T-307 — 2026-10-01 — generado por revisión independiente  
Resultado: CON BLOQUEANTES (3)  
Checks locales: typecheck ⏭️ · lint ⏭️ · test ⏭️ · test:db n.a. · auditoría focal del control ✅

BLOQUEANTES:
- [`e2e/specs/notifications.spec.ts:24-86`] PR180-H01: el test de “Realtime” prueba un mock + fetch manual y nunca la UI/Realtime real → convertirlo en E2E observable sobre el detalle real de solicitud.
- [`e2e/specs/notifications.spec.ts:130-155`] PR180-H02: `/api/health` generado por el test satisface `refetchOccurred` → medir solo el endpoint exacto de la query activa y reconexión automática.
- [`docs/tasks/T-307.md` + bitácora/body] PR180-H03: `pnpm test` está marcado cumplido sin evidencia coherente → correr el comando exacto y documentar el resultado real.

MEJORAS:
- D01=1-A: sincronizar la dependencia T-206 en la ficha.
- La rama debe integrar `origin/develop` antes de la siguiente ronda.

No revisado / dudas para Lautaro073:
- ninguna; D01 quedó resuelta como 1-A.
