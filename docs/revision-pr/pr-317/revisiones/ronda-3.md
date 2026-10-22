# Informe de revisión independiente — PR #317 / T-340 — Ronda 3

**Fecha:** 2026-10-11 · **SHA del código revisado:** `5e2a62c659efe1d5e8e41656a9c10c9137cdd920` · **Base:** `develop` (`7cf1a653`; behind=0).  
**Resultado: CON BLOQUEANTES (4: H08 pendiente, H10–H12 nuevos). NO MERGEAR.** Revisión sólo del paso 1/4.

## Verificación de la ronda anterior

| ID | Resultado | Evidencia |
|---|---|---|
| H06 | **arreglado-verificado** | `app_private.lock_draft_request_for_child_write()` es `SECURITY INVOKER`, `FOR UPDATE` sigue presente. pgTAP verifica `pg_proc.prosecdef=false` y el texto del lock; CI verde. Una mutación **en memoria** a `security definer` vuelve rojo el detector independiente. |
| H07 | **arreglado-verificado** | Los tres tests de backfill ahora crean fixtures y llaman `app_private.t340_backfill_legacy()` realmente; la misma función es invocada desde la migración. Sin `pass()` ni inserciones ficticias de `audit_log` en esas pruebas. |
| H08 | **ABIERTO** | Continúan sólo pruebas secuenciales en pgTAP. La bitácora confirma que pospone las carreras reales de dos sesiones hasta el **paso 4**, pero CC-022 §2b las exige para el paso 1. Un test del texto `FOR UPDATE` y tests de permisos no prueban entrelazado ni serialización. |
| H09 | **corregido para la omisión reportada**, con **contradicción contractual de fondo H10** | El helper audita todo `non-draft` sin drops después de intentar materializar, así cubre combinaciones de pago excluidas. Pero **mi indicación de ronda 2 de excluirlas y auditarlas fue equivocada**: CC-022 §5b exige normalizar/crear el drop histórico, incluso si el monto de cambio estaba ausente. Se separa en H10 y se debe corregir la dirección del arreglo. |

### Hallazgos bloqueantes vigentes

**H08 — ALTO — Concurrencia no demostrada (`supabase/tests/t340_multi_drop.sql:138–313`).**  
No hay un ensayo con DOS transacciones/sesiones que enfrente `publish_request` a `insert/update/delete` de `delivery_request_drops` y `update` de `delivery_request_drop_contacts`. La nueva prueba estructural de `prosecdef` y `position('for update' in prosrc)` detecta ciertas regresiones, pero no demuestra que la escritura espera el lock de publicación y aborta tras confirmarse `published`. El contrato del **paso 1** no autoriza postergarlo hasta el paso 4. Mantener abierto hasta probar al menos el intercalado determinista con conexiones reales en CI, y mutación negativa que quite la protección.

**H10 — ALTO — El backfill excluye históricos que CC-022 obliga a normalizar (`supabase/migrations/20261009200000_t340_multi_drop.sql:1591–1616`).**  
La condición `and (r.recipient_payment_method = 'cash' or r.needs_change = false)` excluye `transfer/to_agree + needs_change=true`. Otra condición excluye `cash + needs_change=true + cash_change_amount=NULL`. **CC-022 §5b, líneas 278–281, dice explícitamente lo contrario**: para histórico no-cash se crea el drop con `needs_change=false`, monto `NULL`; para cash+cambio sin monto se crea el drop con `needs_change=true`, monto `NULL`, y se reporta la anomalía (sin aplicar retroactivamente la validación de publicación). §9 exige un drop `position=1` por solicitud existente representable. El resultado actual **pierde el drop en los lectores del paso 2**, aunque conserve y audite la solicitud legacy. **Corrección:** separar normalización del backfill de la validación estricta para nuevas publicaciones; materializar ambos ejemplos, preservar legado y documentar la anomalía cash; probar ambos bajo llamada real del helper. Este defecto también revela que la **recomendación del revisor en R2/H09 de auditar y omitir era errónea**; se corrige expresamente aquí.

