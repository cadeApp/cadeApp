# Ronda 3 — PR #736 · T-435 / CC-051 (SEC-12) — 2026-11-12

**Resultado: SIN BLOQUEANTES DE CÓDIGO. H01–H05 arreglados-verificados (5/5) en `ecb04e80`.**
**Gate pendiente: E2E global verde sobre la rama ya fusionada con #737.** Esta ronda **no autoriza merge**, no aprueba ni mergea.

| Dato | Valor |
|---|---|
| SHA de implementación y captura real | `ecb04e80a0d634c6177c14ec121098134388269a` |
| Merge `origin/develop` (sin rebase) | `ab32909f6e8b1c79d81e567d4d575537986096f1`, padres `ecb04e80` y `434ee222` |
| Head comprobado (bitácora) | `bcf71318f942f26c64fac50439d3652b72d99210` |
| Base develop | `434ee222458be47ec5555f5ef20c4f0b50dcb305` |
| Captura E2E | [Run 43322939621](https://github.com/cadeApp/cadeApp/actions/runs/43322939621) (CC-051 PASS, global RED) |
| CI implementación | [Run 43304153075](https://github.com/cadeApp/cadeApp/actions/runs/43304153075) (success) |
| CI head post-merge | [Run 43328941951](https://github.com/cadeApp/cadeApp/actions/runs/43328941951) (al corte: db-tests en progreso) |

## Preflight y alcance

Leídos antes del diff `COMO-ENTREGAR.md`, catálogo `docs/revision-pr/README.md`, skill `.agents/skills/revisar-pr/SKILL.md`, ficha T-435 **de develop**, CC-051, CC-023, AGENTS.md (vigente de rondas previas), revisión R2, `hallazgos.jsonl` e historia de la PR; revisados los comentarios de R1/R2 y los review threads (ninguno nuevo). No hay alteración de `docs/revision-pr/pr-736/**` por el autor tras el commit de R2.

La comparación R2→`ecb04e80` contiene únicamente `e2e/specs/courier-private-columns.spec.ts` (4 altas/1 baja para H04) y bitácora, ambos permitidos. El merge `ab32909f` incorpora desde develop el fix de #737 (`courier-onboarding` y su propio histórico de revisión), sin nuevos cambios propios al spec CC-051. `bcf71318` solo agrega evidencia a `docs/tasks/log/T-435.md`; la ficha y CC no cambian.

Comparación GitHub con develop actual: `ahead_by=17`, `behind_by=0`, PR `mergeable=true`. Sin clon local: no se ejecutó `git fetch`, `git merge-tree`, `pnpm` ni `node docs/revision-pr/analizar.mjs verificacion` localmente; no presentar el estado mergeable como salida de `merge-tree`. JSONL validado al actualizarlo en memoria. No se consultó ni manipuló Supabase remoto.

## Validación del residual PR736-H04

**Código:** `e2e/specs/courier-private-columns.spec.ts:383–394,529–550` en `ecb04e80`.

- `Promise.allSettled` espera **las cuatro** promesas `subscribe` antes de inspeccionar `rejected`. Los productores de canales no sobreviven al inicio del teardown aunque una precondición falle.
- Se relanza la causa original `failedSubscription.reason` antes de la RPC, así que no se ejecutan cambios de solicitud con una suscripción fallida.
- `finally` conserva el reset de las dos columnas legacy, verifica errores sin valores sensibles e intenta quitar todos los canales con `Promise.allSettled`. No sustituir el error del cuerpo por una falla secundaria de cleanup es correcto y no es una decisión abierta.
- No se introdujeron dependencias, sleeps sin barrera, `.skip`, `.only`, tests falsos, debilitamiento de CI o cambios de esquema.

**Batería independiente nueva:** script Node completo en `evidencia/comandos.md`, distinto del harness del autor y del de R2. Dos controles limpios (rechazo antes/después de registrar el canal) **GREEN 2/2**. Mutaciones adversas: restaurar `Promise.all` → **RED, orphaned=1**; ignorar rechazo → **RED, bodyRan=true**; limpiar solo suscripciones exitosas → **RED, orphaned=1**. Cada mutación rompe realmente la propiedad modelada. El harness modela scheduling; **no equivale al E2E real**.

## Cierre de H01–H05 y matriz completa

| ID | Resultado | Verificación independiente |
|---|---|---|
| **PR736-H01** | **arreglado-verificado** | Auditoría final de todos los eventos A/M en los dos IDs, sin claves ni valores; nueva captura CC-051 PASS |
| **PR736-H02** | **arreglado-verificado** | Oráculo S de ambas claves y valores exactos en UPDATE publicado, INSERT borrador y UPDATE borrador; CC-051 PASS |
| **PR736-H03** | **arreglado-verificado** | PostgREST `42501` para N publicada/borrador y `error=null, data=[]` para A/borrador; CC-051 PASS |
| **PR736-H04** | **arreglado-verificado** | Barrera `allSettled` de altas y `allSettled` de limpieza; dos controles GREEN y tres mutaciones de scheduling RED |
| **PR736-H05** | **arreglado-verificado** | Correlación `id + tipo + updated_at` (UPDATE publicado e INSERT draft) sin exigir INSERT opcional al A; CC-051 PASS |

Los cinco `verificado_en_sha` corresponden a **`ecb04e80a0d634c6177c14ec121098134388269a`**, donde se comprobó el código y en el que Playwright ejecutó CC-051, no al commit documental de esta revisión. El E2E y las mutaciones son evidencias complementarias, no equivalentes: el primero demuestra la matriz real en el entorno; las segundas comprueban sensibilidad lógica frente a casos adversos sintéticos.

## Evidencia real del autor reproducida desde GitHub Actions

Se leyó el log de `e2e-preview` [43322939621](https://github.com/cadeApp/cadeApp/actions/runs/43322939621) por dentro:
- checkout exacto `ecb04e80a0d634c6177c14ec121098134388269a`;
- test previo T-345 **PASS**; CC-051 en `courier-private-columns.spec.ts:251` **PASS (17,8 s)**;
- `[CC-051 captura]`: S recibe `notes,cash_change_amount` (INSERT y UPDATE de publicada y draft); A y M nunca; A sin eventos del draft; N sin eventos; log solo nombres de claves, sin valores;
- **run completo FAIL (121 passed, 3 failed)**. Únicos tres fallos: `courier-onboarding.spec.ts:271,803,906`, que en ese SHA carecían del arreglo #737. No hubo otros fallos atribuidos a T-435.

El run completo **no fue verde**. Tras el merge `ab32909f` ya está incorporado el código de #737. **Aún no hay resultado de E2E completo verificado sobre el head posterior al merge**; no extrapolar verde del resultado de CC-051 de `ecb04e80`.

**CI general `ecb04e80`:** success [43304153075](https://github.com/cadeApp/cadeApp/actions/runs/43304153075), jobs build/unit/typecheck/lint/audit/bundle-budget/db-tests success. Log unit: 209/209 suites, 3961 tests (resumen); tests workflows 86 y ADR 6. Log db: pgTAP `Files=47 Tests=3958 Result: PASS`, paso `git diff --exit-code -- src/types/database.types.ts` ejecutado sin diferencias. El job db contiene mutaciones deliberadas RED restauradas a GREEN; no contar el RED intermedio como fallo final del CI. En head `bcf71318` CI aún con db-tests in progress al corte.

## Decisiones, salida y limitaciones

- No aparecen decisiones 🔵 nuevas: D1 (captura en Develop), D2-A (no CHECK null sin fuga) y D3-A (matriz) son las acordadas.
- Sin fuga observada, no corresponde editar RLS, grants, publicación ni migraciones.
- **NO APROBAR NI MERGEAR EN ESTE CORTE** únicamente porque los cinco hallazgos están verificados. DoD de T-435 exige `e2e-preview` completo GREEN sobre implementación; resta verificar el run automático sobre SHA posterior al merge de #737. Si es verde, no abrir otra ronda de cambios de código; si vuelve rojo, analizar sólo los fallos reales y atribución antes de decidir.
- No pedir otro CI verde únicamente porque se agregó esta documentación de revisión. Si el autor debe continuar trabajando, primero `git pull`, sin rebase/force/amend.
