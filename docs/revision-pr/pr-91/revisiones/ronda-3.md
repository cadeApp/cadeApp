# Ronda 3 — PR #91 (`T-203`) — revisión independiente

- **PR:** #91 · `feat/T-203-emisor-push` → `develop`
- **Tarea:** `T-203` · Issue #30 · ficha oficial releída desde `develop`
- **Autor:** `Lautaro073` (P1)
- **SHA de producto revisado:** `926ca2eeda69dbde24db2494264c64bc524ba9a5`
- **develop:** `42fb54a4df7e6529d1ccee3f96bcfbb0aced6f17`
- **Fecha:** 2026-09-24

## Informe `revisar-pr`

```text
Informe revisar-pr — T-203 — 2026-09-24 — generado por revisión independiente
Resultado: CON BLOQUEANTES (2)
Checks locales: typecheck no ejecutado por el revisor · lint no ejecutado por el revisor · test no ejecutado por el revisor · test:db no ejecutado por el revisor
CI del SHA 926ca2e: unit ✅ · typecheck ✅ · lint ✅ · audit ✅ · db-tests ✅ · build ✅ · bundle-budget ✅
BLOQUEANTES:
- [src/server/push/sender.ts:157-171] (PR91-H08) La ficha exige un emisor Web Push con VAPID, pero si falta la pública o la privada configureVapid omite setVapidDetails y send() llama igual a sendNotification. Los tests siempre mockean keys presentes y nunca afirman setVapidDetails, así que quitar la configuración VAPID completa no rompe la suite → fallar de forma técnica/determinista cuando falte una key, no llamar sendNotification y cubrir setVapidDetails + configuración ausente.
- [package.json:15-17] (PR91-H09) T-203 cambió globalmente test/test:coverage a --testTimeout 15000 para tolerar latencia local; el job unit de CI usa test:coverage, así que también relajó el umbral de CI mientras el checklist afirma que no debilitó checks → revertir ambos timeouts globales y conservar solo web-push; si existe una prueba lenta, resolverla o acotar una excepción justificada a esa prueba.
MEJORAS:
- En el cuerpo del PR, “Checks locales: test:db ✅ (local omitido...)” debería decir explícitamente que el intento local falló por no tener Docker y que el verde proviene de CI. La evidencia CI es real y suficiente para H06, pero el rótulo “local” no debe decir ✅.
No revisado / dudas para Lautaro073:
- Las mutaciones rojas de H02-H05 constan en la bitácora; esta revisión verificó la estructura de las pruebas y el verde final de CI, pero no reejecutó esas mutaciones en un checkout local.
```

## 1. Qué cambió desde la ronda 2

La rama sí incorporó la decisión oficial de alcance: mergeó `origin/develop` con PR #93 y T-203 ahora queda como servicio base; T-206 (#92) absorbe call sites post-commit y lifecycle.

Después se modificaron `sender.ts`, los tests push, la ruta de suscripciones y la bitácora. El diff contra la ronda 2 ya cubre `platform`, `attempts/status`, WebPushTransport, las cinco variantes de payload y las matrices HTTP.

## 2. Revalidación de los 8 hallazgos anteriores

| ID | Estado ronda 3 | Evidencia |
|---|---|---|
| PR91-A01 | **aceptado** | PR #93 / merge `42fb54a` corrigió oficialmente alcance y dependencia |
| PR91-H01 | **arreglado-verificado** | call sites delegados a T-206; `platform` y status por intento implementados |
| PR91-H02 | **arreglado-verificado** | hay assertion positiva de `transport.send` y resultado best-effort |
| PR91-H03 | **arreglado-verificado** | 404/410 rejection, error genérico y 201 ejercen `WebPushTransport` |
| PR91-H04 | **arreglado-verificado** | las 5 variantes se prueban con `SENTINEL_PII` |
| PR91-H05 | **arreglado-verificado** | 200/201, 404/410, 429/500/503 parametrizados |
| PR91-H06 | **arreglado-verificado** | CI `db-tests`: pgTAP PASS, 8 archivos / 1444 tests |
| PR91-H07 | **arreglado-verificado** | bitácora contiene rojo/verde semántico H02/H03/H04/H05A/H05B |

CI del head terminó completamente verde: unit (46 archivos / 422 Vitest), typecheck, lint, audit, db-tests, build y bundle-budget.

## 3. Nuevo bloqueante PR91-H08 — VAPID no está protegido por la suite

`WebPushTransport.configureVapid()` solo llama a `setVapidDetails` cuando existen ambas keys. Las schemas de entorno actualmente permiten que esas variables sean cadenas vacías. Después de `configureVapid()`, `send()` continúa siempre a `sendNotification`.

Los tests de `WebPushTransport` mockean keys válidas, pero no hacen ninguna assertion sobre `setVapidDetails`. Por eso una regresión equivalente a hacer `configureVapid() { return; }` conserva las pruebas de 201/404/410/500.

La ficha actual ya exige explícitamente “Emisor Web Push con runtime Node y VAPID”. El arreglo puede permanecer dentro de `src/server/push/**`: si falta una key, el transporte debe producir un fallo técnico observable y no intentar enviar; además la prueba debe exigir que `setVapidDetails` se ejecute con los valores esperados y no se repita innecesariamente.

## 4. Nuevo bloqueante PR91-H09 — timeout global relajado

El diff de `package.json` no solo agrega `web-push`; cambia:

```text
vitest run
→ vitest run --testTimeout 15000

vitest run --coverage
→ vitest run --coverage --testTimeout 15000
```

La bitácora explica que se hizo para tolerar latencia/concurrencia en Windows. Eso modifica globalmente el control de todas las pruebas y además alcanza CI, porque el job `unit` ejecuta `pnpm test:coverage`.

La regla 00 prohíbe debilitar checks/umbrales para lograr que pasen y el checklist del PR marca lo contrario. T-203 necesitaba permiso sobre `package.json` para instalar `web-push`, no para relajar el timeout global. La corrección es revertir solo esos dos flags.

## 5. CI y evidencia

En el SHA `926ca2e`:

- `unit`: éxito; 46 archivos y 422 Vitest pasan.
- `typecheck`: éxito.
- `lint`: éxito.
- `audit`: éxito.
- `db-tests`: éxito; Supabase local arrancó y pgTAP terminó `Result: PASS` con 8 archivos / 1444 tests.
- `build`: éxito.
- `bundle-budget`: éxito.

No se atribuyen checks locales a esta revisión porque no se obtuvo un checkout ejecutable en el entorno del revisor.

No se aprueba ni se mergea esta PR.
