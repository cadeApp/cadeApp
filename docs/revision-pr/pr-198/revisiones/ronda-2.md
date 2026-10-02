# Ronda 2 — PR #198 / T-306

**Fecha:** 2026-10-02  
**SHA funcional:** `5ad81b8e13191c4ef9bc2d96339bf8dea30723ea`  
**Base develop:** `ff5c51f7edd003c152f56a2bd2edc0cf2feab698`  
**Resultado:** SIN BLOQUEANTES

## Sincronización y alcance

- rama 12 commits ahead / 0 behind;
- mergeable;
- el diff ya no modifica `.github/workflows/e2e-preview.yml`: T-329 absorbió esa infraestructura en `develop`;
- los cambios propios de T-306 quedan limitados a su spec, ficha/bitácora y artefactos de revisión.

## Cierre de hallazgos

- **H01:** cerrado. T-329 (`ff5c51f`) hace que el workflow confiable ejecute el spec opcional desde el SHA exacto. Run `37052602334` demuestra ejecución real.
- **H02:** cerrado. El negativo usa `pilot_active=false`, `subscription_status='active'` y fecha pasada.
- **H03:** cerrado. Los positivos consultan la fila exacta y exigen `status='published'`.
- **H04:** cerrado. El negativo filtra por `notesMarker`.
- **H05:** cerrado. PR temporal #216 / commit `2687be1` omitió realmente `publish_request`; run `37053309856` quedó RED. La PR temporal fue cerrada sin merge.
- **H06:** cerrado. Lectura/update/restauración de `pilot_active` son fail-closed y restauran el valor exacto.
- **H07:** cerrado. Hay CI, GREEN E2E real y RED de mutación real con run IDs verificables.

## Evidencia GREEN real

Run `e2e-preview` **37052602334** sobre `5ad81b8`:

```text
gate core: 9 passed

Running 3 tests using 1 worker
✓ DoD 1: piloto apagado + paid_until vencido no publica
✓ DoD 2: piloto encendido sí publica
✓ DoD 3: piloto apagado + paid_until futuro sí publica

3 passed (44.8s)
```

CI baseline **37052337255**: success.

## Evidencia RED real

PR temporal **#216**, commit `2687be147930c5d9adcd71bf975ce6a4eebc579b`.

Única mutación funcional: eliminar la llamada a `publish_request` y permitir que la action continúe a éxito.

Run `37053309856`:

```text
gate core: 9 passed

Running 3 tests using 1 worker
DoD 1: FAILED
retry #1: FAILED
retry #2: FAILED
Expected alert SUBSCRIPTION_INACTIVE: visible
Received: element not found
```

El fallo es correcto: sin la RPC, el caso que debía ser rechazado deja de producir el error de dominio. Como el describe es serial, DoD 2 y DoD 3 quedan omitidos después del primer fallo. La propiedad pedida —que la suite real falle al quitar `publish_request`— queda demostrada.

PR #216 quedó **closed / not merged**.

## Conclusión

Los siete bloqueantes de Ronda 1 están cerrados. T-306 está lista para merge por Lautaro073. No se hace merge desde la revisión sin pedido explícito.
