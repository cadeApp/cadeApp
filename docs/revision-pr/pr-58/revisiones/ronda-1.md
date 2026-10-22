# PR #58 · Ronda 1 — `afe3631`

| | |
|---|---|
| **SHA revisado** | `afe3631f46d450cdfdd128f73b46ccee56b02b76` |
| **Base** | `de6fbf330f4d58db651c3380d5a4c41b2d4d4a8f` |
| **Tarea** | T-006 · Contratos de dominio v1 |
| **Tamaño** | 10 archivos · +2567 / −9 |
| **Fecha** | 2026-09-22 |

## Veredicto

**CON BLOQUEANTES: 14.** La superficie pública está bien enumerada, pero varios contratos aceptan estados que el producto no puede autorizar y el fake devuelve éxitos que una RPC real debe rechazar. Las demostraciones de abuso no son hipotéticas: se ejecutaron sobre el SHA revisado y todas pasaron.

La clase completa fue recorrida antes de reportar: 18 RPC, cada transición de solicitud y oferta, todos los códigos de error declarados, validadores de coordenadas/configuración, fake y control de cobertura. No hay migraciones ni policies RLS en el diff.

## Lo que está bien

- `ALL_RPC_NAMES` enumera las 18 RPC y `satisfies` lo cruza con el catálogo; es una buena defensa contra omisiones nominales.
- La prioridad y el orden de ofertas son deterministas, con desempate estable.
- La expiración perezosa y la matriz de estados cubren el camino feliz completo, y los enums coinciden con el esquema SQL existente.
- El alcance original está limpio: los 10 archivos del PR estaban permitidos por la ficha. Las tres ampliaciones posteriores están autorizadas por Lautaro073 y registradas en el README de esta revisión.
- `typecheck`, `lint` y las 94 pruebas locales pasan. El job `db-tests` no fue juzgado por su color: el log contiene `Files=3, Tests=98` y `Result: PASS`; los errores transitorios de pull de Docker no produjeron un falso verde.
- Durante la revisión, el autor corrigió el cuerpo del PR al template y `approval-policy` pasó. Esa corrección fue adecuada y no queda como hallazgo abierto.

## Checks

| Control | Resultado | Lectura correcta |
|---|---|---|
| `pnpm typecheck` | ✅ exit 0 | Tipos actuales; no demuestra que los tipos sean suficientemente estrechos |
| `pnpm lint` | ✅ exit 0 | Reejecutado sin el archivo temporal del probe |
| `pnpm test` | ✅ 94 Vitest + 19 workflows + 6 ADR | La suite existente consolida varios comportamientos incorrectos |
| `pnpm test:coverage` | ✅ exit 0 | El umbral es inefectivo; pasó también con 38,77 % de ramas en `src/domain` |
| `pnpm test:db` local | n. a. | No hay Docker local; se verificó el log de CI |
| `db-tests` CI | ✅ `Files=3, Tests=98`, `Result: PASS` | pgTAP sí corrió realmente |
| `audit` CI | ❌ exit 1 | 5 críticas, 18 altas, 23 moderadas y 4 bajas |
| Alcance | ✅ 10/10 permitidos al revisar | Más las ampliaciones humanas registradas |

## Hallazgos bloqueantes

### H01 · Las pruebas de pertenencia son opcionales y la máquina autoriza por ausencia

`src/domain/states/index.ts:21-22,108-181` · alto · `P08-control-no-cubre-lo-que-dice`

`isOwnerMerchant` e `isAssignedCourier` son opcionales, pero las guardas solo rechazan `=== false`. Omitir la prueba autoriza `draft→published`, `published→matched`, `matched→in_transit` y las demás rutas protegidas. Además `draft→published` fabrica un estado de suscripción si el caller no lo aporta.

**Prueba roja a conservar:** las tres llamadas sin propiedad/asignación devuelven `ok: true` hoy; después del arreglo deben devolver `UNAUTHORIZED_ACTOR` o el input debe ser imposible de construir. La corrección debe cerrar todas las guardas de líneas 108, 125, 132, 149, 158, 163, 171 y 181, no solo una.

### H02 · Cuatro transiciones devuelven el código equivocado cuando falta el motivo

