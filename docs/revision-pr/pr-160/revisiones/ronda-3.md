# Ronda 3 — PR #160 / T-303

**Fecha:** 2026-10-01  
**SHA revisado:** `01476eb56b7ec962d488cd087b6d7abc5f31ca53`  
**Resultado:** **CON BLOQUEANTES (6)**

## Sincronización y alcance

- La rama está sincronizada con `develop`: ahead 11 / behind 0.
- El merge-base es el `develop` actual: `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`.
- El diff propio de la PR queda limitado a T-303, los archivos autorizados por la decisión 1-A y la carpeta de revisión.
- No se miró CI para cerrar esta ronda porque todavía existen bloqueantes estáticos.

## Estado de Ronda 2

- **H01:** arreglado sin verificar. Ya no hay mocks integrales del flujo.
- **H02:** arreglado sin verificar. Hay `Promise.all`, error específico y oráculo server-side con `expect.poll`.
- **H03:** parcial. Quedan huecos concretos registrados en H08-H10.
- **H04:** sigue bloqueante. La evidencia nueva usa un escenario simulado con dos ofertas accepted; no demuestra que el E2E final falle al romper la implementación real.
- **H05:** sigue bloqueante. El body no muestra salida de `pnpm test`, no tiene db-tests CI verde ni corrida real de Playwright staging, aunque mantiene checks relacionados marcados.
- **H06:** arreglado y verificado por comparación remota (behind 0).
- **R01:** arreglado sin verificar. El fixture base ya no precrea offers y el piso identifica la request propia.
- **R02:** arreglado sin verificar para requests/offers/contacts creados por UI.
- **H07:** arreglado y verificado por diff; no hay nuevos `any`, `@ts-ignore` ni non-null assertions en código T-303.

## Bloqueantes de Ronda 3

### PR160-H08 — Publicación cash: selector incorrecto y oráculo ambiguo

En `e2e/pages/merchant.page.ts`, `changePresetButton(5000)` busca `/paga con.*5000/i`, pero la UI renderiza `Paga con: $ 5.000` mediante `formatArs(5000)`. El selector no coincide.

Además, tras publicar, el test busca globalmente “Paquete chico” y “Efectivo”. La fixture ya contiene una request previa con exactamente esos valores, por lo que las aserciones pueden quedar verdes aunque la request recién creada persista datos incorrectos.

**Arreglo:** usar el formato ARS real en el selector y marcar la request creada por UI con un valor único de la corrida; luego localizar esa fila y verificar allí paquete, medio de pago y cambio.

### PR160-H09 — Ordenamiento: solo comprueba que los resultados sean distintos

El test termina con:

```ts
expect(orderDoc[0]).not.toBe(orderPrice[0]);
```

Eso pasa con dos algoritmos incorrectos mientras devuelvan primeros elementos diferentes. El seed conoce qué courier tiene doc level 2 y cuál tiene el precio menor.

**Arreglo:** afirmar el courier esperado para “Documentación” y el courier esperado para “Precio”, además del estado `aria-pressed`.

### PR160-H10 — El flujo de viaje no puede cambiar de merchant a courier en la misma sesión

Flow 5 hace `loginAsMerchant(page)` y luego `loginAsCourier(0, page)`. El segundo helper navega a `/login`, pero el guard actual redirige una sesión merchant activa a `/merchant/dashboard`; por lo tanto el formulario para iniciar sesión como courier no está disponible.

Además el test de “Avisar a mi cliente” solo verifica host + teléfono y no el contenido esperado del mensaje.

**Arreglo:** usar contextos de navegador separados para merchant y courier (o un logout real) y comprobar también el mensaje generado: monto aceptado, nombre del repartidor y medio de pago.

### PR160-R03 — Cleanup incompleto de efectos secundarios reales

Las acciones E2E reales generan filas auxiliares:

- `publish_request` → `rate_limits` + `audit_log`;
- `submit_offer` / `withdraw_offer` → `rate_limits`;
- `mark_picked_up` / `mark_delivered` → `audit_log`.

El cleanup actual no borra esas tablas. `audit_log.actor_id` usa `ON DELETE SET NULL`, así que borrar el profile conserva el audit row; `rate_limits.subject` es texto y no tiene FK.

**Arreglo:** limpiar únicamente las filas auxiliares asociadas a los user IDs/request IDs de la corrida y agregar unit tests que prueben que no se tocan filas ajenas.

## Evidencia

- `develop...head`: behind 0.
- `formatArs(5000)` produce `$ 5.000`.
- El guard de auth redirige `/login` al dashboard cuando ya existe sesión.
- Las migraciones muestran los writes a `rate_limits` y `audit_log`.
- La evidencia del autor declara typecheck/lint y 36 tests del seed verdes, pero `test:db` está rojo localmente y Playwright solo fue listado.

## Resultado

**CON BLOQUEANTES (6).** No aprobar ni mergear.
