# Informe revisar-pr — T-410 / CC-037 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/510
**Fecha:** 2026-10-22
**HEAD de código revisado:** `99ab7a8361be54e551a5986d18d4b865b878d86a`
**Base:** `develop` @ `17960c76be5e75c1655a4a2eefe6aad02ad95fd8`
**Resultado: SIN BLOQUEANTES DE CÓDIGO DETECTADOS.** Cierre operativo sujeto a comprobar `db-tests` del SHA revisado (seguía en curso).
**Método:** comparar contra ronda 1, revisar fuentes exactas/test/bitácora, leer logs CI. No hubo clon ni mutaciones independientes: el contenedor no resuelve github.com.
**No aprobado ni mergeado.**

## H01 — Pruebas reales del fake / cobertura

En `src/domain/cc037-admin-list-trips.test.ts` ya se invoca `createFakeRpcClient().admin_list_trips` sobre fixtures reales: `problems` y `all`, cinco clases de problemas, conteos, legacy, oferta aceptada, borrador, keyset con empate en `createdAt` e ID, errores AAL2/UNAUTHORIZED/VALIDATION. Se amplían tests, no umbrales.
**[CI verificado]** Run `39737258624`, job `119686111134`, HEAD `99ab7a83`: `Test Files 164 passed (164)`; `Tests 3254 passed (3254)`; `rpc-fake.ts` branches **90,96 %** sobre mínimo 90 %. H01 queda `arreglado-verificado` para el umbral y los casos ejecutados por CI.

## H02 — Entrega legacy / finalización sin resultado

`src/features/admin-trips/problems.ts`: `tripDropsForDisplay` representa una entrega si `drops` está vacío; solo marca entregada si la solicitud está `delivered`. `dropDisplayStatus` distingue legacy sin resultado (`noRecord`) de entrega *real* `pending` tras cancelación o vencimiento (`notDelivered`). La UI muestra `Entrega 1` con `Entregada` cuando corresponde y `Sin resultado individual registrado` cuando no hay resultado. Los tests nuevos de componentes y helpers verifican estas etiquetas. No se inventan motivos ni datos del destinatario.
**[Inspección + CI]** No se reprodujo de forma independiente el RED de la mutación M12/M13. Estado estructurado: `arreglado-sin-verificar` conforme el requisito estricto de verificación independiente, aunque no se detecta fallo remanente.

## H03 — Mock .eq() y aislamiento por solicitud

`src/features/admin-trips/queries.test.ts`: `.eq()` ahora registra predicados y filtra rows con su columna; existe fixture adversaria de otra solicitud con drop, motivo e incidente. Los nuevos tests comparan los filtros exactos por `delivery_requests.id`, por `request_id` de drops/motivos/incidentes y por ID de oferta. Se comprueba también que no hay lectura de oferta si la solicitud carece de `accepted_offer_id`.
**Límite menor:** el mock deja pasar filas que no tienen la columna filtrada (`!(column in row) || ...`); en los casos adversarios esta columna existe y los predicados se asertan. Es posible endurecerlo más adelante; no constituye fuga de producción demostrada.
**[Inspección + CI]** Los RED de M14/M15 son declarados por el autor, no reproducidos por el revisor. Estado `arreglado-sin-verificar` por ese límite de evidencia.

## H04 — Contrato CC-037 y alcance

La línea `Fake de dominio a actualizar: sí` conserva la corrección documental aprobada en `017da834`; se resolvió el conflicto intermedio sin marcadores en el HEAD final. La ampliación 1-A fue decidida expresamente por Lautaro073 en ronda 1; no se reabre ni se exige separar archivos.

## Mutaciones M6–M15 — tratamiento de evidencia

El autor registra en `docs/tasks/log/T-410.md` sus diez mutaciones RED→GREEN, incluidas las cuatro pedidas: predicado `failedDrops`, desempate keyset, render legacy vacío y omisión de `.eq` de drops. La revisión confirmó que los tests que deberían detectar esas fallas existen, pero **no ejecutó ni confirmó los rojos de nuevo**. No se presentarán como mutaciones independientes del revisor.

## Checks del HEAD de código

| Check | Resultado |
|---|---|
| unit | ✅ `3254/3254`, 90,96 % branches del fake |
| typecheck, lint, build, audit, bundle-budget | ✅ success |
| db-tests | ⏳ en curso en la consulta al documentar; antes del merge comprobar `cc037_admin_list_trips.sql ... ok`, `Files=`, `Tests=`, `Result: PASS`, verificación de tipos |
| approval-policy | ❌ faltaba un informe completo `SIN BLOQUEANTES` antes de esta ronda, no un error de código |
| e2e-preview | ⚠️ bloqueado por migración no aplicada en Supabase Develop; excepción de rollout registrada |

El PR informa `mergeable=true` sobre `99ab7a83`. No se ejecutó `git merge-tree` local. No se exige otro CI completo únicamente porque este informe se comitee (regla de operación).

## NO TOCAR / obligaciones posteriores

- No debilitar tests, umbrales, RLS, schemas estrictos ni lecturas privadas. No introducir datos del destinatario.
- Ninguna decisión nueva de producto. No se requiere otro prompt correctivo al agy; los cambios de H01–H03 ya constan en SHA revisado.
- **Antes de merge:** confirmar resultado final `db-tests` del SHA revisado. `approval-policy` debe reconocer este informe.
- **Después de merge y `migrate-develop`, antes de promover:** ejecutar E2E con admin MFA según ficha; detener promoción si falla. Este paso sigue pendiente y debe ser visible para Lautaro073.
- Repetir las mutaciones independientemente en un clon accesible para elevar H02/H03 a `arreglado-verificado`, si se necesita la certificación estricta. No falsificar ni reutilizar los RED del autor.

**Conclusión:** sin regresiones bloqueantes detectadas en los arreglos de ronda 1, con límites de evidencia anteriores explícitos.
