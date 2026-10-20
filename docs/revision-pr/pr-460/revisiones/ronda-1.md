# Informe de revisión — PR #460 / T-383 — Ronda 1

**Fecha:** 2026-10-20 · **Head de código revisado:** `73c26dd0d199af1377f0777b8823a6ae8618b512` · **Base:** `develop@cf2fbe13ab7ee8348b4805dadccef5416abb9265` · **Autor:** @Lautaro073.

**Resultado: SIN BLOQUEANTES (0) · decisiones abiertas: 0.** La revisión certifica ausencia de hallazgos por **inspección**, no sustituye el gate oficial E2E final. No se aprobó ni mergeó.

## Alcance y precedencias

Se leyeron primero `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md` y la ficha `docs/tasks/T-383.md` **desde develop**; luego contrato `docs/contracts/CC-035.md`, wrapper, código, pruebas y bitácora de la PR. El contraste de GitHub `develop...73c26dd0` arroja **ahead 2 / behind 0** y estos seis archivos, todos permitidos: `src/app/api/push/subscriptions/route.ts`, `route.test.ts`, `e2e/specs/push-user-activation.spec.ts`, `docs/tasks/T-383.md`, `docs/tasks/log/T-383.md`, `docs/implementation-plan.md`. La ficha solo actualiza el estado real de T-386, sin ampliar alcance.

T-386/PR #457 fue mergeada (merge `fee28dbd`). `migrate-develop` [run 39400955715](https://github.com/cadeApp/cadeApp/actions/runs/39400955715), correspondiente a ese merge, concluyó **success**. El árbol de la PR todavía no contiene `docs/revision-pr/pr-460/` antes de esta ronda.

No fue posible ejecutar `git merge-tree` local al no haber clon; GitHub indicó `mergeable=true` y `behind_by=0` en la comparación del SHA.

## Contratos y código — inspección

- `POST` conserva autenticación, validación Zod y el cliente de sesión; reemplaza `upsert` directo por `registerPushSubscriptionRpc(supabase, parsed.data)`. El `DELETE` queda intacto.
- `registerErrorResponse` diferencia `UNAUTHENTICATED` 401, `VALIDATION_ERROR` 400, `UNAUTHORIZED_ACTOR` 403 e `INTERNAL_ERROR` 500. El wrapper de CC-035 convierte `42501`/ `28000` a `UNAUTHORIZED_ACTOR`, y valida entrada/salida contra contrato estricto.
- Éxito solo `{ ok: true }`; no se devuelve `subscriptionId`, `reassigned`, dueño anterior ni material criptográfico. La ruta no invoca `console.*`.
- Las 18 pruebas de ruta exigen el nombre y payload de la RPC, ausencia de `.from` en POST, errores, `platform: null`, salida estricta y silencio de logs. No se observaron `.only`, `.skip` ni manipulaciones de tests para forzar verde.
- El E2E usa dos usuarios temporales y el **mismo contexto** con `clearCookies()` (no logout), comprueba POST 200 con cuenta B y lee la fila desde clientes autenticados de A y B sujetos a RLS. No falsea el backend. Se simulan la suscripción del navegador y el valor `Notification.permission` de Chromium headless; se corrigió esa precisión editorial en el cuerpo de la PR.
- `cleanupStagingData` elimina los perfiles efímeros; el esquema tiene `push_subscriptions.user_id REFERENCES profiles(id) ON DELETE CASCADE`. No se infirió acumulación permanente de endpoints del E2E.

## Evidencia y límites

| Control | Evidencia | Alcance real |
|---|---|---|
| RED unitario base | Bitácora: `cf2fbe13`, 9 fallidos/9 pasados | Declarado por autor; **no reproducido** independientemente |
| GREEN unitario de ruta | Bitácora: 18/18 | Autor + suite `unit` completa en CI oficial |
| Mutaciones del autor | 403, sobreexposición y logging; RED/GREEN documentados | No ejecutadas por revisor |
| E2E RED → GREEN | Bitácora: develop 500 → Preview `8cda7e4c` 2 passed | **Playwright local ejecutado por autor**, no equivale aún a `e2e-preview` oficial |
| CI del SHA funcional | [run 39465072183](https://github.com/cadeApp/cadeApp/actions/runs/39465072183): `unit` 152 archivos/3000 tests, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` ✅ | Logs oficiales inspeccionados; `db-tests` seguía en ejecución al redactar |
| Sondas independientes | S1/S2/S3 baseline PASS y mutante DETECTED | **Inspección estática en memoria**, sin ejecución de Vitest/Playwright; harness íntegro en `evidencia/comandos.md` |

El `approval-policy` estaba en rojo por falta de informe independiente, no por un fallo del test. `e2e-preview` se cancela durante rondas por decisión de Lautaro073 y se exige en el último push funcional una vez cerrados bloqueantes. **No pedir una repetición de CI/E2E solo por el commit documental de esta revisión.**

## BLOQUEANTES
Ninguno detectado.

## MEJORAS
No queda ninguna necesaria para otra ronda. Se corrigieron **solo en el cuerpo de la PR**, sin tocar código, dos afirmaciones desactualizadas: la simulación de `Notification.permission` y el procedimiento E2E local durante rondas.

## NO TOCAR — falsos positivos descartados
- No pedir service role en la ruta: la RPC de CC-035 se ejecuta con cliente de sesión; la reasignación y sus riesgos están aprobados en el contrato.
- No pedir que el E2E cubra el servicio push real del navegador: Chromium headless carece del servicio; el objetivo es verificar ruta+RPC+RLS reales frente al mismo endpoint.
- No pedir cambio del logout de todos los dispositivos, mensajes UI T-382 o cambios en SQL/RLS: están fuera de alcance.
- No acusar fuga de endpoints por no ver `DELETE` explícito en el E2E sin considerar el `ON DELETE CASCADE`.

## Cierre
**Sin decisiones nuevas**. Queda como **condición de merge** el gate `e2e-preview` oficial en verde sobre el SHA funcional final, más checks requeridos de GitHub. El GREEN local de la bitácora no se presenta como gate oficial. La PR está en **Draft**: Lautaro073 decide cuándo marcarla ready y mergear. La revisión no aprobó ni mergeó.

Método: lectura de fuentes en GitHub, logs del CI y sondas estáticas independientes contra los contenidos exactos de `73c26dd0`. Sin clon: no se ejecutaron comandos locales `pnpm`, no se leyó ningún `.env` y no se hicieron llamadas a Supabase/Vercel.
