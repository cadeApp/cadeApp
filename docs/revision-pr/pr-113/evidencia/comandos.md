# Evidencia — PR #113 / T-124

## Ronda 1 — SHA `3ef389de515f01b03a7aff88982b0b32b5f91c4d`

La R1 encontró H01–H08 y detuvo GREEN hasta CC-012 + corrección del RED.

## Ronda 2 — SHA `32d56c44a67b83de782086e0f9e176490c088d88`

### Preflight

```text
base: develop@aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd
branch: feat/T-124-incidentes
ahead: 12
behind: 0
mergeable: true
Draft: true
```

Desde el commit de desbloqueo `2c2eb03` hasta el SHA funcional R2:
- 6 commits;
- 34 archivos funcionales/documentales de T-124;
- ningún cambio del autor en `docs/revision-pr/pr-113/**`.

### Fase RED corregida — commit `86f53b5`

CI run `36353380524`:

```text
typecheck       PASS
lint            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS (warning de rutas fuera de presupuesto)
unit            FAIL esperado

Test Files      8 failed | 84 passed
Tests           120 failed | 1102 passed
```

La inspección del log muestra fallos en los ocho archivos/rutas de T-124: stubs `T-124: sin implementar`, rutas admin ausentes, componentes no renderizados y wiring del viaje todavía sin props finales. No se detecta una suite ajena roja.

### GREEN final — CI `36355934244`

```text
build           PASS
lint            PASS
db-tests        PASS
audit           PASS
typecheck       PASS
unit            PASS
bundle-budget   PASS con warning
```

Unit:

```text
src/app/(admin)/admin/incidents/_tests/trip-report-wiring.test.tsx  9 tests PASS
src/app/(admin)/admin/incidents/_tests/incidents-routes.test.tsx     10 tests PASS
Test Files 92 passed
Tests      1225 passed
```

DB:

```text
Files=12, Tests=1601
Result: PASS
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
→ sin drift
```

### H03–H08

Inspección del SHA:
- `resolveIncidentAction` solo acepta/manda `incidentId, decision, reason`;
- schemas de feature reutilizan Zod canónico de CC-012;
- el test de wiring renderiza `trips/[id]/page.tsx` real y observa props reales;
- la bandeja consume `admin_list_incidents` y no reimplementa SQL/keyset;
- tests recorren empates de `createdAt` con cursor `createdAt+id`;
- happy paths de las tres decisiones exigen una llamada exacta a `adminResolveIncidentRpc`;
- Dialogs reales prueban Escape/Cancelar y foco;
- loading/error prueban Skeleton, copy seguro y `reset()`.

Las mutaciones M-T124-01..07 están documentadas con fallos de aserción objetivo en la bitácora. No se consideran válidas las variantes que el propio autor marcó como no-RED (por ejemplo blur simple en M-T124-06a).

### Route guard admin

`src/features/auth/server.ts` aplica `evaluateRouteGuard` desde middleware a las rutas. Los tests de T-122 demuestran que `/admin/*`:
- redirige merchant/courier;
- exige admin;
- exige AAL2.

Por eso la lectura RLS de `getIncidentDetail` no abre una ruta admin a actores no autorizados.

### PR113-H09 — evidencia visual no persistida

La directiva vinculante dice:

```text
docs/design/visual-task-directive.md §8:
"Antes de pedir revisión ... dejá enlaces a capturas, comandos y resultado en el PR y en la bitácora."
```

Estado R2:
- PR describe navegador 360/390/1280;
- bitácora describe estados y mediciones;
- ambos dicen que el harness temporal fue borrado;
- no hay enlaces a PNG/JPG en PR/bitácora;
- no existe `feat/T-124-visual-assets` ni variante equivalente.

Precedente existente: T-118 publicó PNG reales en una rama `feat/T-118-visual-assets` y enlazó/incrustó esas imágenes en el PR sin contaminar la rama funcional.

### PR113-H10 — bundle

Salida CI RED `36353380524`:

```text
## First Load JS por ruta (límite 180 kB)
/trips/[id] | 187 kB | Supera el límite
```

Salida CI final `36355934244`:

```text
/admin/incidents      | 174 kB | OK
/admin/incidents/[id] | 174 kB | OK
/trips/[id]           | 194 kB | Supera el límite
warning: Alguna ruta supera el presupuesto de First Load JS
```

La Regla 25 fija ≤180 kB para rutas de comercio/repartidor. El workflow actual solo avisa, por eso no vuelve rojo el job.

Criterio de R2 para no ampliar scope:
- ideal: ≤180 kB;
- mínimo para cerrar H10 dentro de T-124: eliminar el delta propio y volver `/trips/[id]` a **≤187 kB**, dejando documentados los 7 kB preexistentes para la pasada de rendimiento posterior.

### Resultado

H01–H08: cerrados/verificados.

H09–H10: abiertos/bloqueantes.
