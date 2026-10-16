# PR #370 — T-366 · Expiración coherente en el historial del comercio

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/370 |
| Tarea | T-366 (#355; fase 3) |
| Autor inicial | @KiraK72 |
| Responsable de T-366 | @KiraK72 |
| Rama | `feat/T-366-expiracion-historial-comercio` → `develop` |
| Base al revisar | `e1c3074b575ea7db17b661abac687f1c6e292c63` |
| HEAD revisado (sin el commit de revisión) | `7fbf3cedf40e09dd6a5f9046ef8cf6373651622b` |
| Diff | 1 archivo documental agregado, 21 líneas |
| Estado | R2: PR en review, CON BLOQUEANTES H01–H04; NO MERGEAR |

## Rondas

| Ronda | HEAD revisado | Hallazgos del diff | Gate |
|---|---|---|---|
| 1 | `7fbf3cedf40e09dd6a5f9046ef8cf6373651622b` | 0 (solo bitácora, sin implementación) | [CC-026 #371](https://github.com/cadeApp/cadeApp/issues/371) antes de iniciar código T-366 |

Informe: [ronda-1](revisiones/ronda-1.md); datos: [hallazgos.jsonl](hallazgos.jsonl); evidencia: [comandos](evidencia/comandos.md); lecciones: [lecciones](lecciones.md).

## Estado y responsabilidades

- **Decisión D01 = opción C**, resuelta por @Lautaro073 el 2026-10-15: núcleo SQL transaccional privado compartido con RPC autenticada del comercio y barrido de cron.
- **CC-026 (#371):** autor/implementador @Lautaro073. Contrato, permisos, migración, tipos, pgTAP, despliegue, revisión independiente y merge antes de T-366.
- **T-366 (#355) / PR #370:** responsable @KiraK72, issue con label `bloqueada`, PR Draft. No sustituirlo por @Lautaro073.
- Tras el merge del CC, reconciliar la ficha de T-366 en `develop`, desbloquear la issue y avisar a Kira. La PR #370 requiere nueva ronda sobre cambios reales y CI/E2E.
- La ronda 1 NO certifica la funcionalidad ni el DoD, porque no hay implementación en la PR.


## Ronda 2 — 3903388e

- Contrato CC-026 #371 **mergeado y migrado en Supabase Develop**; gate de SQL ya no es el bloqueo principal.
- **Bloqueantes:** H01 (0/true falso éxito), H02 (test de lock valida falso éxito), H03 (E2E incompleto y cancelado), H04 (ficha no reconciliada en develop).
- **Mejora:** H05 backlog >500 requiere evaluar presupuesto de reconciliación.
- [Informe R2](revisiones/ronda-2.md) · [hallazgos actualizados](hallazgos.jsonl) · [evidencia](evidencia/comandos.md).
- **Revisor no ejecutó tests repositorio**, solo inspección del código/CI y reproducción aislada Node del caso 0/true.

## Ronda 3 — `26dbe512`

- [Informe R3](revisiones/ronda-3.md): **H01/H02 corregidos por inspección+CI; H03 y H04 parciales y bloqueantes; H05 mejora no bloqueante**.
- CI del HEAD #38809253455 SUCCESS (unit 2379 PASS; db-tests 2283 PASS), y [E2E #38809405892](https://github.com/cadeApp/cadeApp/actions/runs/38809405892) **79 Chromium + 3 settings PASS**, incluido caso T-366. No equivale a cobertura de todo el DoD (Ver ofertas y dos sesiones concurrentes aún faltan en spec).
- [PR documental #377](https://github.com/cadeApp/cadeApp/pull/377) está OPEN, ficha T-366 aún vieja en develop. R3: CON BLOQUEANTES (2); no mergear #370.

## Ronda 4 — SHA `9bbd2aca` (2026-10-15)

- [**Informe R4**](revisiones/ronda-4.md). **CON BLOQUEANTES (2)**: R01, test E2E auto-reconcilia antes de abrir historial y pierde el oráculo causal; H04, PR documental #377 sigue sin mergear a develop.
- H03 mejoró: «Ver ofertas», `REQUEST_EXPIRED`, dos RPC concurrentes y RLS demostrados por [E2E real #38825238979](https://github.com/cadeApp/cadeApp/actions/runs/38825238979) (79 Chromium + 3 settings PASS para 9bbd2ac); el auto-setup de RPC previa a historial abre R01.
- [CI #38825154664](https://github.com/cadeApp/cadeApp/actions/runs/38825154664) SUCCESS: unit 2379 PASS, pgTAP 2283 PASS, SQL mutante negativo RED y original GREEN. `approval-policy` del PR370 ahora PASS (aprobación de Lautaro073 vigente según log), **no implica merge ni reemplaza review**.
- H01/H02 corregidos por inspección+CI sin test local del revisor; H05 mejora fail-closed aceptable. Reporte y prompt en un solo comentario de PR.

## Ronda 5 — SHA `ecc87929`

- [Informe R5](revisiones/ronda-5.md). **H03 y R01 corregidos por inspección y E2E real de 82 tests**: fixture tardía `published/pending` después de RPC manuales; ingreso a Vencidas cambia DB a `expired/expired`. `hasMore` con cota. `verificado_en_sha=null` porque revisor no ejecutó su propio mutante.
- [CI #38836647443](https://github.com/cadeApp/cadeApp/actions/runs/38836647443) verde: unit 2379 y pgTAP 2283; [E2E #38836718124](https://github.com/cadeApp/cadeApp/actions/runs/38836718124): 79 Chromium + 3 global-settings PASS, checkout efectivo ecc8792.
- **ÚNICO BLOQUEANTE H04:** PR documental #377 sigue sin merge en develop; sus checks build/approval-policy no están verdes. PR370 no apta aún para merge; no rehacer código productivo ya corregido. H05 solo mejora de disponibilidad fail-closed.
