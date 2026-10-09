# Revisión independiente — PR #251 / T-313 — Ronda 15

**Fecha:** 2026-10-09
**SHA revisado:** `77d430b2d252e1fc814c924647ad9848206078a6`
**Base:** `develop` @ `24aad21f800f0d13fdeb082f9807b8eaf1f10fba`
**Resultado:** H10 cerrado/verificado; H04 parcial, con secuencia **D06-C autorizada**. Ningún hallazgo nuevo. **#251 sigue sin autorización de merge.**

## Cambios desde ronda 14

El delta `56b3c70..77d430b` modifica solo `docs/tasks/log/T-313.md`; el body GitHub de #251 también se corrigió: Vercel success, E2E GREEN, tres DoD marcados, casilla RED courier pendiente y acentos restaurados. No se tocó producción ni se debilitó ninguna aserción.

## Verificación independiente de H10

- Body actual menciona el CI funcional `37752334333`, Vercel success y trusted Preview `37803965180` del SHA funcional `56b3c70`.
- El informe de agy reconoce que falta el RED courier y no se atribuye la revisión independiente.
- La bitácora diferencia el SHA funcional del nuevo commit documental.
- CI del HEAD actual `37870792954`: unit, lint, typecheck, build, db-tests, audit y bundle-budget **GREEN**.
- Vercel y approval-policy del HEAD **GREEN**.
- Trusted Preview del HEAD `37870885019`, job `113628519512`: checkout explícito `77d430b2d252e1fc814c924647ad9848206078a6`; 52/52 Chromium + 3/3 global-settings GREEN; los tres casos T-313 PASS.
- P3: visto bueno confirmado por Lautaro073, sin fingir review de GitHub.

**H10: arreglado-verificado** en `77d430b2...`.

## Sincronización y alcance

La rama está 4 commits detrás de develop, entre ellos SEC-311, T-351, T-350 y T-339. Antes de un eventual merge, Kira debe integrar `origin/develop` con merge normal, volver a verificar el diff y ejecutar CI y trusted Preview del nuevo SHA.

La migración RLS y pgTAP de T-348 no pertenecen a esta PR.

## H04 — resultado y decisión D06-C

El baseline normal GREEN ya está demostrado. No hay todavía un RED discriminante del oráculo de courier; **no** convertir el RED anterior de la navegación en supuesto RED de autorización.

Lautaro073 eligió explícitamente **D06-C**:
1. Crear y revisar una PR de **catálogo** en P1, antes de mergear #251.
2. Mergear el catálogo en develop solo después de su revisión independiente y autorización.
3. Kira incorpora develop a #251 y revalida CI/E2E.
4. Lautaro073 autoriza explícitamente el merge de #251.
5. Recién **después** se ejecuta `e2e-mutation` sobre `target=develop` para comprobar control GREEN + mutante RED, evidencia `RED_CONFIRMED`, rollback del patch en el runner y artifact minimizado.

**PR de catálogo preparada:** [#315](https://github.com/cadeApp/cadeApp/pull/315), rama `test/T-347-t313-courier-guard-mutation`, commit `56feab2afa1db30e56d5e2e01e3a691d7c1e2034`. Incluye entrada de manifest, un patch que vuelve permisiva la guarda courier solo en checkout efímero, y bitácora T-347. Quedó **draft / sin merge**, pendiente de revisión independiente y checks. El spec de T-313 todavía no existe en develop: **prohibido despachar la mutación antes de mergear #251**.

Si el resultado postmerge es `MUTANT_SURVIVED`, `CONTROL_NOT_GREEN`, `UNEXPECTED_FAILURE` o `PATCH_DID_NOT_APPLY`, no modificar expectativas para fabricar `RED_CONFIRMED`; se informa el defecto y se abre corrección normal.

**H04: parcial / aceptación de diferimiento D06-C**, NO `arreglado-verificado`.

## Veredicto

H10 cerrado; funcionalmente T-313 sigue GREEN en su HEAD revisado. H04 queda diferido de manera explícita y controlada; #251 no debe mergearse hasta que se complete la fase de catálogo y el propietario lo autorice. No aprobé ni mergeé ninguna PR.