`src/domain/states/index.ts:159,164,175,192` · medio · `P11-api-publica-inconsistente`

El catálogo ya define `REASON_REQUIRED`, pero esas cuatro ramas devuelven `VALIDATION_ERROR`; los tests de líneas 295, 317, 348 y 378 congelan el error equivocado. Cambiar las cuatro y demostrar cada actor/operación.

### H03 · El contrato de distancia acepta medias coordenadas e inventa 1500 m

`src/domain/rpc-contracts.ts:167-177` · `src/domain/testing/rpc-fake.ts:365-384` · alto · `P06-enumeracion-incompleta`

Cada componente del par es opcional por separado; `{}` y un solo `lat` son inputs válidos. Si falta cualquiera, el fake devuelve 1500 m aunque no recibió zonas ni centroides. También `calculateHaversineRouteDistanceM` impone un mínimo de 500 m, por lo que dos puntos iguales informan 500 m.

**Decisión de Lautaro073:** cuatro coordenadas válidas → Haversine; coordenadas faltantes → `routeDistanceM` ausente/nulo y la UI muestra «De barrio X a barrio Y» sin distancia. No habrá fallback por centroides. Google Maps no participa en ese cálculo. Modelar en el schema la unión de ambos resultados y probar pares completos/incompletos y punto idéntico.

### H04 · `admin_update_setting` no discrimina valor por clave

`src/domain/rpc-contracts.ts:231-239` · alto · `P06-enumeracion-incompleta`

Todas las claves aceptan cualquier entero no negativo, boolean o string. Así `pilot_active: 1`, `min_offer_ars: false` y TTL cero validan; el fake devuelve éxito aunque no aplique el valor. Usar una unión discriminada: montos/TTL positivos, `pilot_active` boolean, versión no vacía y gracia no negativa, y probar la matriz clave × tipo/límite.

### H05 · El cliente pierde los códigos de error específicos de cada RPC

`src/domain/rpc-contracts.ts:499-506` · alto · `P11-api-publica-inconsistente`

`RpcErrorCode<K>` existe, pero `RpcClientContract` devuelve `DomainErrorCode`. Por eso `publish_request` puede compilar con `AAL2_REQUIRED`, código que no pertenece a su contrato, y `setForcedError` permite forzarlo. El retorno debe ser `ActionResult<RpcOutput<K>, RpcErrorCode<K>>` y el fake debe respetar la misma relación.

### H06 · Las 13 RPC no administrativas aceptan un actor no autenticado

`src/domain/testing/rpc-fake.ts:90-111` · alto · `P08-control-no-cubre-lo-que-dice`

`executeRpc` autentica únicamente si `requireAdmin` es `true`. Con `role: null`, las trece RPC no admin retornan éxito; `cancel_request` incluso transforma cualquier rol no admin en merchant. La prueba roja recorrió las 13, no una muestra. El fake debe validar autenticación y rol/identidad por operación.

### H07 · El fake fabrica filas ausentes y seis operaciones son stubs incondicionales

`src/domain/testing/rpc-fake.ts:167,231,250,256,291-352,387-425` · alto · `P15-entregable-declarado-pero-no-ejecutable`

Los `?? { ... }` convierten IDs inexistentes en solicitudes/ofertas válidas. `mark_picked_up`, `mark_delivered`, `report_no_show`, `courier_cancel_match`, `republish_request` y `report_incident` no consultan ni mutan estado. Las administrativas tampoco verifican que el recurso exista. Diez RPC probadas con UUID ausente devolvieron éxito. El fake debe ser un sustituto conductual: `NOT_FOUND`, preestado, actor y mutaciones observables.

### H08 · Todas las ofertas comparten un único ID fijo

`src/domain/testing/rpc-fake.ts:212-226` · medio · `P15-entregable-declarado-pero-no-ejecutable`

Dos couriers distintos reciben `2222…`; la segunda oferta sobreescribe la primera en el `Map`. No se puede probar «aceptar una y rechazar las demás», requisito central del DoD. Generar IDs deterministas pero únicos/injectables y probar dos o más ofertas concurrentes.

### H09 · El fake vuelve a hardcodear configuración dinámica

`src/domain/testing/rpc-fake.ts:61-63,161,318,329,340,382` · alto · `P05-semantica-invertida-vs-dod`

