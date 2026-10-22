# Informe de revisión — PR #388 / T-369 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/388
**Autor:** Lautaro073
**HEAD original de autor:** `b597810ef7eddc319ce8cc9d62002f930379e1d0`
**HEAD de ficha con ajustes solicitados:** `ecd13a15831be01c9473c202151f49a2d7d07840`
**Base de referencia (apertura):** `develop` @ `cf65ce256f8fb45a9d9bc890f4531b1ae03cbea6` (posteriormente avanzó a `50c99b0` con T-359)
**Fecha:** 2026-10-17
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES** tras decisiones 1-A/2-B/3-A y correcciones pequeñas sobre la rama. **NO LISTA PARA IMPLEMENTAR** hasta CC-029 mergeado.

## Diagnóstico y alcance

- El PR original agrega `docs/tasks/T-369.md` y una fila en `docs/implementation-plan.md`. No introduce código, SQL, E2E ni configuración.
- `docs/tasks/T-369.md` no existía en `develop` al abrir la PR; se contrastó con la issue #356 y el master plan. El protocolo de CC-029 marca expresamente la implementación como bloqueada.
- La carpeta `docs/tasks/log/T-369.md` todavía no existe: es un requisito de implementación futura, **no** un requisito ejecutado por esta PR documental.
- El documento fija el piloto intacto; no se tocaron variables, bases remotas, RLS ni entornos.

## Hallazgos originalmente detectados y tratados como ajustes mínimos

| ID | Severidad original | Fuente | Corrección documental |
|---|---|---|---|
| PR388-H01 | media | D4 `vence sin ofertas` | Se cambia a `vence sin match, haya o no ofertas pendientes` (decisión 1-A). |
| PR388-H02 | alta | D4 devolvía saldo por `no_show` mientras permitía republicación sin cobrar | `no_show` y cancelación de repartidor antes de retiro ahora convierten consumo en reserva asociada; republicar no cobra (2-B, 3-A). |
| PR388-H03 | media | `report_no_show(false)` deja estado `cancelled` | Liberar reserva al saldo en esa misma transición sin republicación para no inmovilizarla; guardar reintegro si republicada vence/cancela sin match. |
| PR388-H04 | media | D6 prometía descuento en primera compra; CC/DoD decían primera acreditación | Solo la primera compra confirmada aplica descuento; no acreditaciones gratis/ajustes. |

**Independencia de verificación:** estos cambios fueron **redactados por la misma revisión** a pedido de Lautaro073; por separación de responsabilidades quedan `arreglado-sin-verificar` en el JSONL. La prueba estática propia detectó las seis mutaciones, pero no certifica ejecución DB/E2E de una funcionalidad todavía inexistente. No atribuir `verificado_en_sha` a un arreglo propio.

## Riesgos de implementación señalados para CC-029 (no bloquean la ficha de planificación)

1. **Lotes vencidos con reserva existente:** CC-029 debe definir si una reserva consumida tras vencer el plan se liquida contra el lote ya expirado y cómo se registra una devolución que no vuelve a ser gastable; jamás generar saldo gastable nuevo por error.
2. **Catálogo mutable:** definir snapshot de cupo, precio de referencia, vigencia y reglas aplicadas a cada período comprado. Editar catálogo no modifica retroactivamente derechos otorgados.
3. **Costo multi-drop:** validar `N` entero positivo y acotado en admin/RPC; registrar snapshot de costo por solicitud.
4. **Fidelidad/gracia:** definir calendario local, el significado exacto de mes consecutivo, primer porcentaje al renovar y qué ocurre durante `subscription_grace_days`.
5. **Permisos/atomicidad:** cubrir en pgTAP `no_show(true/false)`, `courier_cancel_match`, cancelación comercial previa/posterior al match, expiración con ofertas pendientes, plan expirado con reserva previa, consumo con `take_request` y no gastar dos veces por retry. Asegurar UPDATE condicionado por `expires_at` y estado, y eventos derivados de las filas realmente modificadas (AG-74).

Estas son definiciones **para CC-029**, no comportamientos implementados o verificados en #388. El CC sigue siendo bloqueante para `tomar-tarea`.

## Pruebas y alcance de evidencia

- **GH Actions sobre SHA `b597810`:** `unit`, `typecheck`, `lint`, `build`, `audit`, `db-tests`, `bundle-budget` en success. El color no demuestra las nuevas reglas de créditos, todavía sin código.
- **Ajustes de la documentación en `ecd13a15831be01c9473c202151f49a2d7d07840`:** prueba estática independiente en memoria GREEN 8/8; seis mutaciones intencionales RED 6/6; detalle y script reproducible en [comandos.md](../evidencia/comandos.md).
- **E2E:** corrida externa asociada al Preview registrada `error` por cancelación del workflow. Su job reportó 54 casos antes de abortar; un test de notificaciones necesitó un retry. No está certificado como E2E aprobado para esta revisión.
- **Approval-policy:** fallaba porque el cuerpo no tenía informe; añadirlo en formato obligatorio después de commitear la carpeta (no simular aprobación de otro usuario).
- **Local:** no se pudieron correr comandos `pnpm`, `git merge-tree` ni `git diff --check` al no estar disponible un clon en este entorno; no afirmar su resultado.
- **Merge:** GitHub informó `mergeable=true` en la consulta, pero debe volver a comprobarse contra el HEAD actualizado.

## NO TOCAR

- No crear ni aplicar CC-029 en esta PR; no iniciar T-369 ni cambiar piloto real.
- No alterar `.github/**`, tests para forzar verde, SQL remoto, entornos, credenciales ni migraciones ya mergeadas.
- El autor de la tarea no debe modificar `docs/revision-pr/pr-388/**`.

## Dictamen

**SIN BLOQUEANTES del cambio documental.** Una vez estén revalidados los gates del SHA final y el informe de política en el cuerpo, la PR puede ser considerada para merge por Lautaro073. La implementación sigue expresamente bloqueada por CC-029. No se aprobó ni mergeó.
