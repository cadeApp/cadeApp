# Revisión independiente — PR #407 / T-371 — ronda 1

Fecha: 2026-10-17.
SHA revisado: b2dbfc2bba82ed5e2d9e01495761ec8fa30e75a2.
Base al inicio: 06c29afe71cfe873b6b7fcf78b2a47d424f96556.
Resultado: **CON BLOQUEANTES (1 prueba unitaria que no discrimina flujo real; sincronización de rama con develop pendiente)**.

## Método

1. Se leyeron reglas y skill de revisión, AGENTS, ficha desde develop, contrato CC-029, código productivo existente, seis archivos del diff, bitácora y comentarios. No se usó la ficha del PR como autorización: su fuente de verdad fue develop.
2. GitHub confirma 6 archivos del diff antes de normalizar upstream: ficha T-371, plan de implementación, bitácora, E2E de suscripción, dos suites Vitest. No hay migraciones, cambios de RPC/contratos de dominio, secretos ni workflow editados.
3. Comparación de implementación contra contrato CC-029: cuando el piloto está apagado y el comercio activo tiene paid_until vencido y no dispone de créditos ni plan ilimitado, PUBLICATION_CREDITS_EXHAUSTED es coherente. SUBSCRIPTION_INACTIVE queda para estado cancelado; el E2E histórico esperaba una regla vieja.
4. Se consultaron los logs reales de CI y E2E del SHA funcional. El entorno de revisión NO puede clonar GitHub (DNS), así que no se ejecutó Vitest ni mutaciones independientes; nunca afirmar ejecución local o verificado_en_sha ficticios.

## Correcto comprobado

- Los 3 escenarios global-settings ejecutaron realmente sobre SHA b2dbfc2: DoD1 negativo PASS, DoD2 piloto activo PASS, DoD3 legacy paid_until futuro PASS. Los 86 E2E Chromium también pasaron; job trusted e2e-preview SUCCESS (#39069904081, job 117505215877).
- Las nuevas aserciones de precondición comprueban pilot_active=false y subscription_status=active, paid_until=2020-01-01. La fixture crea un merchant nuevo por run: no hay concesión de créditos en ese seed por inspección.
- El oráculo negativo de publicación ahora inspecciona contactos del drop con notas y relaciones a solicitud en lugar de depender solo de delivery_requests.notes (nulo en multi-drop). El run pasó las consultas reales sin error.
- Los tres tests usan finally anidados para restaurar y releer pilot_active y los dos campos de suscripción originales; deja de sobrescribir a pilot/null.
- CI run #39069842415 success: Vitest 141 files / 2670 tests PASS; workflows 79/79 y ADR 6/6; db-tests termina Files=29, Tests=2735, Result: PASS; typecheck/lint/audit/build/bundle-budget PASS. No se confunden RED intencionales de mutaciones SQL en el job db-tests con fallo final.

## H01 — BLOQUEANTE MEDIO, falta control de invocación

**Toda la clase enumerada:** los dos tests T-371 nuevos comprueban el *resultado superficial* de un rechazo pero no verifican si el efecto provino de la dependencia que afirman probar:

1. src/features/requests/actions.test.ts:390-420, T-371 propaga PUBLICATION_CREDITS_EXHAUSTED cuando RPC rechaza: configura mockRpc para devolver ese error y al final solo comprueba result. No hay expect(mockRpc).toHaveBeenCalledTimes(1) ni llamado correcto a create_and_publish_multi_drop con payload.
2. src/features/requests/components/create-request-form.test.tsx:352-388, T-371 muestra alerta: el mock de createDeliveryRequestAction devuelve ese código y las únicas expectativas revisan DOM y notify. No se verifica que se haya llamado a la Server Action con requestId/drops válidos.

**Contraejemplo semántico:** si la Server Action devuelve directamente err('PUBLICATION_CREDITS_EXHAUSTED') justo antes de callRequestRpc, el test nuevo de actions continúa pudiendo pasar sin haber ejecutado la RPC. Si el formulario crea el mensaje localmente sin invocar createDeliveryRequestAction, su test nuevo continúa pudiendo pasar. Esto es **análisis estático**, no una mutación ejecutada por el revisor.

**Arreglo exigido:** agregar los espías de invocación correctos en ambos tests, sin cambiar implementación productiva ni debilitar expectativas. Hacer mutaciones temporales locales y demostrar el test objetivo GREEN original → RED funcional con dependencia omitida → GREEN restaurado; especificación exacta en evidencia/comandos.md y comentario de la PR.

## A01 — Omisión documental de la ficha original, corregida fuera de la rama

Al crear T-371 originalmente, la ficha omitió una fila en docs/implementation-plan.md, usó encabezados no reconocidos por tools/verify-fichas y no autorizó el propio plan. El agente corrigió esos documentos dentro de #407; el origen fue **la ficha inicial**, no su lógica funcional.

Como corrección mínima documental separada, la revisión creó y mergeó PR #408 (solo docs/tasks/T-371.md y docs/implementation-plan.md) a develop en SHA d885b24a6790e54453a07650b0d4f1b2e174f489, sin modificar código ni tocar #407.

**Pendiente:** el agente debe git fetch origin && git merge origin/develop (NO rebase/force), verificar que la fila T-371 sea única y que los DoD marcados sobrevivan a la integración. GitHub comparaba branch behind=1 después de la normalización. No confirmar conflictos sin merge-tree efectivo.

## Calidad y gates

- La bitácora describía RED con comentario temporal de setServerError y salida genérica de 3 fallos, sin comando exacto ni salida completa reproducible. No se acusó falsificación; pedir comandos/resúmenes precisos y mutaciones de los controles nuevos.
- El body de PR contiene únicamente Closes #405. El check approval-policy falla con: Falta el informe completo de revisar-pr sin bloqueantes. No completar ese informe como SIN BLOQUEANTES mientras H01 esté abierto.
- La PR está Draft; no se aprueba ni mergea. Al cerrar el código, agregar al body informe de review con la sección y términos exigidos por .github/workflows/approval-policy.mjs.
- Cambios exclusivamente en docs/revision-pr/** o bitácora no justifican un nuevo CI GREEN. Sí se revalidan los tests funcionales modificados en este arreglo.

## Mejoras no bloqueantes

- Hacer explícito, si se endurece la fixture, que un merchant de prueba recién creado no recibe créditos ni períodos. No alterar fixtures globales fuera de los archivos permitidos ni tocar DB por consola remota.
- El cuerpo PR debería resumir diagnóstico y resultados del E2E CI real, no limitarse a Closes #405.

## Decisiones de producto

Ninguna. La regla CC-029 ya define la semántica; las omisiones de verificación y plan son técnicas/documentales, no ameritan decisiones de negocio.

## Cierre

No se aprobó ni se mergeó #407. La evidencia real demuestra que el defecto E2E histórico está corregido, pero H01 debe garantizar que los tests unitarios no pasen con el wiring roto; después la aprobación/merge quedan a cargo de Lautaro073.