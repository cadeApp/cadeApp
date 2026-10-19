# Informe de revisión — PR #425 / T-373 — ronda 4

**PR:** https://github.com/cadeApp/cadeApp/pull/425
**Head de implementación revisado:** `cbf5709299522fc306b0d6dae510f03ee763f6ec`
**Head documental al iniciar:** `0810a2890b41e5ac2283bd664c82475bec2deb68`
**Base:** `develop` @ `9f1d1a6f335915b723d6fe98763990d3097706f4`
**Fecha:** 2026-10-19

## Resultado

**SIN BLOQUEANTES.** PR425-H04 quedó corregido y verificado. No surgieron hallazgos, mejoras ni decisiones nuevas.

## Verificación de PR425-H04 — arreglado-verificado

- `selectCourierCancelledAssignment` devuelve el historial cuando hay eventos propios.
- `NOT_FOUND`, `UNAUTHORIZED_ACTOR`, `VALIDATION_ERROR`, `UNAUTHENTICATED` y una lista vacía conservan el 404
  fail-closed, sin confirmar la existencia del pedido ni eventos ajenos.
- `INTERNAL_ERROR` lanza `CancellationHistoryUnavailableError` con el mensaje fijo
  `CANCELLATION_HISTORY_UNAVAILABLE`; no incluye ids, payloads ni mensajes de PostgreSQL y llega al `error.tsx`.
- Un viaje actual válido conserva el detalle y muestra el error acotado de la tarjeta si falla solo el historial.
- La rama adicional que rechaza un viaje visible de otro repartidor sigue llamando `notFound()` y no reutiliza un
  historial como autorización alternativa.

### Mutación independiente

Se cambió temporalmente la rama de `INTERNAL_ERROR` para llamar `onAbsent()` en vez de lanzar el error sanitizado.
`cancellation-history.test.tsx` quedó RED con 1 fallo y 18 éxitos; falló el oráculo que exige la clase de error y que
el 404 no sea elegido. Tras restaurar el archivo desde el SHA revisado, la misma suite volvió a 19/19 y el árbol quedó
limpio.

## Checks y evidencia

- Dirigidas: 12 archivos / 256 pruebas ✅; test específico restaurado 19/19.
- Local: typecheck ✅; lint ✅. La suite completa ejecutó 2890/2890 pruebas, pero la primera corrida terminó con un
  timeout de 10 s en el `afterAll` de `cc007.test.ts`; aislado inmediatamente, ese archivo pasó 13/13. No se atribuye
  a T-373 ni se oculta el resultado local.
- `pnpm test:db`: no disponible localmente (`ECONNREFUSED 127.0.0.1:54322`); job oficial db-tests ✅.
- CI exacto `cbf57092`: run 39258271108 ✅, con unit/typecheck/lint/build/audit/bundle-budget/db-tests verdes.
- E2E oficial: run 39258408318 ✅; status publicado sobre `cbf57092`, 90 Chromium + 6 global-settings. T-373 pasó.
  Hubo 1 flaky ajeno en `courier-onboarding.spec.ts:852` por timeout de `page.goto`; el retry pasó.
- `approval-policy` sigue rojo hasta que el autor actualice el informe/cuerpo del PR con esta ronda.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| El guard expone lógica sensible al cliente | Solo importa tipos y aplica una decisión pura sobre un resultado ya autorizado por la RPC; no contiene credenciales ni acceso a servidor. |
| Los códigos de autorización deberían mostrar error | En el fallback histórico deben seguir pareciendo ausencia para no revelar pedidos o eventos ajenos; solo `INTERNAL_ERROR` representa una falla operativa. |
| El error fijo pierde diagnóstico | La UI recibe un mensaje sanitizado; el objetivo es evitar revelar ids o detalles de PostgreSQL. La observabilidad del servidor no depende del texto mostrado. |
| El E2E flaky invalida T-373 | El caso T-373 pasó; el único flaky fue de onboarding, falló por navegación y pasó en retry dentro del run exitoso. |

## Recomendación de merge

La implementación queda técnicamente lista desde esta revisión. No aprobar ni mergear por automatización: el autor
debe actualizar el informe del PR, dejar `approval-policy` y todos los checks requeridos verdes, y el dueño del
repositorio toma la decisión final de merge.

## Metodología

Revisión independiente en worktree aislado, sin secretos ni cambios de implementación. Se inspeccionaron el delta de
ronda y el diff completo contra `develop`, contratos, reglas, pruebas y evidencia remota. La única mutación temporal se
restauró antes de editar exclusivamente estos artefactos de revisión.
