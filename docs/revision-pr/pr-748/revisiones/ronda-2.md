# Informe de revisión independiente — PR #748 / T-438 / CC-053 — Ronda 2

**Fecha:** 2026-11-15 (America/Argentina/Tucuman)  
**PR:** https://github.com/cadeApp/cadeApp/pull/748  
**Rama:** `cc/CC-053-suspension-active-trips`  
**Base:** `develop` @ `4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a`  
**SHA del autor revisado:** `4129bf6f6ec56bf1f1eb7f57702d3b6c39c8a0f7`  
**SHA anterior de revisión:** `7503f0a76039ee5984d335dbfe8dc8716dc4b083`  
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES**, 9 hallazgos anteriores corregidos por inspección, 0 nuevos.

## 1. Control de entrada

- Se confirmó remoto de la PR #748 en `4129bf6f…`, abierta y Draft, base sin cambios. El commit del autor está exactamente 1 delante del último commit de revisión; el compare trae **solo** seis rutas: `docs/contracts/{CC-032,CC-053}.md`, `docs/tasks/T-438.md`, `docs/tasks/log/T-438.md`, `docs/implementation-plan.md` y `docs/master-plan.md`. No se modificó `docs/revision-pr/pr-748/**`.
- Comentarios del PR: el informe/prompt de ronda 1 y el bot de Vercel; sin más decisiones abiertas ni respuestas posteriores que modifiquen D3-C.
- Bitácora `docs/tasks/log/T-438.md:3-33` incorporada: describe cambios de H01–H09, la decisión D3-C, una PR y las pruebas no ejecutadas. Declara `git diff --check` limpio; el usuario reporta `git merge-tree` sin conflictos. **No se ejecutaron esos comandos en este entorno**; GitHub indica mergeable=true.
- El CI `43687525249` asociado a `4129bf6f` finalizó `cancelled`. Es una PR **solo documental**; un CI cancelado no es green ni un motivo para exigir otro CI solo por el commit de revisión.
- La ficha T-438 **no existe en develop** y se crea en esta PR, junto con CC-053. La implementación de T-438 empieza **después** del merge del contrato. No se modificaron SQL, TS, tests ni workflows.

## 2. Resolución de H01–H09 (contra fuentes reales)

| Hallazgo | Archivo/línea en SHA `4129bf6f` | Comprobación independiente | Estado |
|---|---|---|---|
| **H01** decisión `preventive_suspension` | `CC-053.md:5,21,62,170`, `T-438.md:99` | Se corrigió `admin_resolve_incident` sin renombrar `admin_suspend_courier`; coincide con `supabase/migrations/20260927120000_cc012_incidents_contract.sql:190,210`. | Corregido por inspección |
| **H02** historial, roles, keyset | `CC-053.md:113-139` y `T-438.md:105-109` | Contrato de 5 argumentos, filtro por acción/actor **antes** de paginar, `NOT_FOUND`, cursor `created_at/id`, `limit+1`, caso de repartidor que canceló antes y roles sin acceso; suite CC-032 en DoD. | Corregido por inspección |
| **H03** identificador neutro D3-C | `CC-053.md:108-143` | Acción interna `courier_suspended` vs. salida `assignment_unavailable`, sin actor, categoría, oferta ni razón. Texto UI neutro, sin push; D3-C fechada. | Corregido por inspección |
| **H04** rutas omitidas | `CC-053.md:266-298`, `T-438.md:52-75`, `implementation-plan.md:465` | Lista, copy, test UI, suite CC-032 y contrato CC-032 **aparecen en los tres inventarios**. | Corregido por inspección |
| **H05** cardinalidad de redefiniciones | `CC-053.md:239-245`, `T-438.md:43-46,90-91` | **Ocho** funciones con cambio de locks + **una** RPC de historial = **nueve** redefiniciones, más **un** helper nuevo. | Corregido por inspección |
| **H06** compatibilidad de rollout | `CC-053.md:113-118,193-220`, `T-438.md:38-40,114-115` | **Aceptada la alternativa de una PR.** Firma vieja de cuatro argumentos se elimina y se recrea la de cinco con `p_include_assignment_unavailable boolean default false`. Cliente viejo sin opt-in ve exclusivamente CC-032; servidor nuevo opt-in hace **un** reintento sin quinto argumento ante `PGRST202`. Cuatro combinaciones viejo/nuevo y rollback documentadas. | Corregido por inspección, **runtime futuro** |
| **H07** CC-032 1-A | `docs/contracts/CC-032.md:304-308`, `CC-053.md:141-143,228-231` | Adenda de Lautaro073 (2026-11-15), excepción única para evento neutro, sin reabrir 2-A/3-A/4-A ni `report_no_show` o `cancel_request`. | Corregido por inspección |
| **H08** error `40P01` | `CC-053.md:41-44` | Se documenta `INTERNAL_ERROR` en wrappers, coherente con `src/server/rpc/offers.ts:52-97`. | Mejora corregida por inspección |
| **H09** efectos D1-A y RED | `CC-053.md:70-88,257-264,291-295`, `T-438.md:92-99,125-128` | `decided_at`, expiración de pendientes, limpieza de `cancel_reason/cancelled_at`, timestamps, crédito `consumed→reserved` vía `unconsume_publication`, auditoría por solicitud, conteos y mutaciones RED exigidos para la PR futura. | Corregido por inspección |

