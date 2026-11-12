# Informe de revisión independiente — PR #737 / T-434 / CC-050

**Fecha:** 2026-11-12  
**SHA revisado:** `a810fdbff53f1bbf43d304cef1af72258dc74625`  
**Base develop:** `632a04f585d4f3ed511a04c45b9407cfe95ec00a`  
**Rama:** `fix/T-434-e2e-submitted-applicants`  
**Resultado de inspección:** **SIN BLOQUEANTES** (0 hallazgos confirmados, 0 mejoras necesarias).  
**Límite de cierre operativo:** falta conocer la ejecución e2e-preview contra este SHA; **NO se declara E2E GREEN ni se autoriza el merge**.

## 1. Alcance y comparación

`compare_commits` informa `ahead_by=1`, `behind_by=0`, base común `632a04f585d4f3ed511a04c45b9407cfe95ec00a`; GitHub reportó `mergeable=true`. No pude ejecutar `git merge-tree` local: no hay clon y el entorno no resuelve github.com. Estos datos no sustituyen una comprobación `merge-tree` posterior si develop avanza.

La ficha leída en `develop` permite explícitamente `e2e/specs/courier-onboarding.spec.ts`, `docs/tasks/log/T-434.md` y `docs/revision-pr/**`. El diff cambia **solo** spec (+7) y bitácora (+21). No cambia ficha, contratos, SQL, RLS, dependencias ni workflows. No existía carpeta `pr-737` en el head examinado; no hay rondas previas ni evidencia de escritura por el autor allí.

La comparación completa del spec, al suprimir exactamente las siete líneas añadidas (import, tres comentarios y tres llamadas), es **idéntica byte a byte** al spec del SHA de base. Por eso no se eliminaron, comentaron ni debilitaron aserciones; no hay `skip`, `only` ni mocks nuevos por este diff.

## 2. Contraste del arreglo

| Caso | Línea añadida en head | Comprobación |
|---|---:|---|
| DoD MFA / T-302 | `e2e/specs/courier-onboarding.spec.ts:304` | `usePendingOnboardingCourier(...,0)` seguido de `finalizeSeededCourierApplication(...,'bike',null)`, antes del intento `AAL1` y de la aprobación `AAL2`. Se conservan `AAL2_REQUIRED`, estado aprobado y `audit_log`. |
| Flujo 3 — aprobar desde UI con MFA | `...:814` | Finaliza antes de `page.goto`; sigue comprobando MFA real en UI, botones, estado, `decided_by` y audit. |
| T-404 — rechazar desde UI | `...:918` | Finaliza antes de navegar. Conserva motivo obligatorio, composición `Foto ilegible: ...`, audit y recorrido al historial. |

El helper existente `src/server/e2e/staging-seed.ts` inserta cuatro `courier_documents` (dni_front, dni_back, selfie, avatar) y llama a `finalize_courier_application` con HMAC de prueba aleatorio; propaga ambos errores y **no escribe manualmente** `application_submitted` ni `submitted_at`. Es exactamente el helper que emplea el seed aprobado. La rama `not_submitted` crea un courier `pending` sin alta, por lo que los tres arreglos cambian la precondición pertinente y no la política de autorización.

La ordenación del historial T-404 es ascendente y preserva el hito inicial `registered`; la postulación enviada agrega su hito posterior, no sustituye la primera entrada. No se encontró regresión demostrable por esa nueva precondición.

## 3. Evidencia RED y control independiente

**RED real anterior (no una mutación inventada):** en el [e2e-preview #43262434862](https://github.com/cadeApp/cadeApp/actions/runs/43262434862), SHA `632a04f585d4f3ed511a04c45b9407cfe95ec00a`, los tres E2E fallan tres veces cada uno:

- MFA `:271`: el intento de aprobación después de AAL2 retorna `INVALID_STATE_TRANSITION`.
- Flujo 3 `:803`: `Aprobar` no está visible.
- T-404 `:906`: la toolbar carece de `Rechazar/Aprobar`.

**Batería propia estática** sobre los archivos de ambos SHA, no delegada al autor: el control da GREEN con las tres precondiciones y al retirar en memoria, de forma independiente, cada llamada nueva (M1, M2, M3), da RED con `finalizer count 0=0`, `1=0`, `2=0`, respectivamente. Además verifica igualdad total del resto del spec, no solo conteos. Script autocontenido y comandos en [evidencia/comandos.md](../evidencia/comandos.md). **No es Playwright RED/GREEN** y no se lo presenta como tal. El E2E RED anterior sí se reprodujo en CI; el GREEN real del head aún necesita su corrida.

## 4. Checks y limitaciones

| Check | Evidencia observada / alcance |
|---|---|
| Unit | Job `unit` successful del CI 43273220950 del head revisado; 209 archivos pasaron. |
| Typecheck, lint, build, audit, bundle-budget | Jobs successful del mismo CI, SHA `a810fdbff53f1bbf43d304cef1af72258dc74625`. |
| db-tests | En progreso al observar el run; sin afirmar `Files=… Tests=…` ni drift de tipos. No se levantó Docker/Supabase local. |
| E2E | **Pendiente**: el workflow `e2e-preview.yml` corre como `workflow_run` solo tras CI verde, hace build del SHA de PR y publica commit status en ese SHA. Ningún GREEN del head disponible al corte. |
| Validación de carpeta | Datos `hallazgos.jsonl` vacíos (0 hallazgos). No se pudo ejecutar `node docs/revision-pr/analizar.mjs verificacion` localmente al faltar un checkout de repositorio; se documenta en vez de simularlo. |
| Reproducción Playwright propia | No ejecutada: esta sesión no tiene clon ni acceso local al entorno develop. No se lanzaron workflows remotos manualmente. |

**Nota:** `approval-policy` successful solo valida presentación; no sustituye la revisión independiente.

## 5. NO TOCAR — falsos positivos descartados

- **No exigir que `finalizeSeededCourierApplication` corra desde la UI** en estos tres casos: es una *fixture* autorizada, que usa la misma RPC real y documenta explícitamente sus datos de prueba. La prueba MFA/UI de decisión continúa atravesando el backend real. El flujo de envío por UI existe en otro caso del mismo spec.
- **No acusar falsos verdes por los nueve reintentos previos:** los tres casos fallaron antes del cambio en la condición que ahora se prepara. No se modificaron sus expectativas.
- **No cargar a T-434 el 500 de map-privacy:** existía antes de esta PR y está abierto en [issue #478](https://github.com/cadeApp/cadeApp/issues/478); sí se debe seguir investigando sin ocultarlo. El flaky T-376 tiene resultado exitoso en el primer retry del run anterior.

## 6. Conclusión y acción humana

**Bloqueantes del diff: ninguno. Mejoras demostradas: ninguna. Decisiones abiertas: ninguna.**

**Antes de mergear:** mirar el e2e-preview de `a810fdbff53f1bbf43d304cef1af72258dc74625`. Si los tres casos T-302/T-404 pasan y solo permanece un fallo demostrablemente preexistente, separar formalmente su tratamiento bajo #478 y la política del gate; **no llamar GREEN a una corrida RED**. Si surge fallo nuevo atribuible a #737, abrir ronda 2 y corregir sin falsificar ni rebajar pruebas.

Se puede consultar el commit de documentación que cierra esta ronda sin exigir una nueva suite verde por el mero cambio documental. Lautaro073 conserva la decisión y la operación de merge.
