# Evidencia reproducible — PR #744 / R1

## Fuente y límites

SHA de código de la ronda: `e96473185354589b3820a345cc7a089127919afd`. La sesión accedió por el conector GitHub; **no hubo clon ejecutable**, Docker local, ni test escrito en la rama. Los comandos siguientes son reproducibles para una sesión de desarrollo autorizada, **NO se declaran ejecutados aquí**.

### Comprobaciones ya contrastadas desde GitHub

- `https://github.com/cadeApp/cadeApp/actions/runs/43515294798` — HEAD `55b5098`, `success`: Vitest `212 passed / 4014 passed`, pgTAP `Files=48, Tests=4034, Result: PASS`, escenarios de concurrencia CC-052 `1–5 GREEN`, regeneración de tipos + diff sin cambios.
- `https://github.com/cadeApp/cadeApp/actions/runs/43515335746` — HEAD mutado `203cbc3` de la PR #745: `cc052_courier_verified_documents.sql Tests: 76 Failed: 23`; unit: 2 fallas por SQL↔contrato. Es la batería del autor.
- Comparación API GitHub `55b5098aae8758c4d198b2112c30f3cff71f0e6b..e96473185354589b3820a345cc7a089127919afd`: un solo archivo, `docs/tasks/log/T-437.md`, 14 líneas. No hubo cambio de código.
- Código SQL en `supabase/migrations/20261114120000_cc052_courier_verified_documents.sql:340-345`: chequea `storage.objects` y falla con `NOT_FOUND`.
- Fake `src/domain/testing/rpc-fake.ts:3424-3466`: no chequea `storedCourierDocumentPaths`, que sí usa `add_courier_optional_document` en la línea 3299.

## H01 — Arnés RED independiente, preparado, no ejecutado

**Objetivo:** detectar la omisión de una ruta inexistente en Storage **sin modificar los tests de la rama del autor**. Este script crea un worktree separado del SHA revisado, agrega una prueba nueva que debe fallar por una aserción concreta, captura temporalmente la salida en `/tmp`, imprime el extracto del resultado y elimina el worktree al salir. No hay `git checkout`, `rebase`, Docker, ni escritura de secretos. Requiere que en la máquina de quien lo ejecute exista un clon limpio con dependencias instaladas y `pnpm`.

Copiar **todo** este bloque a `/tmp/pr744-h01-red.sh` y ejecutar desde la raíz del clon con `bash /tmp/pr744-h01-red.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SCRATCH="$(mktemp -d /tmp/pr744-h01.XXXXXX)"
WT="$SCRATCH/wt"
cleanup() {
  if [[ -d "$WT" ]]; then
    rm -f "$WT/src/domain/cc052-review-storage.test.ts" "$WT/node_modules"
    git -C "$ROOT" worktree remove "$WT" 2>/dev/null || true
  fi
  rm -rf "$SCRATCH"
}
trap cleanup EXIT
cd "$ROOT"
git worktree add --detach "$WT" e96473185354589b3820a345cc7a089127919afd
ln -s "$ROOT/node_modules" "$WT/node_modules"
cat > "$WT/src/domain/cc052-review-storage.test.ts" <<'TS'
import { describe, expect, it } from 'vitest';
import { createFakeRpcClient } from './testing/rpc-fake';

const COURIER = '20000000-0000-4000-8000-0000000052c2';
const DOCUMENT = 'd0000000-0000-4000-8000-0000000052c2';
const ABSENT_PATH = `courier/${COURIER}/selfie_1730000000001.png`;
const settings = {
  minOfferArs: 1200, maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10, maxIncidentsPerMin: 5,
  requestTtlMinutes: 25, pilotActive: true,
  pilotTermsVersion: 'v1.0', subscriptionGraceDays: 3,
};
describe('PR744-H01 independiente', () => {
  it('objeto de Storage inexistente devuelve NOT_FOUND sin reemplazar el vigente', async () => {
    const client = createFakeRpcClient({
      settings,
      initialActor: { userId: COURIER, role: 'courier', aal: 'aal1' },
      initialCouriers: [{
        courierId: COURIER, status: 'rejected', available: false,
        vehicleType: 'moto', hasDni: true,
      }],
      initialDocuments: [{
        documentId: DOCUMENT, courierId: COURIER,
        kind: 'selfie', status: 'rejected',
      }],
      initialStoragePaths: [], // el archivo NO existe
    });
    const result = await client.resubmit_courier_required_document({
      kind: 'selfie', storagePath: ABSENT_PATH,
      idempotencyKey: '00000000-0000-4000-8000-000000005299',
    });
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' });
    expect(client.getDocument(DOCUMENT)).toMatchObject({
      isCurrent: true, status: 'rejected',
    });
  });
});
TS
set +e
( cd "$WT" && pnpm exec vitest run src/domain/cc052-review-storage.test.ts )   > "$SCRATCH/red.log" 2>&1
code=$?
set -e
grep -E 'PR744-H01|Test Files|Tests|AssertionError|FAIL' "$SCRATCH/red.log" | tail -30 || true
if [[ "$code" -eq 0 ]]; then
  echo "ERROR: la prueba destinada a detectar el defecto dio verde; investigar el instrumento" >&2
  exit 2
fi
if ! grep -q "NOT_FOUND" "$SCRATCH/red.log"; then
  echo "ERROR: falla distinta del oráculo NOT_FOUND; no contar como RED válido" >&2
  exit 3
fi
echo "RED capturado: falló el oráculo NOT_FOUND; repetir en el SHA corregido para GREEN"
```

**Precaución:** la última impresión informa solo que el script preparó un posible RED si el runner devolvió el texto esperado; el autor/revisor debe leer el assertion diff para descartar fallos de setup y correr el **mismo** test sobre el SHA corregido. No sustituir el control por strings falsos ni por una prueba que se saltee.

**Prueba positiva complementaria después del fix:** el mismo caso con `initialStoragePaths: [ABSENT_PATH]` devuelve `ok:true` y un nuevo `submitted`; los tests positivos originales deben sembrar sus rutas canónicas. Para ejecutar la suite ya existente en un clon limpio:

```bash
pnpm exec vitest run src/domain/cc052-courier-verified-documents.test.ts
pnpm exec vitest run src/server/rpc/courier.test.ts src/features/courier-onboarding/components.test.tsx
```

## H02 — Prueba que debe agregarse

En `src/features/courier-onboarding/components.test.tsx` preparar perfil rechazado con selfie rechazada; mockear `resubmitRequiredDocumentAction` a éxito `status: 'submitted'`, subir archivo con el mock de upload y verificar que el resumen de «Documentación» deja de decir «Observado» para selfie y muestra «En revisión», y que `router.refresh()` fue invocado. Ejecutar:

```bash
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx
```

En `e2e/specs/courier-onboarding.spec.ts`, el test T-437 de subsanación debe esperar el estado autoritativo del perfil tras `router.refresh()` y confirmar que no queda el badge «Observado». Como `requiredResubmissions` desaparece del SSR cuando pasa a `submitted`, el test no debe exigir que el contenedor de carga permanezca visible tras el refresh.

## Cierre de ronda (cuando el repo esté disponible)

```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

La falta de ejecución de esos comandos en esta sesión **no** equivale a resultado favorable. El entorno no tenía clon ni permiso para invocar Docker local.
