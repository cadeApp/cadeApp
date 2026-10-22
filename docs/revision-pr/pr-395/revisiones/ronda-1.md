# Informe de revisión — PR #395 · CC-029 / T-369 · Ronda 1

**Origen:** [PR #395](https://github.com/cadeApp/cadeApp/pull/395), `ed96bbae40cc02992fc21962bf4c2b43ef3ecfdd`.
**Base original:** `develop` @ `293c3a2756509a5fb6e82ee6bc841197c143f9c9`.
**Fecha:** 2026-10-17.
**Estado:** **SIN BLOQUEANTES DOCUMENTALES PENDIENTES TRAS CORRECCIONES**; no equivale a verificación SQL ni habilita T-369, que continúa bloqueada hasta mergear CC-029.

## Alcance
PR documental con tres archivos originales: `docs/contracts/CC-029.md`, `docs/tasks/T-369.md` y la fila T-369 de `docs/implementation-plan.md`. No hay código, migraciones, secretos, despliegues ni datos remotos modificados por esta revisión. La issue #394 está en `contract-change`.

## Decisiones humanas cerradas antes de esta ronda

- **1-A:** gracia para conservar la racha, sin prolongar el plan ilimitado ni usar créditos vencidos; renovación tardía empieza al registrarse.
- **2-A:** primer plan nuevo comprado con abono `legacy_paid` vigente se agenda para el fin efectivo del derecho anterior (incluida la gracia legacy), sin consumo anticipado.
- **3-A:** tres PR de T-369 secuenciales DB/RPC → UI → E2E/staging, cada una con su checkpoint, `Refs #356` y cierre manual posterior al gate.

## Hallazgos del SHA original, corregidos por edición acotada del contrato

| ID | Severidad inicial | Fuente | Regla incorporada |
|---|---|---|---|
| PR395-H01 | alto | `docs/contracts/CC-029.md:85` | La elegibilidad requiere now >= starts_at para plan y arrastre; plan agendado se ve como futuro. |
| PR395-H02 | alto | `docs/contracts/CC-029.md:80` | Nuevo índice único por request_id WHERE is_current; transición D-C2a desactiva anterior sin reembolsar y crea reserva nueva; historial intacto. |
| PR395-H03 | medio | `docs/contracts/CC-029.md:98` | Decisión 1-A: gracia solo racha; ilimitado termina en ends_at y renovación tardía comienza al registrar. |
| PR395-H04 | alto | `docs/contracts/CC-029.md:143` | Corte as-of previous.ends_at con movimientos históricos, reserva cuenta como comprometida; usar monthly_credits del período origen y materializar una sola vez. |
| PR395-H05 | alto | `docs/contracts/CC-029.md:132` | Decisión 2-A: plan nuevo programado tras paid_until+gracia; bloquear/reprogramar extensiones concurrentes de derecho legado. |
| PR395-H06 | alto | `docs/contracts/CC-029.md:248` | No bloquear otras solicitudes desde el lock de comercio; reconciliar antes o separar transacción; prueba de carreras cruzadas, sin asumir que skip locked garantiza saldo disponible. |
| PR395-H07 | medio | `docs/contracts/CC-029.md:310` | Rollback seguro: volver UI o nueva migración forward-only; conservar historia; para monetización, reactivar piloto sin borrar datos. |
| PR395-H08 | medio | `docs/tasks/T-369.md:211` | Decisión 3-A: marcador 'Rollout multi-PR: sí' en ficha, tres PR secuenciales con checkpoints, Refs #356 y cierre manual. |
| PR395-H09 | alto | `docs/contracts/CC-029.md:125` | Agregar refund_charge_id y refund_source_lot_id, UNIQUE par, conversión en misma transacción y pgTAP de carreras. |

**Notas clave:** H02 es una incompatibilidad determinista: el índice `WHERE state <> 'released'` impediría D-C2a con un histórico consumido y nueva reserva. H06, en cambio, es un **riesgo de orden de locks** inferido del contrato; no se ha reproducido deadlock. La revisión elimina la inversión en la prescripción, pero la ausencia de deadlocks sigue siendo un requisito para pgTAP/carreras posteriores.

El libro exige idempotencia de conversión D-C7, y el arrastre se calcula con histórico al corte de período, excluyendo liberaciones posteriores. Se añadieron casos de pruebas para evitar implementaciones basadas en el estado actual que alteren saldos retroactivamente.

**Separación de verificación:** las correcciones al CC/ficha fueron escritas por quien revisa, con autorización del usuario, por lo que estos 9 hallazgos se registran `arreglado-sin-verificar`, sin `verificado_en_sha`. La prueba documental propia no es verificación independiente de la contabilidad PostgreSQL futura.

## Qué se comprobó

- Inspección del contrato, ficha desde `develop`, propuesta, issue #394, y de los flujos reales `app_private.request_cycle`, `app_private.match_offer`, CC-026 y `src/features/trips/actions.ts`.
- GitHub indicó `mergeable=true`; la comparación original con develop era `ahead_by=1`, `behind_by=0`; no se ejecutó `git merge-tree` local.
- Se comprobó en memoria la versión corregida de las tres fichas: **11/11 invariantes documentales pasan**. Las **11/11 mutaciones** diseñadas por esta revisión fueron detectadas; ver [evidencia](../evidencia/comandos.md). Mutaciones solo de strings en memoria.
- No se ejecutaron `pnpm`, `node analizar.mjs`, SQL, Supabase local, Docker, E2E ni tests de DB sobre el HEAD corregido. **Por decisión de Lautaro073, `db-tests` y E2E no bloquean esta PR documental.** Cuando haya migraciones y código en T-369 sí serán obligatorios.
- `approval-policy` exige informe formal en el cuerpo; se agrega al cerrar la ronda. No confundir aprobación del gate documental con aprobación manual del CC.

## Fuentes de verdad y NO TOCAR

- Se mantiene `pilot_active=true` sin cargos, se conserva privacidad del destinatario, RLS y AAL2 solo como contrato a implementar.
- El `docs/master-plan.md` aún describe modelo anterior; CC declara expresamente que T-369-UI debe reconciliar §D6 **antes de activar** el nuevo modelo. Esa reconciliación es una obligación posterior, no una habilitación actual.
- Ficha T-369 mantiene `NO LISTA` mientras CC-029 no esté mergeado. Revisión independiente no da aprobación ni merge.
- No editar `docs/revision-pr/pr-395/**` por parte de agy; no tocar SQL, código, secrets, workflows o tests para forzar verde en esta PR documental.

## Pendientes humanos

- [ ] Lautaro073 revisa y decide el merge de CC-029 (su decisión de producto no equivale al acto de merge).
- [ ] Se mantiene el checklist de aprobaciones/coordinar dominio/UI de CC-029 sin falsificar marcas. Se requiere visto bueno de la zona P2 según el proceso, si corresponde, sin pedirle revisar código.
- [ ] Después de mergear CC-029, recién desbloquear T-369 y seguir rollout 3-A.

**Dictamen de la ronda:** Sin bloqueantes de especificación identificados tras las correcciones redactadas. La verificación de implementación de DB/seguridad y carreras queda pendiente de los PR de T-369.
