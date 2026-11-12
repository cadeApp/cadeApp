# Ronda 3 — PR #711 · T-434 / CC-050 · SEC-09

**Fecha:** 2026-11-12 · **Revisión independiente:** ChatGPT · **SHA examinado:** `419ab9065e249e2865fdf53c173923ef6352bf3d` (bitácora) · **Código:** `330c317870f484a9a1cbf6d0e94e54b2800a57a7` · **Base:** `develop@c41129d321ccdcd1cd4ab8664d942af63c82d402`.

**Resultado: SIN BLOQUEANTES**, por inspección de código y contraste de CI oficial. No se ejecutaron Vitest ni pgTAP en un checkout separado: los estados JSONL permanecen `arreglado-sin-verificar` y esta limitación se declara explícitamente.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-434 — 2026-11-12 — generado por revisión independiente
Resultado: SIN BLOQUEANTES
Checks locales: typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db no ejecutado localmente
CI del autor en SHA de código 330c3178 (run 43222179409): typecheck ✅ · lint ✅ · unit 209 archivos / 3961 tests ✅ · db-tests 47 archivos / 3958 pgTAP ✅ (cc050 99; cc034 51) · build ✅ · audit ✅ · bundle-budget ✅ · regeneración de database.types.ts sin diff ✅.
BLOQUEANTES:
- Ninguno abierto en esta ronda.
MEJORAS:
- A08, alcance documental subsanado por el revisor: se registra el cambio necesario de supabase/tests/integration/cc034_concurrency.mjs en ficha, CC-050 y plan de esta rama. src/features/admin/copy.ts ya estaba permitido.
No revisado / dudas para Lautaro073:
- CI GREEN pertenece a 330c3178, no a 419ab906 ni al nuevo commit documental. No pedir un GREEN adicional solo por la documentación.
- Mutaciones locales TS del autor no fueron reproducidas por el revisor. La evidencia propia es inspección de invariantes y mutaciones estáticas en memoria; no ejecución funcional propia de PostgreSQL/React.
- No se ejecutó merge-tree ni el analizador global de revisión en checkout local. GitHub informó mergeable=true en el head examinado.
- E2E del ambiente Develop queda para después de merge y migrate-develop; no se considera verde hoy.
~~~

## Seguimiento R1 y R2

| Hallazgo | Situación en código 330c3178 |
|---|---|
| H01 | La RPC admin_decide_courier bloquea pending sin envío antes del update/audit; la UI y el fake lo respetan |
| H02 | Búsquedas de disputa por POST/Server Actions, sin querystring con teléfono o DNI |
| H03 | Resolución de reserva por HMAC calculado en servidor, RPC admin aal2 con salida y auditoría acotadas |
| H04 | Retirado en R1 al confirmar el commit del revisor f9741d34 |
| H05 | Fake permite elegibilidad con cualquier documento, incluso histórico |
| H06 | **Corregido en R3**: versiones por formulario y eliminación de resultados obsoletos |
| H07 | **Corregido en R3**: reinstate requiere envío verdadero y DNI HMAC presente |
| A08 | Ampliación documental acotada del runner existente de concurrencia, resuelta en este cierre |

### H06 — Control del caso consultado

En `src/features/admin/components/dispute-candidates.tsx:37-72,90-123` hay dos versiones mediante `React.useRef`. Editar cualquiera de los inputs llama a `invalidateResults()`: aumenta **ambas** versiones y limpia ambos paneles. Cada Server Action recibe la copia del valor al enviar, y la respuesta sólo se aplica cuando el `requestId` del submit aún coincide con su referencia. El submit del otro formulario no invalida por sí mismo el primero.

La suite `dispute-candidates.test.tsx` cubre edición de DNI, edición de teléfono con resultados en ambas secciones, promesa demorada y resoluciones invertidas. El autor informa mutaciones sin reseteo y sin chequeo post-`await`: cada una provoca 2 fallos de 11. No se reprodujo su ejecución Vitest de forma independiente. En el arnés del revisor se manipularon **en memoria** ambos `onChange` y las dos guardas posteriores al `await`: los controles estructurales cambiaron de PASS a RED.

### H07 — Segunda ruta a approved cerrada

