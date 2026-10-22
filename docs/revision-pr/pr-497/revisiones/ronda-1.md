# Informe de revisión independiente — PR #497 / CC-036

**Fecha local:** 2026-10-21  
**SHA revisado:** `b845f260aad15652c566a7d0f37b6c27a2e8b58c`  
**Base:** `develop@824c4fdb8a4277220e14b575eaf6a15e40df8406`  
**Estado:** **CON BLOQUEANTES (3)**. No apta para merge.

## Alcance y método

Revisé los seis archivos de documentación de la PR; las fichas y el contrato CC-036; el plan §8 de `develop`; la skill `revisar-pr`, AGENTS, el contrato de cambio; las migraciones históricas de grants y policies de `offers`; el test `supabase/tests/rls_matrix.sql`; la bitácora de T-312 en el HEAD de la PR #491 (aún no mergeada); la sección Fase 4 de la PR #489 (aún no mergeada); comentarios y estado de revisión; y el log real de CI del job `unit` de `b845f260aad15652c566a7d0f37b6c27a2e8b58c`.

El entorno de esta revisión no tiene clon de repositorio accesible ni permite clonar GitHub desde shell. **No** corrí `pnpm`, `git merge-tree`, PostgreSQL, Docker ni Supabase local o remoto. La detección H01 es **inspección reproducible**; H02 y H03 están **demostrados en rojo por el CI oficial**, no son un test local propio. No atribuyo una mutación RED→GREEN que no ejecuté. GitHub declara `mergeable=true` contra `develop` al momento de la lectura, lo que no prueba compatibilidad posterior con #489.

## Resumen por prioridad

| Hallazgo | Evidencia | Diagnóstico |
|---|---|---|
| **PR497-H01 — ALTO** | `docs/tasks/T-390.md:44,71`, `docs/contracts/CC-036.md:115-125`; `supabase/tests/rls_matrix.sql:518-524` | Se revoca DELETE sobre `offers`, pero el test 49 ejecuta un DELETE sin envolver en `throws_ok`. La tarea solo autoriza cambios de casos 46/50/51. |
| **PR497-H02 — ALTO** | `docs/implementation-plan.md:418-419`; `docs/tasks/T-408.md`, `T-409.md` | Faltan las filas de las tareas nuevas T-408 y T-409 en §8. Fase 4 existe solo en PR #489. |
| **PR497-H03 — ALTO** | `docs/tasks/T-390.md:63`, `T-391.md:51`, plan `:416-417` | El primer ítem de cada DoD no coincide literalmente con la celda DoD de la misma tarea en §8. |

### PR497-H01 · DELETE directo no adaptado al contrato

**Diagnóstico [ANÁLISIS]:** `rls_matrix.sql:518-524`, tras `set local role authenticated`, ejecuta sin captura:

```sql
delete from public.offers where id = pg_temp.offer_c2_id();
select is((select count(*) from public.offers where id = pg_temp.offer_c2_id()), 1::bigint, ...);
```

La migración especificada por CC-036 revoca `DELETE` a `authenticated`; desde ese momento, la sentencia directa genera `42501` por privilegios, no el borrado silencioso de 0 filas que asumía el test actual. Ese error queda fuera de `throws_ok` y puede abortar la transacción pgTAP. El caso 49 no figura en los permisos ni el DoD de T-390 y el contrato tampoco lo enumera. Por lo tanto, la futura tarea no puede implementar el contrato y dejar ese test verde sin exceder su alcance.

**Arreglo:** ampliar la lista cerrada a **46, 49, 50, 51** en `CC-036.md` (Impacto exacto), `T-390.md` (Archivos permitidos y DoD) y la fila T-390 de `implementation-plan.md`. En T-390, reemplazar `delete from public.offers ...` por `select throws_ok('delete ...', '42501'::char(5), null::text, ...)`; conservar `select is(count(*), 1)` para demostrar ausencia de borrado. Revisar `plan(66)`: si se agrega una aserción, subir el conteo. El caso 50 debe afirmar el mensaje previo sin cambiar, no `still available`, porque el caso 46 pasará a rechazo. Caso 51 pasa a `throws_ok(42501)`.

**Prueba exigida al implementar:** pgTAP en schema final, sin error SQL sin capturar; caso 49 comprueba `42501` y persistencia de fila. Control adversarial independiente: si se reintroduce temporalmente el permiso y la política de DELETE en esquema efímero aislado, la aserción del caso 49 debe fallar (nunca publicar una mutación insegura ni adulterar expectativas). Para T-390, el RED principal de creación/edición se captura antes de aplicar CC-036.

### PR497-H02 · Fichas sin filas en plan de implementación

