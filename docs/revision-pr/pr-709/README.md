# PR #709 — T-434 · CC-050 · SEC-09 (rondas independientes 1, 2, 3 y 4)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/709 |
| Issue | #667; seguimiento multicuenta #680 |
| Autor | @Lautaro073 (agy); **revisión independiente** separada de la autorrevisión |
| Rama | `feat/T-434-sec09-dni-oracle` → `develop` |
| Último head **revisado** | `1a0b53d6caeb028f471182ed9055896ceb3cd593` |
| Base comprobada | `develop@dba3314f17f2068b6ff0c7596476d81c2c92e1c1` |
| Alcance del diff | PR documental (4 fuentes de autor); R4: 3 documentos +0 migraciones/código |
| Estado | **R4: SIN BLOQUEANTES de contrato/documentación**, H01–H10 verificados documentalmente. CI del head **cancelado**; no se acredita gate verde ni se aprueba/mergea. |

## Rondas

| Ronda | SHA inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | `68ed5ba9` | 4 bloqueantes (H01–H04), 2 mejoras (H05–H06) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `1c84e997` | H01–H06: corregidos documentalmente; **2 bloqueantes nuevos H07–H08**, mejora H09 | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `b5983ed3` | H07–H09 verificados documentalmente; **H10 bloqueante nuevo** | [revisiones/ronda-3.md](revisiones/ronda-3.md) |
| 4 | `1a0b53d6` | H10 verificado documentalmente; **0 bloqueantes de contenido**, CI cancelado / no verificable | [revisiones/ronda-4.md](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR709-H01 | Reclamante real invisible en la cola; falta búsqueda de disputa aal2 | alto | arreglado-verificado (documental) |
| PR709-H02 | Auditoría nueva sin motivo/etiqueta legible en UI | alto | arreglado-verificado (documental) |
| PR709-H03 | DoD no prueba cupo con cinco fallos reales de finalize ni negativos completos | medio · bloqueante | arreglado-verificado (documental) |
| PR709-H04 | Derivación WhatsApp no conectada a ruta server del onboarding | alto | arreglado-verificado (documental) |
| PR709-H05 | RATE_LIMITED usa aviso genérico o semánticamente incorrecto | bajo · mejora | arreglado-verificado (documental) |
| PR709-H06 | Dependencias/autoría de decisiones redactadas como si ya estuvieran mergeadas/expresamente aprobadas | bajo · mejora | arreglado-verificado (documental) |
| PR709-H07 | TimeZone manipulable cambia window_start y permite cupos múltiples | alto · bloqueante | arreglado-verificado (documental) |
| PR709-H08 | Envelope jsonb/candidates y cast UUID sobre input telefónico no especificados | medio · bloqueante | arreglado-verificado (documental) |
| PR709-H09 | PR body y matriz de invariantes desactualizados | bajo · mejora | arreglado-verificado (documental) |

| PR709-H10 | ORDER BY sobre columna inexistente `c.created_at` | alto · bloqueante R3 | arreglado-verificado (documental R4) |

## Decisiones recibidas ANTES del cierre

**No son una elección expresa de Lautaro en esta sesión.** El interlocutor indica resolución automática de acuerdo con una autorización permanente:
- **D4-B:** búsqueda separada para cuentas `pending` no enviadas, protegida por admin aal2, sin `dni_hmac` en la respuesta ni inclusión en la cola normal.
- **D5-A:** auditoría visible/controlada; permitir razón y etiquetas de `courier_dni_released` sin hash.
- **D6-A:** ratificación automática de D1-A (5/día/cuenta), D2-A (eliminar búsqueda previa/mensaje neutral) y D3-A (liberación admin aal2/razón/audit/guarda de reinstate), documentando el riesgo multicuenta y su seguimiento en #680.
- **Soporte:** `CADEAPP_SUPPORT_WHATSAPP_NUMBER` en servidor y `buildSupportWhatsAppHref` mediante `@/features/merchants/server`, como `/merchant/plan`; sin número válido **no se construye enlace**.

## Resultado de la ronda 2

Se revisó **`1c84e9976cc5bf5655985b4f959fcf12569647b1`**. H01–H06 tienen verificación independiente **solo sobre la especificación**, con 6/6 aserciones y 6/6 mutantes en memoria. H07 requiere fijar TimeZone en la RPC; H08 fija objeto `{ candidates: [...] }` y ramificación UUID/teléfono. H09 sincroniza el cuerpo de PR y el texto «dos RPC». La PR de implementación aún no existe, por lo que no hay RED→GREEN funcional. No se corrieron scripts de `docs/revision-pr/**`.

## Resultado ronda 3

Contra `b5983ed3ba3d59d3deaa477ccb7d56cf2a5c3ffb`, H07–H09 resultaron correctos a nivel **documental** (3/3 controles, 3/3 mutantes detectados). **H10 nuevo bloqueante:** `couriers` carece de `created_at`; exigir `JOIN public.profiles p ON p.id=c.profile_id` y `ORDER BY p.created_at DESC,c.profile_id DESC`, con pgTAP del orden. Informe en [ronda-3.md](revisiones/ronda-3.md). Ninguna decisión nueva de producto.

## Resultado de la ronda 4

Sobre `1a0b53d6caeb028f471182ed9055896ceb3cd593`: H10 corregido en `CC-050` §3b y DoD de T-434. La inspección propia ejecutó **9/9 controles estáticos y 4/4 mutaciones documentales detectadas**, y cotejó 19 referencias de campos en cinco tablas con tipos y DDL. **0 bloqueantes de especificación**, ninguna corrección documental pendiente. Las pruebas pgTAP/RED→GREEN de SEC-09 son obligatorias en la **futura PR de implementación**, no están ejecutadas aquí.

**Gate de CI separado:** ejecución oficial «CI» de este SHA `43193576599` **cancelada a los segundos y sin jobs**; no demuestra typecheck, lint, unit ni db-tests. `approval-policy` y Vercel sí figuran exitosos, pero no los sustituyen. Antes de mergear, quien decide debe confirmar cumplimiento de la política de checks del repo; **no se dispara un CI nuevo solo por el commit de revisión**.

Informe: [revisiones/ronda-4.md](revisiones/ronda-4.md).

## Evidencia y próxima ronda

- Datos: [hallazgos.jsonl](hallazgos.jsonl).
- Evidencia y harness completo: [evidencia/comandos.md](evidencia/comandos.md).
- Aprendizajes: [lecciones.md](lecciones.md).
- El agente solo modifica la especificación (CC, ficha, plan, bitácora) en **esta PR documental**. Prohibido anticipar implementación, manipular evidencia o escribir `docs/revision-pr/**`.
- Ronda 4 documental cerrada; el próximo hito es la validación operativa del merge documental y luego una PR independiente de implementación. No confundir la aprobación del CC con la resolución efectiva de SEC-09.
