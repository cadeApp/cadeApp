# PR #109 · T-116 — Ronda 2 independiente

- SHA revisado: df73adac155a3b34db60d6a126ac85e53209e8e5
- develop actual: 47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a
- resultado: CON BLOQUEANTES (2)
- decisiones pendientes: ninguna

## Preflight

- CC-011 PR #111 ya fue revisada y mergeada.
- Los shared files `docs/contracts/CC-011.md`, `src/ui/map.tsx`, `src/ui/map.test.tsx`, `src/ui/map-skeleton.tsx`, `package.json` y `pnpm-lock.yaml` son idénticos al develop actual.
- El autor no tocó `docs/revision-pr/**`.
- El branch queda behind 1 por T-123/Admin, pero CI #487 hizo checkout del merge sintético `a9a69b20... = df73adac + 47d65c41`; por eso la combinación real con develop actual está certificada.

## H01 — CERRADO

CC-011 separado fue aprobado y mergeado. T-116 consume exactamente los shared files de develop.

## H02 — CERRADO

El fallback real de Google con key válida + FAILED/onError vive en CC-011 y sus archivos siguen idénticos al contrato verificado.

## H03 — CERRADO

C01/C03 importan `MapSkeleton` desde `@/ui/map-skeleton` y `MapPicker` mediante `next/dynamic` desde `@/ui/map`.

Build CI #487:
```text
/merchant/onboarding   147 kB
/merchant/requests/new 163 kB
/courier/feed          179 kB
```

No reaparece el +20 kB causado por el import estático del módulo pesado.

## H04 — CERRADO

`getActiveZones()` selecciona `id, name, centroid_lat, centroid_lng` y mapea a `centroidLat/centroidLng`.

`MerchantOnboardingForm` calcula `selectedZoneCenter` y en submit usa:
```ts
const finalLat = data.defaultPickupLat ?? selectedZoneCenter?.lat ?? null;
const finalLng = data.defaultPickupLng ?? selectedZoneCenter?.lng ?? null;
```

Los tests ejecutados por CI cubren:
- zona A -> centroide A;
- cambio A -> B -> centroide B;
- pin explícito prevalece;
- zona sin centroide -> null.

## H05 — BLOQUEANTE RESIDUAL

El código y los tests nuevos ahora sí cruzan la integración:
- C01: MapPicker onChange -> RHF -> merchantOnboardingAction;
- C03: MapPicker onChange -> RHF -> createDeliveryRequestAction.

Ambas suites pasan en CI #487.

Pero la instrucción de la Ronda 1 exigía además una mutación concreta:
```tsx
onChange={() => {}}
```
y guardar rojo + verde sin cambiar fixtures/expected.

La bitácora dice “Red Mutation Tests”, pero no incluye comando ni salida roja; los commits tampoco contienen esa evidencia.

### Corrección exacta H05
1. En C01, reemplazar temporalmente el `onChange` de integración por no-op.
2. Ejecutar solo el test H05 de onboarding y registrar que falla porque la action no recibe `-27.4365/-65.6165`.
3. Restaurar.
4. Repetir en C03 y registrar fallo porque la action no recibe `-27.4385/-65.6185`.
5. Restaurar y dejar ambos tests verdes.
6. No modificar mocks, fixtures ni expectations durante la mutación.

## H06 — CERRADO

CC-011 cubre `GoogleMap.onCameraChanged` real, no ArrowUp como proxy.

## H07 — BLOQUEANTE

La directiva visual exige verificar “en navegador real con la app corriendo”.

La evidencia actual no cumple:
- `axe-report.json` usa `http://localhost:4567/?page=c01&state=...` y `?page=c03...`, no `/merchant/onboarding` ni `/merchant/requests/new`;
- no existe en el repo un harness `:4567` versionado/reproducible;
- las PNG `offline` de C01 y C03 muestran el mapa activo igual que `map-available`, sin banner ni fallback offline;
- los screenshots `google-failed` sí muestran fallback, pero el query `state=google-failed` demuestra un estado de harness, no el fallo real de la carga de Google pedido en la ronda anterior;
- varios resultados axe tienen `incompleteCount=1`, mientras `axe-summary.md` afirma que la pantalla “cumple al 100%”.

### Corrección exacta H07
1. Levantar la app Next real.
2. Entrar por las rutas reales `/merchant/onboarding` y `/merchant/requests/new` con sesión/datos locales autorizados.
3. Capturar 390x844 y 360x800.
4. `map-available`: key válida + red.
5. `google-failed`: mantener key válida y bloquear/fallar requests de Google Maps mediante CDP/network interception; no usar query param ni borrar key.
6. `offline`: usar emulación offline real de navegador/CDP; la captura debe mostrar el fallback offline y el formulario textual usable, no el mapa activo.
7. Ejecutar axe sobre esas mismas rutas/estados y conservar salida reproducible; si hay `incomplete`, listar qué reglas quedaron incompletas y no afirmar “100% AA” sin revisión.
8. Reemplazar las 12 PNG/reportes actuales y registrar comando/procedimiento exacto en bitácora.

## H08 — CERRADO

El contrato usa `publicEnv`; barrido final sin `process.env.NEXT_PUBLIC_*` directo.

## H09 — CERRADO

C01/C03 conservan una sola dirección y una acción GPS por sección; tests de composición lo afirman y pasan en CI.

## CI #487

El checkout real de Actions fue:
```text
a9a69b20de7cacbda0118ecf012747d8646a39e2
Merge df73adac155a3b34db60d6a126ac85e53209e8e5 into 47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a
```

Jobs: unit/build/typecheck/db-tests/audit/lint/bundle-budget = success.

Suite: 74 files / 898 tests.

## Barrido final

Sobre los TS/TSX modificados:
```text
.only/.skip               0
setTimeout/sleep          0
any                       0
@ts-ignore                0
hex #RRGGBB               0
process.env NEXT_PUBLIC   0
inline style              0
import directo sonner     0
import estático MapPicker 0
```

## Dictamen

CON 2 BLOQUEANTES.

No tocar lógica ya cerrada. Resolver únicamente H05 evidencia de mutación y H07 evidencia real de navegador.
