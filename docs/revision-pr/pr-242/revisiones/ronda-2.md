# Informe de revisión — PR #242 / T-325 hotfix — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/242  
**SHA revisado:** `3c469698bd551cd42022b3388562b935431e2999`  
**Base:** `develop` @ `b4119ef3e16170decda0a1649fc35db207faa8b0`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTE RESIDUAL (1)**

## Arranque

- Desde el commit de revisión R1 `a8a855ac...` hay **1 commit** del autor.
- Ese commit toca únicamente archivos autorizados por el prompt de Ronda 1.
- El autor no tocó `docs/revision-pr/pr-242/**`: los blobs de R1 permanecían iguales al iniciar R2.
- GitHub reporta la PR mergeable.
- Vercel Preview del SHA corregido está Ready.
- No hay decisiones 🔵 pendientes.

## Resumen

| ID | Estado R2 | Evidencia |
|---|---|---|
| PR242-H01 | arreglado-verificado | test de página real + CI exact-head 3/3 |
| PR242-H02 | arreglado-verificado | prop contextual + tests en StatusView y CourierFeed + CI exact-head |
| PR242-H03 | arreglado-verificado | guard de authError + test que evita filtrar detalle + CI exact-head |
| PR242-H04 | abierto | bitácora/cuerpo/evidencia siguen en el estado previo |

---

## PR242-H01 — cerrado

**Estado:** `arreglado-verificado`

Se agregó `src/app/(courier)/courier/feed/page.test.tsx` y el test ejecuta `CourierFeedPage` con módulos mockeados; no inspecciona source como texto.

Casos cubiertos:

- pending + `courier-123`: `getCourierDocumentsStatus('courier-123')` una vez y el array exacto llega a `CourierFeed.documents`;
- approved: no consulta documentos y `documents` queda `undefined`;
- authError: la página rechaza antes de renderizar `CourierFeed`.

CI #1076 del SHA exacto ejecutó:

`src/app/(courier)/courier/feed/page.test.tsx (3 tests)`

y la suite completa terminó:

`117 passed files · 1781 passed tests`.

El control ahora alcanza la frontera productiva que faltaba.

---

## PR242-H02 — cerrado

**Estado:** `arreglado-verificado`

`StatusViewProps` incorpora `showFeedButton?: boolean` con default `true`.

- `/courier/onboarding/status` conserva el comportamiento anterior porque no pasa el prop;
- `CourierFeed` pending monta `<StatusView ... showFeedButton={false} />`;
- `components.test.tsx` afirma el botón por default y su ausencia con `false`;
- `courier-panel.test.tsx` afirma que el feed pending no contiene «Ir al panel de repartidor».

CI exact-head ejecutó esas suites dentro de 1781/1781 verdes.

---

## PR242-H03 — cerrado

**Estado:** `arreglado-verificado`

`getPendingCourierDocuments` ahora captura `authError` y lanza:

`Error al verificar sesión del repartidor`

sin interpolar `authError.message`.

El test inyecta un error que contiene `JWT expired: token sb-secret-detail` y exige que:

- la promesa rechace con el mensaje estable;
- el rechazo no contenga `JWT` ni `sb-secret`;
- no se consulte `getCourierDocumentsStatus`;
- no se renderice `CourierFeed`.

H03 queda cerrado.

---

## PR242-H04 — BLOQUEANTE residual · entrega/evidencia

**Archivo:** `docs/tasks/log/T-325.md:128`  
**Patrón:** `P03-comentario-contradice-codigo`

### Qué pasa

La implementación y CI avanzaron al SHA `3c469698bd551cd42022b3388562b935431e2999`, pero la entrega documental quedó congelada en el commit anterior:

- `docs/tasks/log/T-325.md` termina con la sesión inicial del hotfix y **no registra** los arreglos H01/H02/H03, las mutaciones ni los checks posteriores;
- el cuerpo de la PR todavía muestra `pnpm test → 1 failed | 1776 passed`, build `160 kB` y «Pendiente: verificar en navegador», aunque CI exact-head ya dio 1781/1781, bundle 159 kB y Vercel está Ready;
- el cuerpo marca `[x] Bitácora ... al día`, pero la bitácora no tiene una entrada posterior a R1;
- los tres DoD agregados por la propia Ronda 1 siguen en `[ ]` pese a que el código/tests ya los cumplen;
- no existe `360-06-feed-pending-real-docs.jpg` ni una entrada equivalente en el README de evidencia, aunque el Preview está disponible.

La skill `revisar-pr` clasifica «checks sin salida pegada o bitácora sin la sesión final» como bloqueante. No es un defecto del producto; es un cierre de entrega incompleto.

### Arreglo

No tocar código ni tests.

1. Verificar en navegador real el Preview actual con un courier `pending` de Develop que tenga licencia/seguro persistidos.
2. Capturar `360-06-feed-pending-real-docs.jpg`.
3. Actualizar el README de evidencia.
4. Agregar una nueva entrada append-only en la bitácora con H01/H02/H03, mutaciones del autor, checks exactos y evidencia.
5. Marcar en la ficha los tres DoD nuevos como `[x]` solo después de esa evidencia.
6. Actualizar el cuerpo del PR con los resultados actuales y quitar «Pendiente» si la verificación se completó.

---

## CI exact-head auditado

### CI #1076

- lint: success;
- typecheck: success;
- unit/coverage: **117 files / 1781 tests, todos verdes**;
- build: compiled successfully;
- `/courier/feed = 159 kB`;
- bundle-budget: `/courier/feed | 159 kB | OK`;
- DB job: success (no hay cambios DB).

Las rutas admin de 235 kB siguen como advisory preexistente y están fuera de T-325.

### E2E Preview

- Vercel: success;
- `e2e-preview`: success;
- status publicado sobre `TARGET_SHA=3c469698bd551cd42022b3388562b935431e2999`;
- Chromium: un caso T-303 falló una vez por timeout al salir de `/login` y pasó en retry;
- global-settings: 3/3.

El flaky no toca T-325 y quedó registrado en **issue #245** para cumplir la regla 40. No bloquea esta PR.

## Checklist R2

- [x] H01 corregido y ejecutado en CI exact-head.
- [x] H02 corregido y ejecutado en CI exact-head.
- [x] H03 corregido y ejecutado en CI exact-head.
- [x] Bundle real <= 180 kB.
- [x] Vercel Ready y E2E status sobre SHA exacto.
- [x] Flaky ajeno registrado en issue #245.
- [ ] Bitácora final del arreglo.
- [ ] Browser real del hotfix + captura.
- [ ] README evidencia actualizado.
- [ ] Cuerpo de PR actualizado al SHA/checks actuales.
- [ ] DoD nuevos marcados según evidencia.
- [ ] Ronda final.

## Resultado

**Código del hotfix: sin bloqueantes conocidos.**  
**Entrega de la PR: bloqueada por H04 hasta completar evidencia/bitácora.**