**H11 — ALTO — Se copia monto privado de cambio en `audit_log` (`migration:1681`).**  
El JSON de auditoría `before` almacena `'cash_change_amount', r.cash_change_amount`. **AGENTS.md §2** prohíbe poner el **monto exacto de cambio** fuera de tablas privadas de contactos, y específicamente lo prohíbe en logs. El campo privado puede quedar duplicado en el log incluso cuando el paso 3 limpie las columnas legacy; no es suficiente que la policy de `audit_log` sea sólo para admin. **Corrección:** eliminar el valor exacto del JSON de auditoría (si es útil, registrar sólo `has_cash_change_amount` como booleano), sin registrar `notes`, teléfonos, coordenadas ni destinatarios. Añadir test estructural específico que inspeccione `audit_log.before` de casos históricos y confirme ausencia de la clave con valor sensible; mutación que la reintroduzca debe volverse roja.

**H12 — MEDIO — Se inventa `delivered_at` histórico (`migration:1596`).**  
Para un legado `status='delivered'` con `delivered_at IS NULL`, el backfill usa `coalesce(r.delivered_at, r.updated_at, r.created_at)` y **atribuye una fecha de entrega que no consta en origen**. CC-022 §9 indica `delivered_at` **de la solicitud**, no un timestamp estimado. La constraint requiere timestamp para status delivered. **Corrección:** no inventar fecha: cuando falte, preservar la fila legacy y auditar la anomalía con un código descriptivo, o documentar tratamiento adicional sujeto a contrato; no introducir una falsa fecha de entrega. Añadir fixture histórica y probar que no aparece un timestamp falsificado.

## Comprobaciones y límites

GitHub Actions **exact SHA**: run `38105044929`, job `db-tests` `114368652412`: migración `t340_multi_drop` aplicada; bootstrap `Files=1, Tests=10, Result: PASS`; base `Files=21, Tests=1951, Result: PASS`, incluye `t340_multi_drop.sql ... ok` (48 aserciones, 0 `pass`). `db:types --local` generado, diff sin drift. `unit`, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` ✅. `approval-policy` ❌ (política de revisión). No se verificó E2E de carreras; los checks verdes **no cubren H08/H10/H11/H12**.

**Método:** lectura independiente del SHA exacto y fuentes de verdad en `develop`, logs reales del job CI y mutaciones/sondas estructurales **en memoria**, reproducibles en `evidencia/comandos.md`. **No** se ejecutó SQL contra una base propia ni concurrencia de dos sesiones: no se levantó Supabase/Docker local por política del proyecto. No hay decisiones nuevas de negocio: los dos casos de normalización están resueltos por CC-022. Si implementar H08 requiriese abrir un archivo fuera de los autorizados, detenerse e informar antes de modificarlo; no autorizar unilateralmente un waiver del gate del paso 1.

**Alcance:** rama detrás de `develop`: 0 commits, sin conflictos reportados; los únicos cambios del autor tras el informe R2 fueron migración, suite y bitácora, sin escritura propia en `docs/revision-pr/pr-317/`. La carpeta de revisión sigue perteneciendo al revisor.

### Informe revisar-pr — T-340 — 2026-10-11 — revisión independiente

**Resultado:** CON BLOQUEANTES (4).

**Checks locales:** typecheck n.e. · lint n.e. · test n.e. · test:db n.e. (CI db-tests ✅ exact SHA).

**BLOQUEANTES:**
- H08 `t340_multi_drop.sql:138–313` → realizar carreras reales de dos sesiones en paso 1; no posponer al paso 4.
- H10 `migration:1611–1616` → backfill normaliza y crea drops históricos inválidos según §5b.
- H11 `migration:1681` → quitar valor `cash_change_amount` del `audit_log`.
- H12 `migration:1596` → no inventar timestamp de entrega histórica.

**MEJORAS:** ninguna que cambie el gate.

**No revisado:** concurrencia runtime y despliegue Develop posterior a merge; revisiones sin autorización para entorno DB local. No aprobación ni merge.
