# PR #709 — T-434 · CC-050 · SEC-09 (ronda independiente 1)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/709 |
| Issue | #667; seguimiento multicuenta #680 |
| Autor | @Lautaro073 (agy); **revisión independiente** separada de la autorrevisión |
| Rama | `feat/T-434-sec09-dni-oracle` → `develop` |
| Head **revisado** | `68ed5ba928b1a62d3470949aafda44bae7539f59` |
| Base comprobada | `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1` |
| Alcance del diff | 4 archivos, +427 líneas, exclusivamente documentales |
| Estado | **CON BLOQUEANTES (4)**; 2 mejoras. No aprobar ni mergear. |

## Rondas

| Ronda | SHA inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | `68ed5ba9` | 4 bloqueantes (H01–H04), 2 mejoras (H05–H06) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR709-H01 | Reclamante real invisible en la cola; falta búsqueda de disputa aal2 | alto | abierto |
| PR709-H02 | Auditoría nueva sin motivo/etiqueta legible en UI | alto | abierto |
| PR709-H03 | DoD no prueba cupo con cinco fallos reales de finalize ni negativos completos | medio · bloqueante | abierto |
| PR709-H04 | Derivación WhatsApp no conectada a ruta server del onboarding | alto | abierto |
| PR709-H05 | RATE_LIMITED usa aviso genérico o semánticamente incorrecto | bajo · mejora | abierto |
| PR709-H06 | Dependencias/autoría de decisiones redactadas como si ya estuvieran mergeadas/expresamente aprobadas | bajo · mejora | abierto |

## Decisiones recibidas ANTES del cierre

**No son una elección expresa de Lautaro en esta sesión.** El interlocutor indica resolución automática de acuerdo con una autorización permanente:
- **D4-B:** búsqueda separada para cuentas `pending` no enviadas, protegida por admin aal2, sin `dni_hmac` en la respuesta ni inclusión en la cola normal.
- **D5-A:** auditoría visible/controlada; permitir razón y etiquetas de `courier_dni_released` sin hash.
- **D6-A:** ratificación automática de D1-A (5/día/cuenta), D2-A (eliminar búsqueda previa/mensaje neutral) y D3-A (liberación admin aal2/razón/audit/guarda de reinstate), documentando el riesgo multicuenta y su seguimiento en #680.
- **Soporte:** `CADEAPP_SUPPORT_WHATSAPP_NUMBER` en servidor y `buildSupportWhatsAppHref` mediante `@/features/merchants/server`, como `/merchant/plan`; sin número válido **no se construye enlace**.

## Evidencia y próxima ronda

- Datos: [hallazgos.jsonl](hallazgos.jsonl).
- Evidencia y harness completo: [evidencia/comandos.md](evidencia/comandos.md).
- Aprendizajes: [lecciones.md](lecciones.md).
- El agente solo modifica la especificación (CC, ficha, plan, bitácora) en **esta PR documental**. Prohibido anticipar implementación, manipular evidencia o escribir `docs/revision-pr/**`.
- Tras los arreglos, volver a inspeccionar el nuevo SHA, verificar controles que de verdad fallen ante mutaciones y controlar de nuevo el target.
