# PR #105 · T-106 — Ronda 1

- **SHA revisado:** `c25589c68160dd569ce645026f799312c443228e`
- **Base actual:** `develop@6ac32e77f6995bec82a0c2957d6b59739cbe096b`
- **Merge ref actual:** `25665537447b0de08fa0c137ea9a1fac5d6fe097`
- **Resultado:** **CON BLOQUEANTES (2)**
- **CI:** con bloqueantes no se usó el color global como aprobación. Sí se leyó `db-tests`, excepción prevista por el procedimiento: `Files=12, Tests=1526, Result: PASS`, con las migraciones T-106 y CC-008 aplicadas y generación de tipos sin diff.
- **Decisiones 🔵:** ninguna.

## Lo correcto

- Los 7 archivos del PR están dentro de «Archivos permitidos» de T-106.
- GitHub construye el merge ref actual de `c25589c` sobre `develop@6ac32e7`; no hay conflicto de merge reportado.
- `calculate_route_distance` fija `search_path`, usa `SECURITY DEFINER`, limita ejecución a `authenticated`, valida sesión/rol, pares de coordenadas, bounding box, fallback y el cálculo Haversine × 1.30.
- El pgTAP final de distancia cubre factor/redondeo, mínimo 500 m, punto idéntico, bounds, fallback por id/nombre y grants.
- `profiles_update_self` agrega el freeze de `created_at`.
- La sospecha de fuga desde `src/server/rpc/distance.ts` se descartó: `sendCriticalAlert` sanitiza `details` y el scrubber redacta claves `*_lat` / `*_lng` antes de Discord o fallback de observabilidad.

## H01 · La vista segura no cierra el acceso directo a `public.merchants` · BLOQUEANTE

**Archivos:** `supabase/migrations/20260926003900_coordinates_and_distance_rpc.sql:4-16`, `supabase/tests/rls_coordinates.sql:227-279`

**Estado:** [ANÁLISIS + CI VERDE]

### Diagnóstico

T-106 existe precisamente para cerrar PR56-H13: un courier aprobado no debe leer `notes`, `paid_until` ni `subscription_status` de `merchants`. La migración crea una vista con cuatro columnas seguras, pero **no elimina ni restringe la policy heredada `merchants_select_courier`**.

En `develop`, esa policy sigue concediendo `SELECT` sobre la fila completa de `public.merchants` cuando el courier aprobado puede ver al comercio. Por lo tanto el actor puede ignorar `merchant_public` y consultar la tabla original, obteniendo también `default_pickup_lat/lng`.

La vista no es una frontera de seguridad mientras la vía vieja siga abierta.

### Evidencia

El DoD oficial dice literalmente que el courier aprobado no lee esas columnas de `merchants`, y la nota de la ficha identifica `merchants_select_courier` como la causa.

La suite nueva solo prueba:

- que las columnas sensibles no existen **en la vista**;
- que las coordenadas no existen **en la vista**;
- que el courier ve/no ve filas **a través de la vista**.

No prueba una consulta directa a `public.merchants`.

El contraejemplo ya existe en el SHA revisado: la policy vieja continúa vigente y, aun así, el job `db-tests` del merge actual termina `Files=12, Tests=1526, Result: PASS`. Es un P08: el control verde no alcanza el invariante que dice cerrar.

### Arreglo

Mantener `merchant_public` como superficie segura, pero cerrar la lectura directa de couriers sobre `public.merchants`. La solución debe conservar:

- lectura propia del merchant;
- lectura administrativa;
- para courier aprobado, solo las filas permitidas y solo las columnas públicas a través de la vista.

No resolverlo con grants de columnas compartidos por `authenticated`: la propia ficha explica por qué rompería el acceso del merchant.

Agregar pgTAP con el mismo fixture que tiene `notes` y coordenadas no nulas:

1. como courier aprobado relacionado, una consulta directa a `public.merchants` no devuelve la fila;
2. el mismo courier sí obtiene la fila segura por `public.merchant_public`;
3. merchant dueño y admin conservan sus accesos esperados.

### Cómo verificar

Mutación sobre **implementación, nunca sobre el test**: una vez corregido, restaurar temporalmente la policy `merchants_select_courier` anterior. El nuevo pgTAP de acceso directo debe ponerse rojo. Revertir la mutación y confirmar verde. No commitear la mutación.

## H02 · El rojo inicial declarado no ocurrió: ambos pgTAP abortaron en el fixture · BLOQUEANTE