En `supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql:221-238`, `admin_reinstate_courier` conserva `FOR UPDATE` y exige `application_submitted` verdadera y `dni_hmac` no nulo antes de la escritura y auditoría. El fake impide lo mismo con `!applicationSubmitted || !hasDni`. El detalle no muestra Reactivar/Reconsiderar a rechazados/suspendidos no enviados; **Liberar DNI** conserva su condición independiente. El texto de la nota se ubicó en `src/features/admin/copy.ts`, ya autorizado.

`supabase/tests/cc034_admin_reinstate_courier.sql` tiene ahora `plan(51)`; los dos positivos históricos se convierten en fixtures enviadas con DNI sin eliminar aserciones y existe un negativo `courier_rej_unsent`. `cc050_courier_dni_hardening.sql` llega a 99 pruebas, incluida la fixture **sin enviar pero con DNI** que aísla la guarda de envío. El primer intento de mutación #733 no resultó RED porque un DNI nulo también bloqueaba la transición: **falló el diseño del control, no el código**. El reintento #734 (run [43222239668](https://github.com/cadeApp/cadeApp/actions/runs/43222239668), SHA `3bef33be`) sí falla en pgTAP 98 y 99. Ambos PRs de mutación fueron cerrados sin mergear.

### Concurrencia y alcance

`supabase/tests/integration/cc034_concurrency.mjs` se modificó porque restaurar una migración CC-034 anterior dejaba `admin_reinstate_courier` sin la guarda redefinida posteriormente por CC-050. La prueba ahora muta **sólo el FOR UPDATE de reinstate** dentro de la migración CC-050 y restaura esa misma versión; configura la fixture enviada y con DNI. Los logs del job `db-tests` confirman escenarios 1, 2 y 3 GREEN, mutación sin lock RED por doble auditoría y restauración GREEN, siempre en la BD efímera del runner.

**Alcance mecánico:** `src/features/admin/copy.ts` aparece literalmente en la ficha de `develop`. El archivo `supabase/tests/integration/cc034_concurrency.mjs` no aparece en los permitidos de la ficha original ni en la rama antes de este cierre; lo agregué exactamente en la ficha, §Impacto de CC-050 y fila T-434 del plan **de la rama de la PR**. No se alteró la lógica del script ni se tocó `develop`. `src/server/dni-hmac.test.ts` sí estaba autorizado junto con el helper en una misma línea de la ficha; no es un desvío adicional. La ficha en `develop` seguirá sin estos cambios hasta el merge.

## Evidencia reproducible y limitaciones

1. [Run GREEN exacto](https://github.com/cadeApp/cadeApp/actions/runs/43222179409) sobre `330c3178`: `Files=47, Tests=3958, Result: PASS`, `cc050 ... ok` (99), `cc034 ... ok` (51); `unit 209 archivos / 3961 tests PASS`; 7/7 jobs verdes.
2. [Mutación #734](https://github.com/cadeApp/cadeApp/actions/runs/43222239668), `db-tests` RED: falla test 98 («no reactiva sin envío aunque tenga DNI») y test 99 (0 audit).
3. [Concurrencia en el mismo GREEN](https://github.com/cadeApp/cadeApp/actions/runs/43222179409): tres escenarios; mutación `FOR UPDATE` RED y restauración GREEN.
4. Batería estática **del revisor**, no del autor: 11/11 mutantes estructurales detectados después de fortalecer el detector M11 para exigir **ambos** positivos CC-034 (la primera versión detectó 10/11, no 11/11). Código completo en [evidencia/comandos.md](../evidencia/comandos.md); leer las limitaciones antes de usarlo como prueba de runtime.
5. No se usó Docker, Supabase remoto, pnpm, git merge-tree ni E2E contra Develop desde revisión. El entorno aquí sólo permitió lectura de GitHub y comprobaciones de propiedades estáticas.

**Cierre:** no hay hallazgos bloqueantes pendientes en el código inspeccionado; el reviewer no aprueba ni mergea. La próxima actividad humana es decidir el merge y, **después**, ejecutar el flujo de `migrate-develop` y E2E en Develop. No pedir CI GREEN sólo por este commit documental.

## Nota para el agy

Sin correcciones de código pendientes. Antes de continuar, `git pull origin feat/T-434-sec09-dni-oracle`, sin rebase, amend ni force-push. No modificar `docs/revision-pr/**`, ni crear pruebas falsas o adulterar tests para que queden verdes. El commit documental de R3 no justifica volver a ejecutar CI; si se modifica código, pedir revisión del nuevo SHA.
