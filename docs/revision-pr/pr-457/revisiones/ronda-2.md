# Informe revisar-pr — PR #457 / T-386 — Ronda 2

**Fecha:** 2026-10-20 · **HEAD revisado:** `adae6466d2e9ca8fd80c31134617a4347da3fbbe` · **SHA funcional:** `d1b903a6a304aa11131884cd9b5e5acaf06d3148` · **Base:** `develop@24de5c511b32a1d472d4e022284997cc1648df83`.

**Resultado: SIN BLOQUEANTES (0)** · 0 hallazgos nuevos · H01/H02/H03 cerrados · 0 decisiones abiertas. **Apto para merge por Lautaro073, sujeto a las comprobaciones normales de GitHub.** La revisión no aprueba ni mergea.

## Alcance y fuentes

Leídos desde `develop`: `docs/tasks/T-386.md`, `docs/contracts/CC-035.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `README.md`, `.agents/skills/revisar-pr/SKILL.md`. Contraste con `ronda-1.md`, `hallazgos.jsonl`, bitácora, comentarios y fuentes de la PR. Desde el commit de revisión de ronda 1 `2f806babe5a49c26629dfa1ee098f35eab509bc7` cambiaron seis archivos, todos incluidos en «Archivos permitidos»; no cambió la ficha ni el CC. La revisión no modificó `ronda-1.md`.

El HEAD `adae6466` agrega **solo bitácora** sobre `d1b903a6` (comparación GitHub: un archivo `docs/tasks/log/T-386.md`, +12). Por eso las pruebas funcionales se atribuyen al SHA de código `d1b903a6` y la inspección de cierre al HEAD `adae6466`. GitHub informa `mergeable=true`; no se ejecutó `git merge-tree` por falta de clon local.

## Hallazgos de ronda 1

| Hallazgo | Resultado de ronda 2 | Evidencia |
|---|---|---|
| **PR457-H01** (alto) | **Arreglado, comprobado por inspección propia + CI** | Antes de `->>`, la RPC exige JSON `string` para `endpoint`, `p256dh` y `auth`, y `null/string` para `platform`. pgTAP incluye negativos para booleano, número y objeto. |
| **PR457-H02** (alto) | **Arreglado, comprobado por inspección propia + CI** | `auditChain` obtiene `before/after.user_id` por `target_id`, ordena por `audit_log.id` (BIGINT identity) y compara C→A→B; escenario 1 compara A→B. El modo `--mutation-lock-check` quita el `FOR UPDATE`, exige precisamente C→A y C→B y restaura SQL en `finally`. |
| **PR457-H03** (bajo) | **Arreglado por inspección** | El docblock CC-016 quedó inmediatamente delante de `get_request_offer_couriers`. |

### RED→GREEN contrastado en GitHub Actions

- [RED 39397626046](https://github.com/cadeApp/cadeApp/actions/runs/39397626046) — SHA `e72ae94e7d739e9d3b3dd7ec23a12790ae50ef43`: pgTAP H01 falla tests **16, 17** y **19, 20** en cascada; `Tests=41`, `Failed=4`, `Result: FAIL`.
- [GREEN 39398396861](https://github.com/cadeApp/cadeApp/actions/runs/39398396861) — SHA `d1b903a6a304aa11131884cd9b5e5acaf06d3148`: `cc035_register_push_subscription.sql ... ok`; `Files=33, Tests=2959, Result: PASS`. No confundir el `Result: FAIL` de las mutaciones deliberadas CC-026/CC-030 con una regresión de la suite oficial.
- Ese mismo job ejecutó las dos sesiones CC-035 y devolvió `scenario1 GREEN`, `scenario2 GREEN (C→A→B)`, `--mutation-check RED→GREEN` y `--mutation-lock-check RED [C→A,C→B] → GREEN [C→A,A→B]`. El log contiene efectivamente los JSON `from`/`to` de ambos registros del mutante; no es solo una etiqueta escrita en la bitácora.
- Drift de tipos: paso `git diff --exit-code -- src/types/database.types.ts` completado. En el SHA de código también terminaron con éxito `unit`, `typecheck`, `lint`, `build`, `audit` y `bundle-budget`. El E2E preview de esta PR sigue condicionado al despliegue de la migración en Develop, por definición del alcance T-386/T-383.

### Sondas independientes de esta revisión

Se inspeccionaron los blobs **exactos** del HEAD `adae6466` y se ejecutaron **comprobaciones estáticas en memoria** con mutaciones propias (quitar/desviar guardas de JSONB, neutralizar `before/after`, cambiar el tramo A→B del oráculo y desactivar la instalación del SQL sin lock). Todos los controles de fuente usados para esas sondas pasaron en baseline y detectaron sus mutantes. Véase `evidencia/comandos.md` para el harness íntegro reproducible.

**Límite explícito:** no se ejecutó PostgreSQL, Docker, `pnpm test:db` ni `pnpm typecheck/lint/test` en una máquina propia porque esta sesión no dispone del clon ni de una DB local y la revisión prohíbe levantarlos. Los RED→GREEN funcionales provienen de CI del autor, comprobados directamente en los logs y cotejados con la implementación. Las sondas propias son **estáticas**, no una segunda prueba de comportamiento SQL.

## Análisis de regresión y entrega

No se detectaron desviaciones de `CC-035`, cambios de RLS, exposición de dueño anterior o de endpoint/claves en auditoría, ni alteraciones de pruebas para pasar CI. El cuerpo de la PR decía «38 aserciones» y omitía la segunda mutación; se actualizó **solo el texto de la PR** a 41 y se explicó `--mutation-lock-check` (mejora editorial menor, resuelta).

**Decisiones:** ninguna. El riesgo de reasignación de endpoint conocido está explícitamente aceptado en `CC-035`. El logout de todos los dispositivos permanece fuera de esta tarea.

**Conclusión:** **SIN BLOQUEANTES**. Lautaro073 puede decidir el merge cuando GitHub lo habilite. **Acción posterior obligatoria:** comprobar `migrate-develop` y la existencia de la RPC en Develop antes de desbloquear T-383/#447. No se exige una nueva corrida GREEN únicamente por la bitácora o este commit documental de revisión. La revisión no aprobó ni mergeó la PR.
