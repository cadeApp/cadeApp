# PR #329 / T-340 Paso 3 — Ronda 1 independiente

## Alcance y sincronización

PR `#329`, rama `fix/T-340-postmerge-e2e-private-fixtures`, base `develop`, HEAD inspeccionado `767e382abfed73eb2dd266a63a22b20d9d4bc2e8`. Comparación GitHub `883ee17d...HEAD`: 2 commits, sin conflicto informado por API (`mergeable=true`); solo 3 archivos: `e2e/specs/courier-feed-privacy.spec.ts`, `e2e/specs/courier-private-columns.spec.ts`, `docs/tasks/log/T-340.md`. La ficha `docs/tasks/T-340.md` se leyó desde `develop`; su alcance permite adaptar specs E2E, y no se modifica ficha, contrato, migraciones ni código productivo.

## Verificación de H01 previo — T-342

En el primer spec, la escritura al padre ahora solo ajusta `recipient_payment_method='cash'` y `needs_change=true`; comprueba que `notes` y `cash_change_amount` del padre permanecen NULL en published. Busca `position=1` y toma las notas verdaderas desde `delivery_request_drop_contacts`; asigna allí el monto y valida el dato. Se preservaron los oráculos negativos del feed y oferta **antes del match** y los positivos de viaje después de `accept_offer`. El RED original era el error de seed `sin notes` del run `38486242487` — no una fuga — y el GREEN real posterior está en `38491111892` sobre `bd46622b` (test T-342 PASS).

## Verificación de H02 previo — T-345

El segundo spec reutiliza el mismo seed privado; no repuebla columnas legacy. Sustituye el UPDATE que alteraba `delivery_requests.cash_change_amount` por un UPDATE de `updated_at`, que usa `public.set_updated_at`, y correlaciona el evento Realtime **recibido desde Supabase** por ID y timestamp real. Conserva `42501` en PostgREST para ambas columnas privadas y `*`, negativa del payload Realtime, acceso al comercio y acceso post-match al viaje real. El monto 6000 se actualiza solo en `drop_contacts` y se afirma `notes` no alterada. El GREEN remoto T-345 del run `38491111892` demuestra que hubo evento útil y se cumplieron las aserciones; el RED anterior `notes/status inválidos (published)` era de seed.

## Validación de CI y reservas

- `38491111892`, job `115616301245`: checkout de `bd46622be411277a377e4bb39d662418e02da1c3`. **72/72 Chromium PASS**, incluidos T-342, T-345, `multi-drop.spec.ts`, `t340-legacy-checkpoint.spec.ts`. **3/3 global-settings PASS** (incluye DoD 2). Se inspeccionaron las líneas reales del log del job (no solo el color del workflow ni la declaración de Kira).
- Para HEAD `767e382abfed73eb2dd266a63a22b20d9d4bc2e8`: `unit`, `db-tests`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `approval-policy`, Vercel SUCCESS por GitHub; la nueva corrida `e2e-preview` [38492968909](https://github.com/cadeApp/cadeApp/actions/runs/38492968909) estaba **IN PROGRESS** al documentar.
- El código no cambió entre `bd46622b` y `767e382a`: solo +12 líneas de bitácora, comparación mecánica de GitHub.
- `pnpm test` local fue reportado por el autor como FAIL por timeouts ajenos a los archivos de la PR; no se reprodujo localmente por esta revisión; el job `unit` remoto sobre el HEAD sí fue SUCCESS. No ocultar el dato.
- Mutantes negativos independientes M-T342/M-T345 **NO EJECUTADOS**: no se usó Supabase remoto manual ni se dispararon workflows. Se inspeccionó que los controles no son constantes ni mocks: datos de seed real, navegador real, cliente autenticado y evento Realtime real. No confundir inspección con ejecución independiente.
- La PR no modifica pruebas para omitir validaciones: `.skip/.only`, stubs y relajación de timeouts no aparecen en el patch. No se encontró adulteración de tests para lograr el verde.

## Estado

**SIN BLOQUEANTES DE CÓDIGO DETECTADOS por lectura completa del diff y resultados comprobados en CI.** Se puede evaluar el merge una vez que el gate E2E del HEAD que finalmente quede en PR termine en GREEN (el commit documental de esta revisión moverá el SHA y volverá a disparar checks; no aprobarlo sobre resultado antiguo). **No se aprueba ni se mergea esta PR por el revisor**. La PR #327 nunca se integra. Después de integrar #329, actualizar #327 con merge normal desde `develop`, producir Preview nuevo, comprobar Chromium + global-settings completos y cerrar #327 sin merge; solo entonces desbloquear Paso 4.

No hay decisión de alcance pendiente ni corrección funcional adicional indicada al autor. Informe basado en código y logs reales; no hubo ejecución E2E por esta sesión.
