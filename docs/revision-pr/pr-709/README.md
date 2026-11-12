# PR #709 — T-434 · CC-050 · SEC-09 (rondas independientes 1 y 2)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/709 |
| Issue | #667; seguimiento multicuenta #680 |
| Autor | @Lautaro073 (agy); **revisión independiente** separada de la autorrevisión |
| Rama | `feat/T-434-sec09-dni-oracle` → `develop` |
| Head **revisado** | `68ed5ba928b1a62d3470949aafda44bae7539f59` |
| Base comprobada | `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1` |
| Alcance del diff | 4 archivos, +427 líneas, exclusivamente documentales |
| Estado | **R2: CON BLOQUEANTES (2 nuevos: H07–H08), 1 mejora H09**. H01–H06 corregidos documentalmente; no aprobar/mergear. |

## Rondas

| Ronda | SHA inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | `68ed5ba9` | 4 bloqueantes (H01–H04), 2 mejoras (H05–H06) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `1c84e997` | H01–H06: corregidos documentalmente; **2 bloqueantes nuevos H07–H08**, mejora H09 | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR709-H01 | Reclamante real invisible en la cola; falta búsqueda de disputa aal2 | alto | arreglado-verificado (documental) |
| PR709-H02 | Auditoría nueva sin motivo/etiqueta legible en UI | alto | arreglado-verificado (documental) |
| PR709-H03 | DoD no prueba cupo con cinco fallos reales de finalize ni negativos completos | medio · bloqueante | arreglado-verificado (documental) |
| PR709-H04 | Derivación WhatsApp no conectada a ruta server del onboarding | alto | arreglado-verificado (documental) |
| PR709-H05 | RATE_LIMITED usa aviso genérico o semánticamente incorrecto | bajo · mejora | arreglado-verificado (documental) |
| PR709-H06 | Dependencias/autoría de decisiones redactadas como si ya estuvieran mergeadas/expresamente aprobadas | bajo · mejora | arreglado-verificado (documental) |

| PR709-H07 | TimeZone manipulable cambia window_start y permite cupos múltiples | alto · bloqueante | abierto |
| PR709-H08 | Envelope jsonb/candidates y cast UUID sobre input telefónico no especificados | medio · bloqueante | abierto |
| PR709-H09 | PR body y matriz de invariantes desactualizados | bajo · mejora | abierto |

## Decisiones recibidas ANTES del cierre

**No son una elección expresa de Lautaro en esta sesión.** El interlocutor indica resolución automática de acuerdo con una autorización permanente:
- **D4-B:** búsqueda separada para cuentas `pending` no enviadas, protegida por admin aal2, sin `dni_hmac` en la respuesta ni inclusión en la cola normal.
- **D5-A:** auditoría visible/controlada; permitir razón y etiquetas de `courier_dni_released` sin hash.
- **D6-A:** ratificación automática de D1-A (5/día/cuenta), D2-A (eliminar búsqueda previa/mensaje neutral) y D3-A (liberación admin aal2/razón/audit/guarda de reinstate), documentando el riesgo multicuenta y su seguimiento en #680.
- **Soporte:** `CADEAPP_SUPPORT_WHATSAPP_NUMBER` en servidor y `buildSupportWhatsAppHref` mediante `@/features/merchants/server`, como `/merchant/plan`; sin número válido **no se construye enlace**.

## Resultado de la ronda 2

Se revisó **`1c84e9976cc5bf5655985b4f959fcf12569647b1`**. H01–H06 tienen verificación independiente **solo sobre la especificación**, con 6/6 aserciones y 6/6 mutantes en memoria. H07 requiere fijar TimeZone en la RPC; H08 fija objeto `{ candidates: [...] }` y ramificación UUID/teléfono. H09 sincroniza el cuerpo de PR y el texto «dos RPC». La PR de implementación aún no existe, por lo que no hay RED→GREEN funcional. No se corrieron scripts de `docs/revision-pr/**`.

## Evidencia y próxima ronda

- Datos: [hallazgos.jsonl](hallazgos.jsonl).
- Evidencia y harness completo: [evidencia/comandos.md](evidencia/comandos.md).
- Aprendizajes: [lecciones.md](lecciones.md).
- El agente solo modifica la especificación (CC, ficha, plan, bitácora) en **esta PR documental**. Prohibido anticipar implementación, manipular evidencia o escribir `docs/revision-pr/**`.
- Tras los arreglos de R2, volver a inspeccionar el nuevo SHA, verificar controles que de verdad fallen ante mutaciones y controlar de nuevo el target.
