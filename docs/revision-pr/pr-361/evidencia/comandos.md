# Evidencia reproducible — PR #361 / ronda 1

## Alcance de esta revisión
**Solo inspección estática remota:** no hubo clon de trabajo utilizable ni ejecución de comandos. No hay demostración RED→GREEN independiente, ni se afirma lo contrario. Las líneas siguientes son instrucciones para la **próxima revisión**, no resultados ya obtenidos.

**SHA inspeccionado:** `5d1be4bc129e96a4ba16e493ef355206ee74c44e`
**Base:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`

## Inspección estática comprobada por lectura
- El diff del PR solo modifica `docs/tasks/log/T-364.md` y `src/features/requests/components/merchant-requests-list.test.tsx`.
- `src/features/trips/actions.ts` ya contiene `merchantCancelTripAction` que valida rol y delega la RPC `cancel_request`.
- `src/domain/errors.ts`: `err(code)` produce `{ ok:false, code }`.
- `src/features/trips/components/trip-cancel-dialog.tsx`: dos pasos y motivos.
- SQL de `request_transition` en migración `20260924010124_rpc_requests_v1.sql` y sustituciones posteriores: merchant cancela `published/matched`; para `published` expirada retorna `REQUEST_EXPIRED`.
- `src/features/requests/queries.ts` filtra por estado persistido, no convierte `published` caducada antes de pintar el listado.
- `mockRefresh` carece de `clearAllMocks`, y es consultado en dos tests distintos por `toHaveBeenCalled()`.

## Comandos a ejecutar en una siguiente sesión con clon y dependencias

```bash
git fetch origin
git checkout feat/T-364-cancelar-desde-mis-solicitudes
git status --short
git rev-parse HEAD
git diff --stat origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/features/requests/components/merchant-requests-list.test.tsx > /tmp/pr361-unit.log 2>&1
grep -E 'Test Files|Tests|FAIL|PASS' /tmp/pr361-unit.log | tail -25
```

**No lanzar Docker ni Supabase local.** Para E2E usar los mecanismos de Preview+Develop ya previstos. No usar `--force`, rebase, secretos ni producción.

## Batería de mutaciones independientes a preparar cuando haya un baseline GREEN

1. **H02:** quitar `router.refresh()` del camino `INVALID_STATE_TRANSITION` sin tocar el camino de éxito; exigir que el test específico falle. Comprobar GREEN antes y después de restaurar.
2. **H03:** cambiar el mapeo de `INVALID_STATE_TRANSITION` por un mensaje genérico; exigir RED del oráculo que usa una respuesta `{ok:false,code:'INVALID_STATE_TRANSITION'}` real.
3. **H04:** alterar el predicado de visibilidad para admitir `published` con `expiresAt <= now`; exigir RED con reloj fijo.
4. **H01:** evitar la llamada real a `merchantCancelTripAction` en confirmación y demostrar RED en control de ejecución; las mutaciones sobre permisos deben seguir `e2e-mutation`, nunca desplegar una versión insegura.

**Limitación conocida:** todavía no es posible ofrecer un harness mutacional reproducido para esos caminos porque en el SHA de esta ronda los caminos no existen. Fabricar un falso GREEN/RED violaría las reglas de revisión. En la siguiente ronda, incorporar el script completo ejecutado y su resumen, no solo esta lista.
