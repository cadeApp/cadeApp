# Revisión independiente — PR #508 / T-393 — Ronda 2

**Fecha:** 2026-10-22 · **SHA del código:** `455adc155103cc7d624c40fe3e8db25f23c19fae`
**Anterior:** `e234ad0955b262f1cb2ce29ed06a50859ba9935f`
**Resultado:** H01/H02 corregidos por inspección pero `arreglado-sin-verificar`; H03 mejora no bloqueante abierta.

## Sincronización
Durante la revisión la rama avanzó en dos commits de código, `57db1c09` y `455adc15`, y al menos uno posterior de **solo bitácora**, `4699ab55`; no se sobrescribieron cambios ajenos. La ronda 1 quedó referida al SHA original. GitHub reportó mergeable, pero develop incorporó cinco commits ajenos en archivos sin solapamiento con los doce de T-393. No pudo correrse `git merge-tree` porque no hay clon (DNS GitHub no disponible).

## H01 — corregido por inspección, no verificado
En `trip-merchant-view.tsx` se envía `drop.status` al WhatsApp si existe una sola entrega fallida; se muestra `No entregada` incluso en single y `Motivo:` sin exigir `isMultiDrop`. El helper `src/lib/whatsapp.ts` permanece intacto. Nuevo test real en `components.test.tsx` cubre Badge, motivo y WhatsApp; `drop-outcome.test.ts` cubre un único failed; la ficha actualizada restringe el fallback por request a legacy sin drops. La bitácora del agente declara los casos RED en mutaciones controladas y GREEN de 518 tests de features. **No se reprodujo RED del autor de forma independiente.**

## H02 — corregido por inspección, no verificado
En `e2e/specs/merchant-partial-delivery.spec.ts` el fixture crea `draft`, el comercio autenticado llama `publish_request(p_request_id)`, se exige error nulo y status `published` antes de ofertar. La bitácora declara `1 passed (22.0s)` en Preview; verificar independientemente el E2E, SHA exacto y RED al omitir publicación. No falsificar pruebas, no insertar directamente `published` ni debilitar aserciones.

## H03 — mejora no bloqueante
`components.test.tsx` prueba texto `No entregado`, pero no detecta una mutación de `XCircle` al check `CheckCircle2` en el último paso. El JSX actual usa el icono correcto. Un test acotado y mutación RED resolverían esa debilidad. No se encontró defecto visual en producción.

## Evidencia independiente
- Inspección de diff, ficha, contratos y versión GitHub de `455adc155103cc7d624c40fe3e8db25f23c19fae`.
- Función `summarizeDropOutcome` sin cambios: batería del revisor con **10 GREEN** y **5 mutaciones RED** en JS eliminando exclusivamente el tipado TS; harness completo en `evidencia/comandos.md`. No equivale a ejecutar Vitest de componentes.
- GitHub CI run `39730074779` sobre SHA de código: job unit `success`, log **Test Files 158 passed; Tests 3198 passed**; typecheck, lint, build, audit y bundle-budget `success` al inspeccionar.
- `format:check` reporta 262 archivos de formato preexistentes como warning (job lint exitoso), no bloqueo de T-393.
- `db-tests`/ `e2e-preview` aún pendientes cuando fueron consultados; no se les atribuye un resultado.
- No se ejecutaron pnpm/Vitest/Playwright locales ni se levantó Docker/Supabase, por ausencia de clon/credenciales. No completar `verificado_en_sha` solo a partir de la bitácora del autor.
- Los commits exclusivamente de bitácora/informe no obligan a exigir de nuevo CI verde.

## Siguiente verificación
Reproducir por el revisor los rojos genuinos de H01 y la precondición de `publish_request` de H02, luego GREEN real sobre el SHA vigente; revisar el estado del merge con develop. Si todo es correcto, cerrar sin bloqueantes y decidir si tomar H03 como mejora. No hay decisiones funcionales pendientes del usuario.
