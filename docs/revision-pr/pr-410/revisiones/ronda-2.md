# Ronda 2 — PR #410 / T-355 — 2026-10-18

**Informe revisar-pr — T-355 — ronda 2 — revisión independiente**  
**Resultado: CON BLOQUEANTES (2)**: H05 (E2E sin resultado definitivo al inspeccionar) y H09 (nuevas aserciones/casts prohibidos por reglas raíz). **Mejora:** H10 (nuevo `as never` de tipado, no bloqueante).  
**SHA revisado:** `56c458a335e0ff7b729038e16b2e34ad101a8175` · **Base `develop`:** `29a44225513621ca9430924cd90d4c929c219e8d`. `mergeable=true`; la rama está **behind 0 / ahead 9** a este SHA y ya incorporó CC-031 por merge normal `6013eca2`. **No aprobado ni mergeado**.

## Contraste independiente de ronda 1

| Hallazgo | Resultado de ronda 2 | Evidencia |
|---|---|---|
| H01 logs con datos sensibles | **Corregido** | `actions.ts` registra mensaje constante; test de `error.message` contaminado afirma ausencia del teléfono. |
| H02 bypass de identidad | **Resuelto fuera de #410** | CC-031 PR #414 mergeada en `develop` (29a44225) con guard OLD/NEW y pgTAP + concurrencia + mutación RED→GREEN, testigo CI del nuevo SHA. |
| H03 payload manipulable no comprueba cero mutaciones | **Corregido** | `actions.test.ts` itera 7 payloads y `expect(mockUpdate).not.toHaveBeenCalled()` para cada uno. |
| H04 E2E sin precarga ni segunda sesión | **Código corregido, ejecución pendiente** | `authorization.spec.ts` afirma `toHaveValue(previousPhone ?? '')`, recarga y segunda sesión `browser.newContext`. No atribuir E2E PASS hasta correrlo. |
| H05 evidencia E2E/DoD | **PARCIAL / BLOQUEANTE** | `docs/tasks/T-355.md` mantiene E2E `[ ]`. Al mirar la última CI, run `39106647405` seguía **`in_progress`**; el job `Run preview E2E gate` en ejecución, sin resultado del caso T-355. |
| H06 condición de rol TOCTOU | **Corregido** | `actions.ts:524-527` usa `.eq('id', user.id).eq('role','courier').select(...)`; test de retorno NOT_FOUND con 0 filas, sin revalidar path. |
| H07 prefijo HMAC serializado | **Corregido** | `page.tsx:114-117` proyecta solo `hasDniOnFile: Boolean(courier.dni_hmac)`; test serializa salida y rechaza HMAC/prefijo. |
| H08 restauración ante fallo inicial | **Código corregido, ejecución pendiente** | `authorization.spec.ts:324-326,391-400` exige lectura inicial sin error y verifica `restoreError === null`. El `!` introducido aquí genera H09. |

**Nota de integridad:** los arreglos de código fueron comprobados por inspección propia y contraste de la suite `unit` del SHA, no por una mutación local inventada. La prueba RED del autor no se reejecutó independientemente: DNS impide clonar y el usuario prohibió encender Docker. No se afirma haber realizado validación E2E.

## Nuevos bloqueantes

### PR410-H09 · MEDIO · `any`/non-null assertions NUEVOS prohibidos

- `src/app/(courier)/courier/profile/page.test.tsx:266`: `expect((profile as any).dniHash).toBeUndefined()` introduce un `any` nuevo para verificar una propiedad que debería estar **ausente del objeto público**. Sustituir por `expect(profile).not.toHaveProperty('dniHash')` sin cambiar la expectativa.
- `src/features/courier-onboarding/components.test.tsx:909`: `.closest('.space-y-4')!` introduce una non-null assertion. Usar comprobación y guard explícito antes de `within(personalCard)`.
- `e2e/specs/authorization.spec.ts:326,390`: `initialProfile!.phone` y `initialProfile!.display_name` introducen non-null assertions. Después de `expect(initialProfileError).toBeNull()` y `expect(initialProfile).not.toBeNull()`, exigir guard TS `if (!initialProfile) throw new Error('...')` y usar `initialProfile.phone` y `initialProfile.display_name`. Conservar todas las aserciones E2E, especialmente igualdad exacta y restauración.

