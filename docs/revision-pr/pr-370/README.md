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
| Estado | Draft / bloqueada por contrato CC-026; NO MERGEABLE funcionalmente |

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