**Archivo:** `docs/tasks/log/T-106.md:7-9`

**Estado:** [VERIFICADO EN CI HISTÓRICO]

### Diagnóstico

La bitácora afirma que el commit inicial demostró el rojo porque todavía no existían `calculate_route_distance` y `merchant_public`.

La corrida real del commit `81e08b08653deee704a3f50765f5996c95882141` no llegó a esos controles. Las dos suites abortaron al crear el fixture por `INVALID_SIGNUP_ROLE`:

- `rls_coordinates.sql`: 0 aserciones ejecutadas; bad plan 22;
- `rpc_distance.sql`: 0 aserciones ejecutadas; bad plan 20;
- resumen del job: `Files=11, Tests=1472, Result: FAIL`.

Es decir: había un rojo, pero **por un test roto**, no por las reglas que la bitácora dice haber demostrado.

### Evidencia

GitHub Actions run `36215443077`, job `db-tests` `108330380086`:

```text
rls_coordinates.sql: ERROR: INVALID_SIGNUP_ROLE
Failed 22/22 subtests
Parse errors: Bad plan. You planned 22 tests but ran 0.

rpc_distance.sql: ERROR: INVALID_SIGNUP_ROLE
Failed 20/20 subtests
Parse errors: Bad plan. You planned 20 tests but ran 0.

Files=11, Tests=1472
Result: FAIL
```

El head actual sí queda verde después de corregir el fixture: run `36216846664`, job `108334387875`, `Files=12, Tests=1526, Result: PASS`. Eso verifica el estado final, pero no convierte retrospectivamente el primer rojo en una demostración válida.

### Arreglo

No reescribir historia ni fabricar un rojo retroactivo.

- Agregar una entrada nueva a `docs/tasks/log/T-106.md` que corrija explícitamente la afirmación de la sesión inicial: el primer rojo fue inválido porque el fixture abortó antes de las aserciones.
- En el cuerpo del PR, retirar/corregir `Cada prueba nueva se demostró fallando al romper la regla` y cualquier texto que atribuya esa corrida a RPC/vista ausentes, salvo las propiedades que ahora tengan evidencia real.
- Para H01 y los controles que se quieran declarar mutation-proven, demostrar rojo/verde con mutaciones temporales de **implementación** y copiar la salida real. No modificar expectativas, planes, fixtures ni tests para forzar verde.

### Cómo verificar

La nueva entrada de bitácora debe citar el run/job anterior y sus `0` aserciones. La evidencia nueva debe mostrar el nombre real de la aserción que falla bajo la mutación y la misma suite verde al restaurar el código.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Coordenadas del wrapper llegan crudas a Discord | `sendCriticalAlert` pasa `details` por `scrubPii`; `p_pickup_lat`, `p_dropoff_lat` y cualquier `*_lat/_lng` terminan redactadas. |
| `created_at` sigue mutable en `profiles_update_self` | La policy nueva compara `created_at` contra la fila actual y el pgTAP intenta reescribirlo. |
| Los tipos quedaron desfasados por CC-008/CC-009 | La rama está 2 commits detrás, pero el merge ref actual incorpora `develop@6ac32e7`; el db job aplica T-106 + CC-008 y `db:types` termina sin diff. |

## Por qué el verde no alcanza

`db-tests` está verde en el merge ref actual, pero H01 es justamente un contraejemplo vivo: el test inspecciona la forma de `merchant_public` y no la vía directa que el DoD quiere cerrar.

El resto de CI no se usa para aprobar esta ronda mientras haya bloqueantes, conforme al procedimiento del proyecto.

## Preflight

- Comentarios previos: ninguno.
- Reviews/threads previos: ninguno.
- `docs/revision-pr/pr-105/` no existía en el diff del autor.
- T-106 desde `origin/develop`: sin ampliación de alcance; el branch solo cambia los checks del DoD de `[ ]` a `[x]`.
- Rama: 9 commits por delante y 2 por detrás del `develop` actual.
- Merge actual de GitHub: `2566553` = `c25589c` sobre `6ac32e7`.

## Metodología

Revisión independiente del SHA remoto, usando el conector de GitHub para blobs, diff, historial y logs. No se levantó Supabase ni Docker local. El intento de checkout local no pudo resolver `github.com`; por eso no se presenta un `git merge-tree` local como si se hubiera ejecutado. Como sustituto verificable, GitHub generó el merge commit actual contra el `develop` vigente y su `db-tests` fue inspeccionado por dentro.
