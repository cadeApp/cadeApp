# PR #332 — CC-024 / T-340 — Informe independiente Ronda 1

- Fecha: 2026-10-14. HEAD inspeccionado: `80e0edbf637a662d7b03a33dab8c6fc3bda23dd6`; base develop `205a93f9de8a68c6aa1d064564f2c016b8be8201`.
- Alcance: un único documento `docs/contracts/CC-024.md`, 253 líneas. Draft. Sin SQL ni aplicación.
- **Resultado: CON BLOQUEANTES (4), mejora (1).**
- Decisiones resueltas por Lautaro073: **1-A: sin duplicación de destinatario**; **2-A: UUID estable generado en navegador, reutilizado en retries**.

## BLOQUEANTES
### PR332-H01 — La nueva RPC duplica primer destinatario en columnas legacy contra decisión 1-A [alto]

- Ruta `docs/contracts/CC-024.md:99`. Evidencia: CC-024 §Propuesto líneas 99-107 promete proyección pública del drop 1 y contacto legacy con primer destinatario.
- Corrección requerida: Para nuevas solicitudes conservar solo pickup en delivery_request_contacts; campos legacy de destino y datos privados del destinatario en padre/contact legacy NULL; datos de N destinos exclusivamente en delivery_request_drops y delivery_request_drop_contacts. Cliente legacy intacto.
- Detección: análisis de código/contrato, sin ejecución de la RPC (aún no existe).

### PR332-H02 — UUID del navegador no tiene ciclo de vida de reintento especificado (decisión 2-A) [alto]

- Ruta `docs/contracts/CC-024.md:43`. Evidencia: CC-024 línea 43 solo dice generado por cliente para intento y no fija reuso del UUID en submit, timeout, doble clic, nuevo intento.
- Corrección requerida: Especificar crypto.randomUUID() generado en el navegador una vez por intento, persistido para retries equivalentes, nunca regenerarlo por retry; nuevo UUID solo al comenzar una solicitud distinta. Server Action valida y retransmite UUID, no lo genera por invocación; auth.uid valida propiedad.
- Detección: análisis de código/contrato, sin ejecución de la RPC (aún no existe).

### PR332-H03 — La respuesta idempotente fija status=published pero puede existir estado posterior [alto]

- Ruta `docs/contracts/CC-024.md:88`. Evidencia: CC-024 líneas 83-96 prometen status published; una solicitud publicada puede estar luego matched/in_transit/delivered. El algoritmo de comparación canónica contra la DB tampoco enumera las columnas inmutables.
- Corrección requerida: Definir status actual o creationStatus/currentStatus sin mentir en retry tardío; publishedAt conserva timestamp inicial. Comparar todas las entradas normalizadas inmutables (pickup, precio, N destinos y contactos) dentro de función autenticada con lock, excluyendo campos mutables/derivados. Mismo UUID+diferente payload ERROR; actor ajeno NOT_FOUND; sin repost ni eventos duplicados.
- Detección: análisis de código/contrato, sin ejecución de la RPC (aún no existe).

### PR332-H04 — Falta reconciliar ficha T-340 y el rollout de migración después del CC documental [alto]

- Ruta `docs/contracts/CC-024.md:184`. Evidencia: CC-024 líneas 184-186 dice merge CC y luego aplicar migración, pero PR332 solo tiene CC-024.md. Ficha T-340 permite *_t340_*.sql, y limita el runner de concurrencia a pasos anteriores; CC requiere *_cc024_*.sql, contracts/fake/wrappers y nuevas pruebas.
- Corrección requerida: En esta PR reconciliar docs/tasks/T-340.md con archivos/DoD exactos y E2E de CC-024; definir secuencia CC documental -> PR backend RPC + tests/contratos -> merge humano + migrate-develop verificado -> escritor PR330 -> E2E/revisión. No extender runner/CI sin alcance aprobado.
- Detección: análisis de código/contrato, sin ejecución de la RPC (aún no existe).

## MEJORA no bloqueante
- **PR332-M01 — CC-024:168-169:** `requestId` también es clave de idempotencia y es visible; la matriz no debe presentarlo como secreto inaccesible. Diferenciar `requestId` público y payload original privado; nunca autorizar por mera posesión del UUID.

## Estado de CI y límites
- Sobre el SHA original: unit, typecheck, lint, build, audit, bundle-budget, db-tests y Vercel SUCCESS; approval-policy FAIL (falta revisión). No atribuir el éxito a una RPC que aún no existe. El nuevo commit documental mueve el HEAD y reinicia el gate.
- No se ejecutaron pgTAP, SQL remoto, Docker, tests Node locales ni mutaciones RED→GREEN independientes en esta revisión documental.
- Hallazgos H01/H02 y H03/H04 son contractuales; actualizar el CC antes de desplegar backend. Ni revisión ni implementación aprobada o mergeada.
