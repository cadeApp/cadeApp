# Revisión independiente — PR #605 / T-403 — ronda 3: aceptación (2026-11-04)

**RESULTADO: SIN BLOQUEANTES — REVISIÓN ACEPTADA PARA INTEGRACIÓN.**

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/605 |
| Implementación corregida | `5ea4c55a0a3b7e8f7cd875b287f4fa8af725fc6a` |
| HEAD revalidado | `7e52b87a2673ffbacfbd544f3c191b463ebe3c62` |
| Base | `844bab43491fb30f171b6a72e9ec750a93f40dbc` |
| Trusted E2E | https://github.com/cadeApp/cadeApp/actions/runs/41915482723 — **success** |
| CI del código | https://github.com/cadeApp/cadeApp/actions/runs/41913324153 — **success** |
| Hallazgos abiertos bloqueantes | **0** |
| Decisiones pendientes | **0** |

## 1. Verificación exacta del código aceptado

`get_pr_info` confirmó `head_sha=7e52b87...`, PR `draft=true`, no mergeada, `mergeable=true`. `compare_commits(5ea4c55,7e52b87)` mostró **1 commit solo de documentación**, exactamente los cinco archivos `docs/revision-pr/pr-605/**`; ningún cambio de TS, SQL, E2E, mocks o fixtures entre el SHA donde el autor corrigió H01 y el SHA del gate.

En el workflow `e2e-preview`, job `126874049100`, se verificó el checkout **`ref: 7e52b87a2673ffbacfbd544f3c191b463ebe3c62`**, no solo el nombre del workflow ni su color.

**Evidencia concreta en log:** `e2e/specs/admin-applicants-search.spec.ts:66:7`, test de T-403 «`jose` encuentra a `José`, el contador refleja su alta y una cuenta sin envío no cuenta» **PASS en primera ejecución (28.0s)**, log línea 539. Ese spec ejecuta la escritura real con moto `AE 002 EE`, DNI nulo, flags `pending/false/null` y los contadores/ausencia de la cuenta sin envío añadidos en ronda 2.

**Status de commit:** `e2e-preview=success` para `7e52b87`; job `resolve-preview=success`, `e2e-preview=success` y `report-preview-status=success`. El run cancelado del SHA intermedio `5ea4c55` ya no es condición pendiente porque **el mismo código** fue probado y pasó en `7e52b87`.

## 2. Resultado de tests y CI

| Gate | Resultado |
|---|---|
| `typecheck` | SUCCESS |
| `lint` | SUCCESS |
| `build` | SUCCESS |
| `unit` | SUCCESS — **192 archivos, 3532 tests** |
| `db-tests` | SUCCESS — **42 archivos, 3396 tests, PASS**; pgTAP CC-043 y CC-044 OK; `db:types` y diff de tipos OK |
| `audit` | SUCCESS |
| `bundle-budget` | SUCCESS con advertencia advisory — `/admin/applicants` 264 kB frente al presupuesto 180 kB |
| `e2e-preview` | SUCCESS — **114 passed + 1 flaky** en Chromium; **6 passed** extra de global-settings |

**Único flaky:** `e2e/specs/courier-onboarding.spec.ts:1723` / `:1755`, T-376, seguro PDF. En el primer intento no se encontró «En revisión manual» a los 20 s; **retry #1 PASÓ**. Este spec y flujo son ajenos a T-403 y no forman parte del diff. No se oculta ni se presenta como 115 PASS sin excepciones. La suite de T-403 pasó al primer intento.

## 3. Cierre del hallazgo PR605-H01

- **Severidad original:** alto, `P08`; el E2E anterior no podía distinguir `vehicle_type IS NOT NULL` de `application_submitted`.
- **D01=A** resuelta por Lautaro073; arreglada por el autor en `5ea4c55`. La cuenta sin envío tiene vehículo `moto`, patente `AE 002 EE`, DNI nulo y se corrobora con DB real como `pending`, `application_submitted=false`, `submitted_at=null`. Las aserciones UI no se debilitaron.
- **Verificación independiente**: inspección del diff R1/R2 y **E2E real terminado en 7e52b87**, que ejecutó y pasó el caso en primera ejecución; los checks CI completaron con éxito.
- **Nuevo estado:** **`arreglado-verificado`**, `ronda_arreglo=2`, `verificado_en_sha=7e52b87a2673ffbacfbd544f3c191b463ebe3c62`. Sin hallazgos nuevos.
- **Mutación SQL real:** **NO ejecutada**, correctamente declarada y **NO** atribuida como evidencia. PgTAP y experimento aislado [issue #606](https://github.com/cadeApp/cadeApp/issues/606) fuera de T-403, seguimiento no bloqueante.

## 4. Aceptación, alcance y límites

**Informe revisar-pr — T-403 — 2026-11-04 — revisión independiente**

**Resultado: SIN BLOQUEANTES · ACEPTADA PARA INTEGRACIÓN.**

**BLOQUEANTES:** ninguno.

**MEJORAS / SEGUIMIENTO NO BLOQUEANTE:** issue #606, reforzar pgTAP CC-044 fuera de alcance; flaky de T-376 ajeno a T-403; presupuesto advisory `/admin/applicants 264 kB`, sin prueba de regresión atribuible.

**Checks de CI:** typecheck ✅ · lint ✅ · test ✅ (3532/3532) · db-tests ✅ (3396/3396) · e2e-preview ✅ (spec de T-403 primera ejecución); flaky ajeno documentado.

**No revisado con ejecución local:** mutación SQL real en base aislada; comandos locales porque no había clon accesible. No se inventa RED.

**Decisiones pendientes:** ninguna. Se respeta D01=A y el perímetro de la ficha.

**No se ejecutó** APPROVE, Ready for review ni merge: la PR sigue Draft hasta que su dueño decida integrarla. El commit que solo incorpora este cierre documental tampoco cambia el código ni invalida el E2E del SHA `7e52b87`; no exigir otro gate únicamente por documentación.

**Evidencia trazable:** [evidencia/comandos.md](../evidencia/comandos.md) — sección E05.
