# Evidencia independiente — PR #376 ronda 2

**Fecha:** 2026-10-16. **SHA examinado:** `11e2c7750ce037df022e74ed53bbd065a5dd2a66`.
**Alcance:** lectura de fuente GitHub, git compare, comentarios, bitácora, CI logs; **no** SQL de DB/Docker local ni remoto por revisor. No E2E de onboarding ejecutado por este revisor.

## Verificado por inspección del código
- `src/features/courier-onboarding/actions.ts:29–78` contiene helper exportado `validateCurrentDocumentSet`, con estados `MATCH, DUPLICATE, MISSING, DIFFERENT_PATH, INVALID_STATUS` y filtro `is_current !== false`.
- `actions.ts:250–273`: validación explícita de status `submitted/verified` en el camino inicial y no éxito con rejected. Caso `o` de Vitest cubre rechazo sin INSERT ni update.
- `actions.ts:322–353`: recovery y postSELECT llaman al helper; casos `p,q,r,s` y 6 unit específicos prueban rutas distintas, rechazado, faltantes, duplicados e históricos.
- `actions.ts:228–279,337–368`: proceso compuesto por varios requests a Supabase, sin RPC/lock transaccional. `20260922031435_schema_v1.sql` define `UNIQUE(storage_path)`; `20261015153311_cc025_expand_courier_documents.sql` no tiene unique por (courier,kind). H01 sigue con posibilidad de duplicados. El test `n` es mock, no dos sesiones reales con paths distintos.

## CI
- [run 38800650427](https://github.com/cadeApp/cadeApp/actions/runs/38800650427) sobre SHA funcional, SUCCESS.
- `unit` job 116648473876: `Test Files 133 passed`, `Tests 2388 passed`.
- `db-tests` job 116648473819: `Files=24, Tests=2283, Result=PASS`; tipos generados.
- RED/GREEN en db-tests provienen de otras funcionalidades y de la expansión A, no del writer B. Agy documenta mutación de guard de status con tests `o,p`, pero este revisor NO la ejecutó.
- Algunos check-runs históricos de approval-policy muestran failure para SHAs anteriores; las ejecuciones exitosas más recientes corresponden a código actual. No utilizar un run anterior como sustituto de un check final al cerrar.

## Corrección propia (metadata, NO código)
Body PR #376: frase literal "El código de Fase B es retrocompatible tanto con la base sin migrar como con la base expandida de Fase A" reemplazada por aviso de dependencia real de `is_current` en DB expandida. La suite de fase A ya mostraba `42703` sobre DB vieja. Ningún commit de implementación hecho por revisor.

## Limitación de la arquitectura propuesta
Una futura RPC B0 con lock sobre `couriers` da atomicidad a las llamadas **que la invocan**; viejas Server Actions/REST bajo INSERT RLS amplio pueden insertarse fuera de ese procedimiento. Hace falta gate de despliegue para que no sobrevivan old writers y/o barrera SQL del tipo autorizado. Demostrar con dos clientes distintos, no sólo RPC vs RPC.
