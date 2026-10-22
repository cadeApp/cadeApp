# Ronda 1 — PR #178 / CC-014

**Fecha:** 2026-10-01  
**SHA funcional:** `de6e475b3167a72c80d2688712b6e1a74928b55a`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **CON BLOQUEANTES (3)**

## Alcance y proceso

- Rama: `cc/CC-014-map-picker-hardening`.
- Base exacta: `develop@1457072a7cac1ae9e2a8a92abe9253d45b745082`.
- Estado compare: 1 commit ahead / 0 behind.
- Archivos del autor: exactamente:
  - `docs/contracts/CC-014.md`
  - `src/ui/map.tsx`
  - `src/ui/map.test.tsx`
- Issue #177 existe con label `contract-change` y declara que bloquea T-323.
- No hay dependencias ni variables de entorno nuevas.
- No se encontraron `any`, `@ts-ignore`, `.only`, `.skip`, sleeps, `process.env` directo, deep imports ni estilos inline nuevos.
- CI exact-head `36949995243`: verde.

## Lo que está bien

- CC-014 formaliza explícitamente que supersede CC-011 §4 y amplía §5.
- `onCameraChanged` dejó de persistir coordenadas.
- Se eliminan crosshair, D-pad y badge técnico.
- Se mantienen flechas de teclado.
- `gm_authFailure` usa un bridge de módulo con `Set` y cleanup no-LIFO.
- Con `mapId` se usa `AdvancedMarker`; sin `mapId` se degrada a `Marker`.
- Los mocks de marcador capturan props/handlers reales y ejercen drag/click en ambas variantes.

## PR178-H01 — ALTO — drag/click siguen recentrando mediante MapCameraSynchronizer

CC-014 §2.4 y el body dicen que `map.panTo()` ocurre exclusivamente ante cambios externos (`value`, `defaultZoneCenter`), GPS o teclado, y que no debe alterar el centro por interacción manual.

El código conecta:

```tsx
<MapCameraSynchronizer targetCoords={activeCoords} />
```

y tanto drag como click hacen:

```tsx
setActiveCoords(coords)
```

El efecto de `MapCameraSynchronizer` detecta ese cambio y llama `map.panTo(targetCoords)`.

Harness independiente de estado:

```text
current_wiring_target_activeCoords=true
drag_changes_activeCoords=true
click_changes_activeCoords=true
executable_drag_causes_panTo=true
executable_click_causes_panTo=true
drag_click_tests_assert_no_panTo=false
```

La suite comprueba `panTo` para cambios externos y GPS, pero no afirma que drag/click **no** lo llamen.

### Corrección esperada

Separar el estado del pin del target de cámara. Por ejemplo:
- `activeCoords`: cambia con drag/click/GPS/teclado/props.
- `cameraTarget`: cambia solo con props externas, GPS y teclado.
- `MapCameraSynchronizer targetCoords={cameraTarget}`.

Agregar pruebas negativas explícitas:
- drag no llama `panTo`;
- click no llama `panTo`.

Y positiva:
- teclado sí actualiza pin y llama `panTo`.

## PR178-H02 — MEDIO — el RED inicial de 43 tests queda enmascarado por el helper nuevo

La suite final importa y llama `resetAuthFailureBridgeForTesting()` tanto en `beforeEach` como en `afterEach`.

Ese export no existe en `develop`.

Control independiente:

```text
final_beforeEach_calls_new_reset_helper=true
develop_exports_reset_helper=false
```

Por lo tanto, “copiar primero la suite final a develop y correrla” no demuestra 43 diferencias conductuales: el setup puede fallar antes de llegar a las aserciones de `onCameraChanged`, crosshair, drag, click o fallback de marcador.

El body reconoce el `TypeError`, pero luego atribuye el mismo RED a varias conductas que no quedan reproducibles con esa configuración.

### Corrección esperada

Reproducir RED conductual sin que el helper nuevo rompa el setup:
- temporalmente quitar del test el import/calls del helper al ejecutar contra `develop`, sin commitear esa mutación;
- correr casos dirigidos que demuestren por separado camera loop, controles viejos, ausencia de drag/click y ausencia de fallback legacy;
- restaurar la suite final;
- corregir el body con salidas reales, sin afirmar RED no ejecutado.

## PR178-H03 — MEDIO — CC-014 agrega un export público aunque declara API pública sin cambios

CC-014 §1 afirma que la API pública de `src/ui/map.tsx` se preserva sin cambios.

Sin embargo, el HEAD agrega:

```ts
export function resetAuthFailureBridgeForTesting(): void
```

Control independiente de exports:

```text
extra_test_helper_export=["resetAuthFailureBridgeForTesting"]
```

Ese símbolo existe únicamente para test isolation y no forma parte del contrato funcional de MapPicker.

### Corrección esperada

Eliminar el export de producción y las llamadas directas desde el test. La suite debe aislarse mediante el lifecycle real:
- `cleanup()` desmonta todos los MapPicker;
- el último unregister vacía el Set y restaura el handler externo;
- después el test puede limpiar `window.gm_authFailure`.

Si hace falta un control adicional, agregar un test que demuestre que al desmontar todas las instancias el bridge queda restaurado, sin exponer un reset público.

## PR178-H04 — MEJORA — T-323 no quedó marcada como bloqueada

La skill `contract-change` indica que las tareas afectadas deben marcarse `bloqueada` mientras el CC está abierto.

Issue #171 sigue con:
- `P2`
- `fase-3`
- `en-curso`

y no muestra `bloqueada`.

El issue #177 sí dice “Bloquea T-323”, así que el dato existe pero la coordinación visual no refleja el estado real.

### Mejora esperada

Mientras #178 siga abierto:
- agregar label `bloqueada` a #171;
- quitar `en-curso`.

Después de mergear CC-014 y retomar T-323 se revierte ese estado mediante el flujo normal de `retomar-tarea`.

## CI exact-head 36949995243

```text
typecheck       success
lint            success
unit            success — 110 files / 1592 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
/design-system         184 kB warning preexistente
```

El job de DB tuvo rate-limit transitorio de Docker Hub, reintentó y terminó PASS.

## Conclusión

No mergear CC-014 todavía.

Corregir H01–H03, actualizar la evidencia RED del body de forma reproducible y aplicar H04 de coordinación. Luego revalidar con mutaciones específicas y ejecutar Ronda 2.
