# PR #326 — Ronda 2 independiente (2026-10-13)

**Resultado: CON BLOQUEANTES (1 por evidencia/testabilidad, H03).** **Código auditado:** `57b50977feb1c1365fb1515bbf434d41c2755a93`. R1: `7866da28`, revisión previa `793c8ce6`.

## Qué corrigió Kira y qué quedó

**H01 (antes crítico) — ARREGLADO-SIN-VERIFICAR.** La migración ahora define `app_private.t340_clean_legacy()` con backfill y sincronización de contactos, preflight para no-drafts y `UPDATE` restringido a filas cuyo drop1/contacto preserva los datos (`IS NOT DISTINCT FROM`). Drafts incompletos no son limpiados. Los errores contienen únicamente conteos, no notas ni monto. **Inspección favorable y CI pgTAP GREEN**, pero no se ejecutó de forma independiente una mutación específica que demuestre que el test detecta el antiguo `UPDATE` global.

**H02 (antes alto) — ARREGLADO-SIN-VERIFICAR.** En `request_cycle`, para solicitudes con drops preexistentes se valida `position=1`, se rechazan discrepancias, se sincronizan faltantes y se vuelve a leer antes de limpiar padre. El lock de la fila padre persiste y se usa `FOR UPDATE OF d` en la consulta de drops. La ruta sin drops aún crea drop/contactos antes de limpiar. Test 5A y 5B en pgTAP ahora GREEN. Falta mutante independiente que demuestre que 5B detecta la limpieza sin comparación.

**H03 (antes alto) — PARCIAL, ÚNICO BLOQUEANTE RESTANTE.** Se agregaron 28 casos/aserciones de SQL, y CI `db-tests` de run `38466089472` pasó 21 archivos/2031 tests, `t340_multi_drop.sql` `plan(128)`. Los escenarios 1/2/3/4A/4B/5A/5B y repetición ejecutan `app_private.t340_clean_legacy()` sobre fixtures y la función de publicación real. **Pero los RED en `docs/tasks/log/T-340.md:1319–1321` se describen como «analíticos»; no aparece en los logs una mutación RED del UPDATE global de T-340 Paso 3.** Los controles negativos ejecutados en CI son sobre `mark_drop_delivered/failed` (H13/H14 de otra ronda), no sobre los defectos PR326-H01–H03.

**Adicional dentro de H03:** `supabase/tests/t340_multi_drop.sql:1913–1929` mide «idempotencia» con un wrapper que devuelve `1` si la rutina no lanza excepción, y cuenta un solo drop; **no prueba invariancia de notas, monto y contacto privado después de repetir**. Hay que agregar comparación real de datos previos/posteriores.

## Prompt técnico de próxima acción (sin decisión nueva)

**La opción C está autorizada**. NO pedir a Lautaro que la repita; NO ampliar a Paso 4 ni modificar acciones/seeds porque el diff desde R1 solo tocó migración, pgTAP y bitácora. En `supabase/tests/t340_multi_drop.sql`, agregar asserts de snapshot real en datos de `drop_contacts` antes y después de segunda ejecución. En un Postgres efímero autorizado, ejecutar mutación RED **solo en memoria** (nunca commiteada) que reintroduzca el `UPDATE` global de R1 y verificar fallos exactos de escenario draft/rollback; restaurar y ejecutar mismas aserciones en GREEN. Hacer un segundo mutante que omita el check de divergencia del bridge para 5B y exigir RED. Guardar outputs (comando, test exacto, salida de fallos y EXIT=1, luego PASS/EXIT=0) en la bitácora. No trucar mocks ni oráculos, ni declarar «analítico» como ejecución. No debilitar RLS/auth/CI ni cambiar timeouts.

## Checks independientes comprobados

- **CI funcional** [run 38466089472](https://github.com/cadeApp/cadeApp/actions/runs/38466089472), SHA `5e185e50`: `unit` 129 suites/2136 tests PASS; `db-tests` 21 archivos/2031 tests PASS (128 aserciones T-340); typecheck/lint/build/audit/bundle-budget PASS.
- HEAD `57b50977` incluye **solo documentación de bitácora** adicional tras SHA `5e185e50`. Los checks del HEAD actual en GitHub también están verdes salvo `approval-policy`, que conserva informe bloqueante; `e2e-preview` **BLOCKED por nueva migración, NO GREEN**. No usar Vercel READY como sustituto.
- No se detectó adulteración de tests para bajar expectativas del contrato; sí prueba de idempotencia insuficiente ya descrita.
- No se corrió PostgreSQL/Docker ni E2E local por esta revisión. No se reprodujo el RED específico solicitado: ese es el bloqueo. No ejecutar scripts remotos ni `db push`.
- No hay nuevas decisiones 🔵: opción C y permiso de archivo de test ya constan expresamente en R1.

**No aprobar ni mergear.** La PR sigue Draft y el Paso 4 no debe iniciarse.

### Estado de hallazgos

| ID | Estado | Razón |
|---|---|---|
| PR326-H01 | `arreglado-sin-verificar` | Predicado seguro por inspección + tests positivos CI; falta mutación específica independiente. |
| PR326-H02 | `arreglado-sin-verificar` | Puente mejorado + 5A/5B GREEN; falta mutación específica independiente. |
| PR326-H03 | `parcial` (bloqueante) | 128 pgTAP GREEN, sin RED de H01/H02; idempotencia incompleta. |

**Entregables:** README, JSONL, evidencia, lecciones, R2. El autor no editó carpeta de revisión desde R1. Cada cambio en `docs/revision-pr/pr-326/` de esta ronda es del revisor, no del agy.