**Diagnóstico [VERIFICADO POR CI]:** `tools/verify-fichas.test.ts:146` en el job `unit` falló expresamente:

```
Estas fichas no tienen fila en docs/implementation-plan.md §8: T-408, T-409
```

El diff agrega las fichas T-408 y T-409, pero §8 de la misma rama acaba en T-391 y no tiene Fase 4. La PR #489 sí añade una sección Fase 4 y T-400–T-407, pero sigue abierta en una rama distinta: no es parte del árbol revisado.

**Arreglo:** una vez revisada y mergeada #489, integrar `origin/develop` por **merge, nunca rebase**, preservar las filas nuevas y añadir las filas T-408 y T-409 **dentro de Fase 4**, con dueño, dependencia, archivos permitidos y DoD compatibles con las fichas. No copiar todo el bloque Fase 4 creando dos secciones paralelas.

**Prueba:** ejecutar `pnpm exec vitest run tools/verify-fichas.test.ts`; las dos tareas deben desaparecer del conjunto `sinFila`. Revalidar `mergeable` con `develop`.

### PR497-H03 · Primer ítem del DoD difiere del plan

**Diagnóstico [VERIFICADO POR CI]:** `tools/verify-fichas.test.ts:165` compara literalmente `m[1].trim()` del **primer** checkbox con la columna DoD de `docs/implementation-plan.md`. El job `unit` falló:

```
Desincronizadas: T-390, T-391
```

En la ficha T-390 el primer checkbox comienza `**Migración** según CC-036...` y en la T-391 `**Cabeceras enforced en todas las rutas**...`. No corresponden al resumen largo que hoy figura en la última celda del plan.

**Arreglo:** usar como **primer checkbox** de ambas fichas el texto **exacto** de la celda DoD de su fila §8 (sin modificar/eliminar controles). Trasladar lo que hoy es el primer checkbox a la segunda posición y conservar la lista detallada de validaciones, test y E2E. Si se decide cambiar la definición del objetivo, sincronizar plan y ficha conjuntamente.

**Prueba:** `pnpm exec vitest run tools/verify-fichas.test.ts` debe quedar verde sin editar, omitir ni debilitar `tools/verify-fichas.test.ts`.

## Positivos y falsos positivos descartados

- **Correcta la estrategia general de CC-036:** borrar las cuatro policies de escritura y revocar DML a clientes, conservando solo SELECT y las RPC `SECURITY DEFINER`.
- **Descartado:** no es necesario añadir `revoke update (amount_ars, eta_minutes, message)` separado para anular el grant por columnas de CC-026. PostgreSQL documenta que `REVOKE UPDATE ON TABLE` revoca también los permisos correspondientes por columnas. Fuente: https://www.postgresql.org/docs/current/sql-revoke.html. Pueden añadirse `has_column_privilege(..., 'UPDATE')=false` como prueba explícita de defensa en profundidad.
- **Correcta la separación:** T-390/T-391 antes de producción; T-408/T-409 Fase 4. La postergación del riesgo admin fue acordada expresamente por Lautaro073 en la bitácora T-312 de PR #491; no es una decisión abierta de esta ronda.
- El contrato ya exige casos positivos RPC y bypass, y las fichas prohíben falsificar pruebas; conviene conservarlos.

## CI del SHA revisado

Consulta y descarga de logs reales de GitHub Actions sobre `b845f260aad15652c566a7d0f37b6c27a2e8b58c`:
- `unit`: **FAIL**, 155 files: 154 passed / 1 failed; **3170 tests: 3168 passed / 2 failed**. Los dos fallos son `tools/verify-fichas.test.ts` por H02 y H03.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: **PASS**.
- `approval-policy`: **FAIL** (faltaba la revisión independiente al SHA inicial).
- `db-tests`: **IN PROGRESS** en el momento de consulta; no afirmo verde.
- E2E no verificado para este SHA en esta ronda.
- No se ejecutaron tests propios de SQL; H01 es inspección estática del caso existente más consecuencia del REVOKE propuesto.

## Alcance y decisión

Los seis archivos originales son documentación y guardan relación con CC-036 y las fichas nuevas. Esta PR crea simultáneamente el CC y la ficha T-390; eso es compatible con la reconciliación de contrato si se mergean en develop juntos. **No hay nuevas decisiones 🔵 pendientes**; la decisión de riesgos de release ya está registrada.

**Veredicto:** CON BLOQUEANTES (3). No aprobar ni mergear. Implementar correcciones mediante el autor de la PR, sin tocar la carpeta de revisión; pedir segunda ronda al terminar. Los hallazgos y el prompt van en el mismo comentario de cierre en GitHub.