El piso por defecto vuelve a ser `1000`, expresamente prohibido por la regla raíz; también fija TTL 30 y distancias 1500. La prueba confirma que 999 falla y 1000 pasa sin fixture explícito. Toda configuración dinámica debe inyectarse desde un fixture que represente `platform_settings`; omitirla debería ser error de configuración, no una política oculta.

### H10 · Fechas y timestamps aceptan cualquier string

`src/domain/rpc-contracts.ts:35-36,48,63,73,84,95,105,117,129,140-141,154,189,201,222,228` · medio · `P08-control-no-cubre-lo-que-dice`

`publishedAt: "not-a-date"` pasa el output schema y `paidUntil` tampoco distingue fecha civil de timestamp. Usar schemas ISO explícitos —con offset para instantes— y barrer todos los campos enumerados.

### H11 · `ActionResult` permite mensajes arbitrarios fuera del contrato público

`src/domain/errors.ts:55-75` · medio · `P11-api-publica-inconsistente`

La regla del repo fija el fallo como `{ ok: false, code }`; los textos de UI viven en el mapa central. `err(code, message)` habilita mensajes no tipados y potencialmente internos. La prueba actual incluso exige ese escape. Quitar `message` del tipo/helper y probar igualdad exacta.

### H12 · El supuesto umbral de ramas ≥ 90 % es un no-op

`src/domain/domain.test.ts:890-920` · `vitest.config.ts:10-15` · alto · `P04-test-tautologico`

El test solo lee `coverage-final.json` si ya existe, pero Vitest genera ese archivo después de ejecutar los tests. En un checkout limpio el bloque nunca corre. Se agregó temporalmente un módulo con ramas sin cubrir: `pnpm test:coverage` salió 0 con **38,77 %** de ramas en `src/domain`.

**Decisión de Lautaro073:** `vitest.config.ts` queda autorizado para T-006. Configurar `coverage.thresholds` ≥ 90 % para `src/domain`, limpiar el chequeo condicional y conservar una prueba de mutación que haga fallar el comando.

### H13 · La fase roja solo demuestra que faltaban los módulos

`docs/tasks/log/T-006.md` · medio · `P04-test-tautologico`

La evidencia roja es un fallo de resolución de imports anterior a ejecutar las aserciones. Demuestra que los archivos no existían, no que cada regla fallaba. Para cerrar estos hallazgos hacen falta rojos por clúster: autorización/transiciones, forma de inputs/outputs, fake multi-entidad y umbral de cobertura.

### H14 · El job `audit` está rojo con vulnerabilidades críticas

`.github/workflows/ci.yml:194-208` · `package.json` · `pnpm-lock.yaml` · crítico · `P15-entregable-declarado-pero-no-ejecutable`

Al existir `rpc-contracts.ts`, el gate que antes era preparatorio ahora bloquea correctamente: 50 vulnerabilidades, incluidas 5 críticas y 18 altas; el log identifica Next 14.2.24 y Vitest entre los paquetes afectados. No se puede declarar la ronda lista con ese job rojo.

**Decisión de Lautaro073:** se amplía T-006 a `package.json` y `pnpm-lock.yaml` para la remediación. Actualizar con cambios mínimos compatibles, ejecutar suite/build y verificar el log del nuevo SHA; no bajar el gate.

## Mejoras no bloqueantes

- `src/domain/index.ts:6` exporta el fake de `testing` desde el barrel productivo. Conviene dejarlo accesible solo por el subpath de test para no convertirlo accidentalmente en API de producción.
- Los tipos de enums se pueden derivar con `z.infer` para que Zod sea literalmente la única fuente de verdad; hoy no hay drift funcional porque ambos nacen de la misma tupla.

## No revisado / límites

- No corrí `pnpm test:db` local porque este entorno no tiene Docker. Sí abrí el log y verifiqué `Tests=` y `Result:`.
- No hay RLS en este diff; no corresponde inventar una ronda sobre policies que el PR no cambia.
- La deuda histórica de `delivery_requests.notes` no se reabre acá: no forma parte de la ficha oficial de T-006 ni de este diff.
- No aprobé ni mergeé la PR.
