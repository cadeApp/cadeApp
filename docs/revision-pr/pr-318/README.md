# PR #318 — T-340, lectores Paso 2/4

**Estado:** Draft. Ronda 4: **CON BLOQUEANTES** (H03–H09). Sin merge.
**Decisión de Lautaro073 (2026-10-12): Opción A.** `get_trip_details` incorpora `drops[]` en orden `position` y mantiene campos escalares de respuesta para solicitudes de un destino; ningún lector depende de `delivery_requests.notes` o `cash_change_amount` legacy. Registrada también en la ficha T-340 de la rama.

## Revisiones

| Ronda | SHA auditado | Resultado | Documento |
|---|---|---|---|
| 1 | `4e70e934` | Gate 0 sin E2E | [R1](revisiones/ronda-1.md) |
| 2 | `9c5e797` | Gate 0 E2E GREEN, RED pendiente | [R2](revisiones/ronda-2.md) |
| 3 | `e61fab67` | H01 y H02 cerrados, Gate 0 verificado | [R3](revisiones/ronda-3.md) |
| **4** | **`c7cab174`** | **7 bloqueantes H03–H09 de lectores y CI** | **[R4](revisiones/ronda-4.md)** |

## Hallazgos de ronda 4

- **H03:** `mark_drop_*` recibe `p_request_id` que sus firmas SQL no aceptan.
- **H04:** `get_trip_details` solo devuelve drop 1 y depende de columnas legacy.
- **H05:** feed/live solo publican contador, faltan resúmenes públicos por drop.
- **H06:** viaje, historial, admin y WhatsApp siguen modelados con un destinatario.
- **H07:** `db-tests` FAIL (UUID de fixture duplicado, plan 83, ejecutadas 77).
- **H08:** `unit` FAIL (cobertura `rpc-fake.ts`: sentencias 88,78 % y ramas 84,88 %; umbral 90 %).
- **H09:** falta prueba N real/privacidad/RED del Paso 2; nuevo test con usos de `any`.

**Comprobaciones positivas parciales:** typecheck, lint, build, audit y bundle-budget PASS; proyección actual de feed/live no selecciona PII y scrubber protege monto privado. `e2e-preview` = error en SHA examinado, `approval-policy` = fail. Sin ejecución Docker/Supabase local.

**Siguiente etapa:** Asako corrige y completa lectores en PR #318 (Draft); revisión independiente posterior, merge y checkpoint en Develop antes de comenzar Paso 3 y Paso 4 con Kira.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
