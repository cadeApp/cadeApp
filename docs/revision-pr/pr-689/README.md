# PR #689 — T-430 / CC-048 · SEC-06

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/689 |
| Autor | Lautaro073 |
| Rama | `feat/T-430-sec06-draft-only` → `develop` |
| Base revisada | `c823fae1b9ff79b6e456c51a77b3543c9b6f17f8` |
| Head revisado (ronda 1) | `7ce8a7f15b28f8624d025efb5f17949c982b858e` |
| Implementación verificada en CI | `93d4fa338dba1b3cafdf9b79b5c5c4ac3616380d` |
| Estado | **Ronda 1 cerrada: SIN BLOQUEANTES comprobados, 1 MEJORA de pruebas pendiente (D02-A)** |
| Decisiones | D01-A ratificada; D02-A solicitada para la siguiente entrega |
| Aprobación/merge | No se aprueba ni se mergea desde la revisión |

## Entregables

- [Ronda 1 — informe completo](revisiones/ronda-1.md).
- [Hallazgos estructurados](hallazgos.jsonl): `PR689-A01` aceptado y `PR689-H01` abierto.
- [Evidencia y comandos](evidencia/comandos.md): trazabilidad CI, mutaciones estáticas propias y harness completo.
- [Lecciones](lecciones.md).

## Resumen ejecutivo

La migración limita el UPDATE de `delivery_requests` al propietario en estado `draft`, restringe INSERT/UPDATE de `delivery_request_contacts`, revoca permisos de cliente peligrosos y serializa el INSERT de contacto con la solicitud padre. La evidencia del autor del run 43141703429 contiene 45 archivos y 3797 aserciones pgTAP en PASS y 8/8 escenarios CC-048; el revisor cotejó el contenido de los logs, pero **no ejecutó PostgreSQL local** (restricción del proyecto).

Se acepta la ampliación de dos archivos de prueba (`t339_fixed_price.sql` y `integration/cc026_reconcile_expired_requests.mjs`) porque los efectos del contrato están justificados y las aserciones conservan su intención; decisión explícita D01-A de Lautaro073 el 2026-11-12.

`PR689-H01`: faltan pruebas que aíslen la condición `status = 'draft'` del `WITH CHECK` de `contacts_insert_merchant` de la protección redundante del trigger. No es un bypass demostrado con el SQL correcto; es una ceguera potencial de la batería ante una futura regresión. D02-A exige una prueba pgTAP en subtransacción con trigger temporalmente deshabilitado y mutación RED específica de la policy. **Permanece abierto hasta que lo verifique la revisión independiente sobre otro SHA.**

El gate `e2e-preview` marcó `BLOCKED / REQUIRES DEVELOP MIGRATION` para el SHA de código por la migración nueva; no hay E2E verde ni se interpreta como fallo funcional de E2E. No se exige revalidar todo CI solo porque el commit de esta carpeta cambia documentación.

La autoría de la carpeta `docs/revision-pr/pr-689/` es exclusivamente de la revisión; agy documenta avances solo en `docs/tasks/log/T-430.md`.
