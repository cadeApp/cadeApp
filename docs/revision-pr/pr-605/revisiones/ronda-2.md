# Revisión independiente — PR #605 / T-403 — ronda 2 (2026-11-04)

**SHA de código revisado:** `5ea4c55a0a3b7e8f7cd875b287f4fa8af725fc6a` · **Commit anterior de revisión:** `8a16d2c9b584cc986372aea19aa947b257ffd06e` · **Base de PR:** `844bab43491fb30f171b6a72e9ec750a93f40dbc`.

**Resultado: 0 hallazgos nuevos por inspección; H01 ARREGLADO-SIN-VERIFICAR (gate E2E pendiente).** No aprobar ni mergear hasta los checks terminados y comprobados. No hay nuevas decisiones para Lautaro073.

## Revisión del delta y permisos

- `compare 8a16d2c...5ea4c55`: **1 commit, 2 archivos**, y ningún cambio adicional: `e2e/specs/admin-applicants-search.spec.ts` (+20/-1) y `docs/tasks/log/T-403.md` (+13/-0). Ambos están en la ficha **T-403 leída desde develop**; la ficha ni la carpeta `docs/revision-pr/pr-605/` fueron tocadas por el autor.
- La PR sigue `draft`, `mergeable=true`, **0 behind develop** según el compare de GitHub en el momento de revisar. El HEAD remoto coincide exactamente con `5ea4c55a0a3b7e8f7cd875b287f4fa8af725fc6a`.
- Comentarios revisados: aviso Vercel y comentario de ronda 1; **0 hilos técnicos nuevos**.
- No se ejecutó `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` local: no hay clon y `git ls-remote` devuelve `Could not resolve host: github.com`. Los archivos se verificaron por GitHub, y `hallazgos.jsonl` se validó con `JSON.parse` antes de registrar el cambio.

## H01 — corrección comprobada por inspección y auditoría estructural independiente

**Ubicación:** `e2e/specs/admin-applicants-search.spec.ts`, bloque añadido inmediatamente después de crear y renombrar `unsubmitted`.

- Se llama realmente a `createAdminClient().from('couriers').update({ vehicle_type:'moto', vehicle_plate:'AE 002 EE', dni_hmac:null })` con `.eq('profile_id', unsubmitted.id)`, seguido de `.select(...).single()`. Si falla o no hay fila, el spec falla explícitamente.
- `expect(partialCourier).toMatchObject` exige `status:'pending'`, la moto y patente guardadas, DNI nulo, `application_submitted:false` y `submitted_at:null`. El chequeo se ejecuta **antes** de usar el buscador en la cola.
- Las aserciones UI anteriores no se redujeron: `0 pendientes` antes del cambio del courier enviado, `1 pendiente` después, una sola fila José, ausencia de «sin envío» y conservación de `q` al cambiar pestaña.
- La migración CC-043, en develop, permite ese estado porque la guarda de compatibilidad requiere conjuntamente `dni_hmac != null` y `vehicle_type != null` para bloquear el update previo al envío. CC-044 sigue leyendo `application_submitted`; el spec nuevo podría detectar el falso filtro `vehicle_type is not null`.
- **Comprobación propia ejecutada (estática, no DB):** un auditor de fuente sobre el spec real de GitHub dio **RED en la ronda 1**, **GREEN en la ronda 2** y **RED al quitar en memoria todo el nuevo bloque**. Se requirieron `update` y `select`, flags falsos y contador 0/1. No se debe describir este control como E2E ni como mutación SQL.

### Límite de verificación

No se ejecutó `c.application_submitted` → `c.vehicle_type is not null` sobre una base aislada. El autor lo declaró honestamente como **no ejecutado**; usar Supabase Develop compartido sería incorrecto. La prueba SQL de defensa queda en [issue #606](https://github.com/cadeApp/cadeApp/issues/606), **fuera de la ficha T-403**. A falta de E2E terminado, H01 queda en `arreglado-sin-verificar`, con `verificado_en_sha=null`. No se falsea el estado.

## CI leído (SHA de código `5ea4c55`)

- [CI run 41913324153](https://github.com/cadeApp/cadeApp/actions/runs/41913324153): `typecheck`, `lint`, `build`, `unit`, `audit` y `bundle-budget` **success**; `db-tests` seguía **in_progress**.
- `unit` (job 126867000598): **192 test files / 3532 tests passed**, extraído del log de la misma ejecución.
- `bundle-budget` (job 126867959689): `/admin/applicants` muestra **264 kB** frente a 180 kB advisory. Era 265 kB en la ronda 1: no se atribuye una regresión a esta corrección del E2E; el check es advisory y no basta mirar que diga «success».
- [e2e-preview run 41913467285](https://github.com/cadeApp/cadeApp/actions/runs/41913467285): `resolve-preview` **success**, `e2e-preview` **in_progress** en la consulta; `e2e-preview` status del SHA `pending`. No se afirma que el nuevo spec haya corrido o pasado hasta que el job concluya y sus logs confirmen.
- No se reejecutó localmente `pnpm test` ni se reprodujeron M1–M3 del autor. La bitácora dice `pnpm vitest run src/features/admin` → 397 passed, `pnpm typecheck` y eslint sin errores; es evidencia del **autor**, no independientemente reproducida.

## Decisión, estado y próximo gate

- **D01=A:** implementada sin crear ampliaciones, sin decidir nada nuevo por cuenta del usuario.
- **Hallazgos nuevos:** ninguno. **H01:** `arreglado-sin-verificar` por E2E aún no concluido. **No listo para merge**.
- **Para cerrar H01:** GitHub status `e2e-preview=success` del SHA `5ea4c55`, abrir el log de `Run preview E2E gate` y confirmar que `admin-applicants-search.spec.ts` se ejecutó y pasó; revisar `db-tests` con `Files=`, `Tests=`, `Result: PASS` y `db:types --local`/diff. Si falla, abrir un hallazgo nuevo con evidencia real, sin inventar un GREEN.
- El commit de esta **revisión solo cambia documentación**. Según la regla décima, no exigir otro CI verde por ese commit documental cuando se verifique el SHA de código.

**Publicar un único comentario de ronda 2 en la PR; no hacer APPROVE ni merge.**