**Causa:** AGENTS.md §4 prohíbe `any`, `@ts-ignore`, `!` non-null. No reportamos los `as any` **preexistentes** del mismo archivo como cambios de esta PR; solo las líneas nuevas citadas. Un check verde no habilita excepciones.  
**Probar:** `pnpm typecheck && pnpm lint && pnpm test`; exigir prueba estática independiente sobre **líneas añadidas** de que estas expresiones ya no existen, y mutación local del chequeo para demostrar sensibilidad, sin adulterar fixtures/mocks/expectations.

### PR410-H05 · ALTO · E2E Preview aún no acreditado

**Lugar:** `e2e/specs/authorization.spec.ts:305-403`, `docs/tasks/T-355.md` DoD E2E.  
En `56c458a335e0ff7b729038e16b2e34ad101a8175`, Vercel READY, el workflow general **sí pasó**, pero el `e2e-preview` independiente (run [39106647405](https://github.com/cadeApp/cadeApp/actions/runs/39106647405), job 117614583076) permanecía **en ejecución** cuando se inspeccionó. No hay aún prueba verificada del caso T-355, no corresponde marcarlo verde ni inventar causa.  
**Corrección:** revisar resultado definitivo; si falla, citar spec/caso/trace y corregir únicamente la causa en el alcance autorizado, demostrando RED/GREEN real. Si falla otra tarea, documentar bloqueo y gestionarlo por su issue/PR; **no editar E2E ajeno, workflows ni SQL desde #410**. Para cerrar H05, informar run PASS, SHA, nombre exacto del test T-355 y persistencia/restauración. El check global puede estar bloqueado por un caso ajeno: no confundir ese hecho con que el propio E2E haya corrido.

## Mejora no bloqueante H10

`src/features/courier-onboarding/actions.ts:523` añade `.update({phone: parsed.data.phone} as never)`; `src/types/database.types.ts` sí declara `profiles.Update.phone?: string | null`. El cast nuevo omite comprobación de columnas por TS. Intentar `satisfies TablesUpdate<'profiles'>` / eliminar `as never` si tipado lo permite, y justificar de forma concreta si el cliente obliga a otro patrón. **No tocar tipos generados**. No se exige ronda extra por un ajuste documental.

## Evidencia de CI para el SHA exacto

- [Workflow general 39106586647](https://github.com/cadeApp/cadeApp/actions/runs/39106586647): `typecheck`, `lint`, `unit`, `audit`, `build`, `bundle-budget`, `db-tests`, `approval-policy`: **SUCCESS**.
- `unit` (job 117613641164): Vitest **145 archivos PASS**; bitácora del autor declara 2782 casos, el log leído confirma archivos.
- `db-tests` (job 117613641146): `Files=30, Tests=2815, Result: PASS`; evidencia CC-031 integra escenarios A/B/C, mutación RED auténtica `exit 1`, restauración `exit 0`, y `db:types --local` sin diff.
- Vercel: READY. `e2e-preview`: **PENDING** a la fecha/hora de inspección, no fracaso ni éxito.
- Alcance: 16 rutas cambiadas vs develop, todas dentro de `docs/tasks/T-355.md`; no cambia `supabase/**`, `src/domain/**`, `.agents/**` ni `.github/**` en esta PR. La ficha actualizó CC-031 de «pendiente» a «mergeada», **sin ampliar archivos permitidos**.
- No hubo checkout Git, test local, mutaciones, `git merge-tree`, Docker, Supabase remoto ni E2E ejecutado manualmente por la revisión. `mergeable=true` informado por GitHub, pero no sustituye test de integración local.

## Veredicto

**CON BLOQUEANTES (2) al SHA `56c458a335e0ff7b729038e16b2e34ad101a8175`: H09 y H05.** La implementación central del teléfono y el CC-031 ya están técnicamente encaminados; evitar reabrirlos sin nueva evidencia. No aprobar ni mergear antes de corrección de H09, resultado real del E2E, y ronda 3 independiente si hubo commits de código. `approval-policy` actual verde no sustituye revisión independiente.
