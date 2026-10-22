# PR #362 / T-353 — Informe de revisión independiente Ronda 6

- **Fecha:** 2026-10-15
- **SHA de P2 inspeccionado:** `20de71c1e5c9431cfb7ac8207a468879093d550d`
- **Base:** `develop@14c28ed3c41cb2bde92705fc018c7dd0df73245b`
- **Delta desde R5:** `db71f028..20de71c`: **solo** `docs/tasks/log/T-353.md`, +23 líneas; ningún archivo de producción, schema, E2E o workflow modificado.
- **Resultado:** **CON BLOQUEANTES (1): PR362-H06**.
- **Método:** inspección independiente de GitHub Actions completo sobre SHA exacto + código fuente; sin Vitest local, Supabase local, modificaciones de producción ni mutaciones E2E.
- **Decisiones P1:** 1B monto máximo INTEGER; 2A `walk/bike` patente null; no nuevas decisiones.

## Evidencia E2E real (ya no falta dispatch)

Workflow `e2e-preview` [38688520658](https://github.com/cadeApp/cadeApp/actions/runs/38688520658), disparado por `repository_dispatch` de `cadeapp-develop` para `20de71c1e5c9431cfb7ac8207a468879093d550d`:
- `resolve-preview` job **116268809672**: success.
- `e2e-preview` job **116268870636**: **failure**.
- `report-preview-status` job **116276249321**: success; commit status exact-head `e2e-preview=failure`.
- Vercel Preview `cadeapp-develop`: status success en el mismo SHA.
- GitHub CI run **38688423087**, **7/7** unit / db-tests / lint / typecheck / build / audit / bundle-budget success. `approval-policy`: failure por aprobación P1 pendiente, no se toca.
- En Playwright `--project=chromium --workers=1`: **76 tests previstos, 75 pasaron, 1 falló tras 2 retries** (misma aserción 3 veces).
- Pasaron expresamente el test de T-353 `courier-onboarding.spec.ts:672` y T-345 de acceso real a columnas privadas `courier-private-columns.spec.ts:32`. **El test de T-353 multi-drop falló**. El segundo comando `global-settings` no corrió por el exit 1 del proyecto chromium.

## PR362-H06 — análisis causal, bloqueante

**Lugar exacto:** `e2e/specs/multi-drop.spec.ts:1083–1105`, línea **1099**.

El test deriva el ID creado por diferencia de IDs (correcto), hace
```ts
const { data: createdReq } = await admin
  .from('delivery_requests')
  .select('*')
  .eq('id', newRequestId)
  .single();

const rawReqString = JSON.stringify(createdReq);
for (const key of FORBIDDEN_PRIVATE_KEYS) {
  expect(rawReqString).not.toContain(`"${key}"`);
}
assertNoPrivateFieldsInRawPayload(createdReq, [
  '3865123456', 'Av. Sarmiento 101', 'Destinatario Prueba',
]);
```

El test mezcla **dos fronteras de autorización**: `createAdminClient()` usa service role y trae todas las columnas del esquema, incluso `notes:null` y `cash_change_amount:null`, mientras `FORBIDDEN_PRIVATE_KEYS` y `assertNoPrivateFieldsInRawPayload` están documentadas en `src/server/live/privacy-checker.ts` para **payloads crudos públicos de red** antes de la transformación Zod. La ausencia de la **clave** `notes` en el registro administrativo no es un invariante válido. El log marca exactamente `Expected substring: not "\"notes\""` y presencia de `"notes":null`, sin demostrar exposición pública. Los otros E2E de privacidad, sobre actores reales y PostgREST/Realtime (T-345), pasaron.

**No afirmar que se comprobó seguridad global ni que no existe fuga:** este fallo concreto es falso positivo de aserción y no demuestra fuga. Los resultados T-345 respaldan la protección de esas columnas en sus escenarios, no una prueba de toda ruta del producto.

**Corrección recomendada (sin debilitar la privacidad):**
1. Mantener `.select('*')` con service role para inspeccionar DB completa y su correlación exacta con `newRequestId`.
2. Reemplazar **solo** el bloque `rawReqString / FORBIDDEN_PRIVATE_KEYS / assertNoPrivateFieldsInRawPayload(createdReq,...)` de líneas 1096–1105 por comprobaciones **válidas para DB**, por ejemplo:
```ts
// Las columnas legacy siguen presentes en la tabla física, pero no guardan
// indicaciones privadas ni montos de cambio del nuevo pedido.
expect(createdReq.notes).toBeNull();
expect(createdReq.cash_change_amount).toBeNull();

const persistedRequestPayload = JSON.stringify(createdReq);
for (const privateValue of [
  '3865123456',
  'Av. Sarmiento 101',
  'Destinatario Prueba',
]) {
  expect(persistedRequestPayload).not.toContain(privateValue);
}
```
3. **NO eliminar los imports `FORBIDDEN_PRIVATE_KEYS` ni `assertNoPrivateFieldsInRawPayload`**: son usados antes en otros tests de `multi-drop.spec.ts` para comprobar **payloads públicos auténticos**. No editar ese código.
4. Conservar intactos: `beforeIds`, `afterInvalidIds`, `newIds.length===1`, `trackEntityForCleanup`, `status`, `drops_count`, drop y contacto privado `recipient_phone==='3865123456'`, así como el test T-353 DNI.
5. Mantener T-345 sin cambios: verifica que el repartidor no puede seleccionar `notes`, `cash_change_amount` ni `*` con token normal, y su prueba corrió GREEN. No sustituir pruebas de autorización real por consulta admin.
6. Registrar sesión append-only en la bitácora con SHA/run real; pruebas RED actual (**ya visible, no inventar mutación E2E insegura**) y GREEN real posterior. E2E mutantes de seguridad solo por workflow `e2e-mutation` protegido y autorizado.
7. **No poner en verde manualmente** `e2e-preview`; desplegar Preview automático de la rama y esperar run íntegro `chromium` y `global-settings` con status `success` sobre SHA exacto. Si falla por cola, reintentar run existente según procedimiento sin tocar secretos ni staging.

## Comprobaciones finales y limitaciones

- Este error del test no invalida los **75 E2E efectivamente verdes**, pero sí impide declarar que el **gate completo** pasó.
- H01–H05, H07, H08 siguen `arreglado-sin-verificar` (inspección previa, no reproducción de sus mutantes por este revisor). H06 `parcial`, `verificado_en_sha=null` porque el arreglo está pendiente. La revisión SÍ verificó independientemente la salida RED existente.
- No hay otros hallazgos nuevos de código en el commit documental. No se necesitan nuevas decisiones de producto.
- **NO APROBAR NI MERGEAR**. `approval-policy` requiere aprobación vigente de Lautaro073 después de terminar la revisión.
