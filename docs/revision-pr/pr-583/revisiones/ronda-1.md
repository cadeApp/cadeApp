# Ronda 1 — PR #583 · T-401 — 2026-11-03

**SHA:** `b082fe414a3eb2507b5b08fa5d013499f8cf5586`.
**Base:** `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a`.
**Resultado: SIN BLOQUEANTES** de código detectados **por inspección y CI**. No significa que E2E ni mutaciones propias hayan sido ejecutadas: ambos se delimitan abajo. No se aprobó ni mergeó.

## Método y alcance

- Lectura de la ficha `docs/tasks/T-401.md` desde `develop`, bitácora del HEAD, diff, comentarios de PR, reglas de revisión y lecciones previas.
- Los **10 archivos cambiados** están incluidos en «Archivos permitidos». La ficha no se alteró, sin `supabase/**`, CC, dependencias, RLS ni contratos compartidos modificados.
- La comparación GitHub es 1 ahead / 0 behind, PR mergeable según API. No se pudo ejecutar `git merge-tree` ni `pnpm` local por no tener clon y por DNS de `github.com` bloqueado en este entorno.

## Barrido de la clase entera, no solo de un caso

| Superficie | Código y contrato verificados por inspección |
|---|---|
| Cola de postulantes | `getApplicantsQueue` (archivo `queries.ts` con `import 'server-only'`) selecciona HMAC internamente bajo sesión/RLS, pero mapea cada fila a un objeto nuevo con `hasDni: Boolean(c.dni_hmac)`; no serializa el HMAC |
| Detalle | `getApplicantDetail` hace la misma conversión, sin spread de la fila de DB ni propiedad `dniHash` en el resultado |
| UI postulantes | `ApplicantsQueue` y `ApplicantDetailView` usan `DNI cargado` / `DNI pendiente`; ningún JSX de esas vistas muestra hash |
| Lista de comercios | `merchantDisplayName` normaliza vacío, espacios y trim; `signupIncomplete` gobierna celda con responsable y etiqueta secundaria; título de diálogo y nombres accesibles reciben `businessName` normalizado |
| Créditos | `getAdminMerchantHeader` usa el mismo helper; `MerchantCreditsView` y diálogos reciben ese encabezado desde servidor |
| Contrato de DB | `merchants.business_name` es `string` no nulo en `src/types/database.types.ts`; no se acusa null no permitido |
| Tests | Nueva cobertura de vacío/blancos/normalizado, true/false, objeto sin HMAC, UI de cola/detalle, enlace accesible y diálogo; se inspeccionaron los tests además de los componentes |

Un barrido estático independiente sobre cinco archivos productivos dio: `server-only=true`; `dniHash` **0 apariciones**; expresiones de mapeo `hasDni: Boolean(c.dni_hmac)` **2**; helper de fallback **1**; bandera de alta incompleta **1**; condicionales JSX de interés **3**. Esto es inspección, no un sustituto de ejecutar mutaciones.

## Evidencia oficial y revisión de warnings

- CI `unit` run `41724697871`, job `126226297710`, para el SHA revisado: **189/189 archivos, 3460/3460 pruebas**. Además workflows 81 pass y ADR 6 pass.
- `typecheck`, `lint`, `build` y `audit`: SUCCESS para el SHA.
- `db-tests` del mismo run: log final **Files=40, Tests=3252, Result: PASS**; el paso `git diff --exit-code -- src/types/database.types.ts` concluyó verde. El log contiene rojos de mutaciones deliberadas anteriores al PASS, que no son fallos finales.
- `bundle-budget` devuelve SUCCESS pero su log señala `/admin/merchants` y `/admin/merchants/[merchantId]/credits` a **263 kB, «Supera el límite»**. Comparado con `develop` SHA `2ed5ef1`, run `41722964415`/job `126221169120`: **263 kB en ambas rutas**. Warning real **preexistente**, no regresión de T-401 (pr-82/AG-92).
- `approval-policy`: fallo por «Falta el informe completo de revisar-pr sin bloqueantes». La política inspeccionada exige reportar en el **cuerpo** de la PR, no basta el comentario. Se debe actualizar la sección del cuerpo.
- `e2e-preview` de la PR seguía en ejecución al redactar; **no se declara verde** hasta verificar la conclusión.

## BLOQUEANTES

Ninguno atribuible al código cambiado en este SHA.

## MEJORAS / LIMITACIONES

- El warning de bundle se documenta como deuda de `develop`, sin pedir refactor fuera de T-401.
- **No hay validación visual autenticada** de los estados reales en Preview; el smoke necesita administrador de pruebas.
- Los RED declarados por el autor **no pudieron reproducirse independientemente**. Se redactó un arnés nuevo para nueve mutaciones, con control GREEN, mutación RED por aserción y restauración GREEN, **pendiente de ejecución**. No se inventa un resultado 9/9 ni `verificado_en_sha`.
- No se activaron Docker, Supabase remoto ni workflows manualmente.

## Decisiones

**Ninguna decisión nueva** identificada en la tarea. No hay ampliación de alcance.

## Estado de la ronda

Sin bloqueantes técnicos detectados por inspección y checks disponibles; gate E2E y smoke funcional no verificados al cierre de este documento. El juicio de readiness final depende de esos resultados. Evidencia y guion completo en [evidencia/comandos.md](../evidencia/comandos.md).
