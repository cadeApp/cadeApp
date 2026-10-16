# PR #374 — CC-025 fase A — Revisión independiente ronda 1

**Fecha:** 2026-10-15 · **Tarea:** T-356 · **Issue:** #363 · **PR:** https://github.com/cadeApp/cadeApp/pull/374
**SHA auditado:** `b6d6a921c556e7ad2e69d208984e866b09654ca3` · **base:** develop · **resultado:** CON BLOQUEANTES (H01, H02, H03). **NO APROBAR NI MERGEAR.**

## Dictamen técnico
La migración expansiva está bien delimitada: añade `is_current boolean not null default true`, `rejection_code text` e `idempotency_key text`, con guard temporal `courier_documents_expansion_guard`. No revoca UPDATE, no añade índices restrictivos, no reemplaza RLS ni realiza el backfill final, por lo que respeta la partición **Expand → App → Contract** decidida por Lautaro073. `src/types/database.types.ts` corresponde a esas columnas. El contrato CC-025 describe las fases A/B/C y conserva retención de 30 días desde reemplazo.

**Problema de validación:** se afirma compatibilidad del escritor UPSERT antiguo sin cubrir su forma y actualización reales, ni demostrar explícitamente el rol efectivo del test de integración. El HEAD más reciente tiene `build` FALLIDO por `next/font`, aunque el último CI completo del SHA anterior pasó. No se ha realizado prueba independiente de base de datos por este revisor.

## H01 — ALTO / P08 — La prueba del UPSERT anterior no recorre su rama de UPDATE
**Archivos:** `supabase/tests/cc025_expand_courier_documents.sql:93-100`; `supabase/tests/integration/cc025_expand_compatibility.mjs:122-130`. **Relación:** `src/features/courier-onboarding/actions.ts` **en develop** usa `.upsert(documentEntries as never)` sin `onConflict` explícito (PostgREST usa resolución por PK por defecto).

Ambas pruebas de Fase A ejecutan `INSERT ... ON CONFLICT (storage_path) DO UPDATE` **con storage_path que todavía no existe**: la rama de UPDATE no se ejecuta. Además, el objetivo de conflicto `storage_path` no reproduce el writer `.upsert()` anterior, que usa el PK `id` por defecto. El test es verde sin haber demostrado que una colisión real actualiza la fila manteniendo guard, RLS y permisos.

**Arreglo:** probar el SQL del writer real con `ON CONFLICT (id) DO UPDATE SET ...`, insertando primero una fila con id conocido y repitiendo el mismo id y `storage_path` con datos válidos. Verificar **estado persistido, conteo idéntico y que hubo UPDATE real**. Incorporar también caso de inserción sin colisión, bajo JWT `authenticated`; no suponer que ambos se comportan igual. Como mutación RED, revocar temporalmente UPDATE **sólo en la DB efímera de CI** dentro de transacción o cambiar la rama de UPDATE y comprobar que el test deja de estar verde, sin modificar tests ni fixtures. Restaurar y GREEN.

## H02 — MEDIO / P08 — El runner declara autenticación sin comprobarla
**Archivo:** `supabase/tests/integration/cc025_expand_compatibility.mjs:114-145`. `runSql` ejecuta psql `-c` con `SET LOCAL ROLE authenticated` y `SET LOCAL request.jwt.claims`, pero el test no afirma `current_user`, `auth.uid()` ni el rol efectivo **en la misma transacción que el UPSERT**. Una ejecución accidental con el superusuario `postgres` podría pasar aunque el actor real no tuviese permiso; el rol de prueba pgTAP sí se cambia por la función `pg_temp.act_as`.

**Arreglo:** usar explícitamente `BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claims', ..., true);` y verificar `current_user = 'authenticated'`, `auth.uid() = courierId`, luego el INSERT/UPDATE y `COMMIT` en la misma sesión; o usar runner de pgTAP equivalente. Test negativo con actor ajeno/privilegio revocado que produzca error demostrado. No afirmar que el `SET LOCAL` actual ha fallado: **es una cobertura insuficiente, no un exploit reproducido**.

## H03 — ALTO (gate CI) — Fallo del build en HEAD auditado
En el HEAD `b6d6a921c556e7ad2e69d208984e866b09654ca3` el run [38780153063](https://github.com/cadeApp/cadeApp/actions/runs/38780153063) tiene `build=FAILURE` en `src/app/layout.tsx` al cargar Montserrat mediante `next/font`, error `TypeError: Cannot read properties of null (reading '1')` dentro del loader de Google. Ese archivo, Next.js y fuentes **no están modificados en el diff de #374**. El run anterior [38778647075](https://github.com/cadeApp/cadeApp/actions/runs/38778647075), SHA `09846602`, terminó SUCCESS. Por ahora parece potencial fallo ambiental/intermitente, **no se demuestra un bug de aplicación ni se autoriza tocar estilos o debilitar el build**.

**Arreglo:** reproducir o reejecutar el job build del **mismo SHA** sin tocar tests ni CI. Si falla nuevamente, documentar evidencia concreta y tratar corrección independiente y acotada con su propio control; si pasa en mismo SHA, dejar constancia de flake transitorio y mantener el gate habilitado. En el momento de cierre del informe el job `db-tests` del HEAD más reciente seguía en curso; tomar su conclusión y logs finales después, no reutilizar cifras de un SHA anterior.

## Hallazgo de proceso — corregido por el revisor
El body decía `Closes #363`. Lo modifiqué por una relación no auto-closing: **la PR A no debe cerrar el issue CC-025 antes de B y C**. Cambio sólo de metadata, sin modificar la rama ni código. La frase del body `Files=24, Tests=2262` no coincide con el log de `db-tests` del SHA `09846602`: ese run informa **Files=23, Tests=2223**, incluidos tests CC-025 A. Corregir texto tras comprobar CI del HEAD final; no inventar números.

## Alcance / estado de dependencias
- Diff: 7 archivos, sólo migración aditiva, tipos, pgTAP, runner, CI aditivo, contrato y bitácora. Sin dependencias externas.
- La PR #364 (fase C) sigue con HEAD `8cb77a19` y NO se mergea. La fase B aún no está abierta al revisar. La decisión de dividir el despliegue en 3 etapas continúa firme.
- La carpeta `docs/revision-pr/pr-374/**` pertenece únicamente al revisor. `H01/H02` están abiertos por insuficiencia de controles, `H03` abierto por check real fallido; **ninguno arreglado-verificado**.

## Próxima ronda
Resolver H01-H03, confirmar CI completo del SHA corregido, recrear RED→GREEN auténtico sin adulteración, pedir ronda 2. No autorizar despliegues/merges. [Prompt para agy](../prompt-agy.md) · [evidencia](../evidencia/comandos.md).