### Aceptación técnica de H06 — por qué cambia nuestra recomendación

La ronda 1 recomendó **dos fases** de deploy, porque una emisión incondicional del evento nuevo rompía al lector viejo. El autor resolvió esa causa sin dos PR: añadió opt-in por parámetro con `default false`, separó la acción interna de la pública y definió fallback del servidor nuevo. Los cuatro cuadrantes cliente/esquema funcionan **en la especificación**: viejo-viejo y viejo-nuevo devuelven CC-032; nuevo-viejo reintenta tras `PGRST202`; nuevo-nuevo recibe el aviso. Se requiere **DROP de la firma anterior** para no introducir una sobrecarga ambigua y re-`GRANT` de la nueva firma; el texto ya lo exige. Por eso **no corresponde exigir una excepción a AGENTS `5** ni un segundo PR. No se debe insistir en el diseño previo si esta alternativa demuestra compatibilidad en los tests.

**Riesgo de implementación a vigilar, no bloqueante documental:** `PGRST202` también puede aparecer por cache de esquema desactualizada aun con la migración aplicada. El reintento protege de un error visible, pero puede ocultar **temporalmente** el aviso hasta que PostgREST reconozca la firma nueva. Antes de dar T-438 por terminado se verificará la **recarga de schema cache**, que el quinto parámetro es resoluble tras deploy y que la ruta de paginación también hace opt-in. No se afirma que esa comprobación se ejecutó ahora; el CC prevé pruebas de los cuatro checkpoints y el E2E de aviso. Supabase/PostgREST documenta `PGRST202` como firma ausente o cache stale.

## 3. Pruebas propias y límites

- **Ejecutado en sesión con contenido real del conector GitHub:** 9 controles estáticos separados sobre `4129bf6f` y seis contraejemplos intencionales en una batería, más tres en otra; **9/9 verdes sin mutar, 9/9 detectaron la mutación en memoria**. Anclas de las nueve correcciones. El script reproducible completo queda en [evidencia/comandos.md](../evidencia/comandos.md#ronda-2--control-independiente-del-contrato). Las mutaciones **no editan archivos del repo** ni se confunden con un RED real de SQL/Postgres.
- **No ejecutado:** `pnpm`, Docker, Supabase, pgTAP, E2E ni la migración T-438 (aún no escrita). Git local `merge-tree` y `git diff --check` no ejecutados por el revisor; el autor los declaró. El CI del SHA se canceló; no hay prueba de ejecución runtime.
- **Rectificación de la propia ronda 1:** sus nueve objetos JSONL carecían por error del campo `linea`. La revisión restaura ese metadato en esta ronda sin cambiar el sentido ni sobrescribir `ronda-1.md`.
- **Estado de los nueve objetos:** `arreglado-sin-verificar`, `ronda_arreglo=2`, `verificado_en_sha=null`. Corregidos documentalmente por inspección y controles estáticos; **sin afirmar verificación de comportamiento**, que solo será posible en T-438.

## 4. NO TOCAR

La PR actual es el **contrato** y la ficha, no la implementación: no escribir migraciones, tests, UI ni código para cerrar esta ronda, no reabrir D1-A/D2-A/D3-C ni la decisión autorizada de CC-032 1-A. No introducir un segundo PR de rollout por costumbre, porque el opt-in ya resuelve el caso documentado. No modificar `docs/revision-pr/pr-748/**` desde la sesión del autor; no falsificar controles RED ni CI verde.

## 5. Conclusión y paso manual

**Apta documentalmente para consideración de merge, SIN BLOQUEANTES de ronda 2.** Queda pendiente el acto humano de sacar Draft/aprobar su avance y mergear **solo si Lautaro073 lo decide**. No se ha aprobado ni mergeado esta PR por el revisor. Tras el merge se desbloquea la implementación T-438, donde se ejecutarán pgTAP/CI/E2E y mutaciones reales. El commit de esta revisión solo suma el informe, corrige el JSONL de la revisión, actualiza README/evidencia/lecciones y **mueve el HEAD de la rama**; hacer `git pull` antes de cualquier sesión nueva.
