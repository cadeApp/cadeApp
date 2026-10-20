# Evidencia y reproducción — PR #454 / T-384

**HEAD inspeccionado:** `cc87a902e30c5c2f452e80edb34ca78dac396ab3`; **fecha:** 2026-10-20.

**Limitación reproducible:** el entorno del revisor no puede resolver github.com con git; no hay clon local y la ficha prohíbe levantar Supabase/Docker. Las evidencias ejecutadas provienen exclusivamente de GitHub CI, mientras que los diagnósticos de SQL y cobertura de casos son inspección de blobs. Ninguna mutación de base fue ejecutada por este revisor.

## Evidencia real observada
- Parches y archivo completos consultados a través de GitHub: 9 archivos modificados; `supabase/tests/cc033_add_courier_optional_document.sql` tiene 16 líneas con `plan(1)` y `has_function`.
- CI run: https://github.com/cadeApp/cadeApp/actions/runs/39384096110
- Job unit: https://github.com/cadeApp/cadeApp/actions/runs/39384096110/job/118499702217
- Líneas comprobadas en el log: `Test Files 149 passed (149)`, `Tests 2904 passed (2904)` y `Coverage for branches (89.45%) does not meet "src/domain/**/*.ts" threshold (90%) for src/domain/testing/rpc-fake.ts`.
- `db-tests` (job 118499702385) terminó FAILURE: la suite SQL final registró `Files=32, Tests=2869, Result: PASS`, pero el paso `git diff --exit-code -- src/types/database.types.ts` salió con código 1. El log muestra la firma en otra posición y la indentación incorrecta.

## Comandos para ejecutar DESPUÉS del arreglo sobre un worktree limpio
Desde el clon normal del proyecto y sobre el HEAD publicado por el autor. No ejecutar sobre el árbol sucio ni con secretos.

```bash
#!/usr/bin/env bash
set -euo pipefail
git fetch origin
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-384-cc033-optional-document

# Mínimo focalizado.
pnpm exec vitest run src/domain/cc033-add-courier-optional-document.test.ts src/server/rpc/courier.test.ts

# Gate real de cobertura (NO ajustar umbrales ni adulterar expectativas).
pnpm test:coverage > /tmp/pr454-coverage.log 2>&1 || {
  tail -n 60 /tmp/pr454-coverage.log
  exit 1
}
grep -E 'Test Files|Tests |Coverage for branches|ERROR:' /tmp/pr454-coverage.log | tail -n 30

pnpm typecheck
pnpm lint

# NO ejecutar supabase start, pnpm test:db ni Docker local para esta revisión.
# Verificar db-tests y su comparación db:types SOLO en el job CI del SHA.
```

## Mutaciones independientes exigidas para la ronda 2 (NO ejecutadas aún)
Deben correr de forma temporal y RESTAURARSE; nunca se commitean mutantes ni se alteran assertions. En PostgreSQL usar base efímera exclusivamente a través de db-tests CI, con las dos sesiones reales existentes de CC-025; una mutación RED debe fallar por **la propiedad** verificada.

| Hallazgo | Mutación RED propuesta | Aserción que debe caer |
|---|---|---|
| H01 | Quitar la validación del objeto en `storage.objects` en copia efímera | pgTAP objeto inexistente → NOT_FOUND sin inserciones/auditoría |
| H01 | Quitar el rechazo de `vehicle_type is null` | pgTAP pending incompleto → INVALID_STATE_TRANSITION y sin inserción |
| H01 | Permitir `kind = 'selfie'` en copia efímera | pgTAP kind prohibido → VALIDATION_ERROR |
| H01 | Eliminar revoke de EXECUTE a anon en copia efímera | pgTAP `has_function_privilege('anon', ..., 'EXECUTE') = false` |
| H01 | Suprimir insert de `audit_log` | Aserción positiva del único registro auditado falla |
| H02 | Invertir orden de locks couriers/documentos en función efímera | `cc033_concurrency.mjs --mutation-check` detecta carrera/deadlock real; restaurado normal verde |
| H03 | Quitar `v_kind_text IS NULL` tras corregir | Llamada directa sin kind rechazada específicamente con VALIDATION_ERROR |
| H03 | Convertir `!~` a `!~*` en sufijo tras corregir | Prueba .PNG en PostgreSQL pasa de VALIDATION_ERROR a aceptación indebida |
| H03 | Volver a convertir UUID vacío en ausencia | Prueba clave enviada `""` exige VALIDATION_ERROR |
| H04 | Saltarse comprobación de existencia Storage del fake | Caso fake sin objeto deja de retornar NOT_FOUND |
| H04 | Borrar guard `vehicleType === null` del fake | Caso pending incompleto deja de retornar INVALID_STATE_TRANSITION |
| H04 | Devolver `idempotent: false` en un reintento | Test de reintento y no duplicación falla |
| H05 | Sustituir nombre RPC del wrapper por `replace_courier_document` | Spy debe detectar exactamente el nombre incorrecto |

**Condición de aceptación:** por cada mutación, anotar run/comando, línea de rechazo RED y GREEN restaurado del *mismo* test, verificar que el fallo no sea por crash del harness o ausencia de objetivo. No falsificar resultados ni editar pruebas para pasar.

## Inspección estática del bug NULL (H03)
En SQL, `NULL NOT IN ('license','insurance')` evalúa a NULL, no TRUE. Con `storagePath` no vacío, la expresión del IF es NULL/FALSE y no entra al `raise VALIDATION_ERROR`. El valor NULL continúa hasta una verificación de objeto y un INSERT de `kind` NOT NULL (o un NOT_FOUND si el objeto no existe), quebrando el contrato de error. Se requiere pgTAP antes de marcar verificado.

## No comprobado
No se pudo ejecutar `git merge-tree`, tests unitarios locales ni suite SQL propia. La ausencia de estos comandos no es un pase silencioso: exige revalidación por un revisor en la siguiente ronda.
