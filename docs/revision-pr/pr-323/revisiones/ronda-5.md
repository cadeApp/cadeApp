# PR #323 — T-352 — Ronda 5 independiente, cierre de H01

**Fecha:** 2026-10-13. **HEAD examinado:** `1d6113cc0768c7df42f3957ef0816f1f92bff48a`. **SHA funcional con E2E real:** `f11cfd881588469f3b9b315a2f0d7dac9559faa9`. **Base Develop:** `eab51d30fff277f9cbce06e645fb95006b327cf8` (merge de PR #320).

## Resultado: SIN BLOQUEANTES

### H01 — ARREGLADO Y VERIFICADO

[Run trusted 38365704738](https://github.com/cadeApp/cadeApp/actions/runs/38365704738), job E2E `115190265018`, **SUCCESS**. El job resolver `115190198651` identificó PR #323; el checkout real del job E2E fue `git checkout --progress --force f11cfd881588469f3b9b315a2f0d7dac9559faa9`. El evento `repository_dispatch` tiene como `head_sha` el SHA de Develop, **no** el SHA probado; no confundirlos.

- Proyecto Chromium: **72/72 PASS en 13,6 min, sin failures, flaky ni retries**.
- Proyecto `global-settings`: **3/3 PASS en 49s**, incluido `subscription.global-settings.spec.ts:159` **DoD 2 PASS 16,9s**.
- `t340-legacy-checkpoint.spec.ts:29` **PASS 17,7s**, con `waitForURL` de 10 segundos intacto. Pasaron `main-flow:187`, `:249`, `fixed-price:72/:177/:277` y los ocho casos que fallaron previamente en la PR temporal #324.
- Commit status de `f11cfd8`: **`e2e-preview=success`**, Preview Vercel `dpl_TDXkRKgwsY4syMdHgKqUMuZm4uYC`. CI técnica del mismo SHA: unit, db-tests, lint, typecheck, build, audit y bundle-budget PASS.
- Tras ese SHA, compare GitHub `f11cfd8...1d6113c` arroja **solo `docs/tasks/log/T-352.md` (+35 líneas de registro)**. Por tanto la implementación y los tests cubiertos no variaron. El HEAD de documentación actual dispara CI y eventualmente E2E nuevos: se deberán verificar sus checks antes del merge sin declarar que han terminado anticipadamente.

### H02 — ARREGLADO Y VERIFICADO (se conserva conclusión de R4)

En tres traces previas reales de Playwright del checkpoint #324: POST action 1740/1823/1943 ms, **0 GET** a `/merchant/requests` (alias 307) tras publicar y un GET a `/merchant/dashboard` (717/919/486 ms). El cambio elimina efectivamente el salto en esas trazas. Los números baseline provienen de **otro spec** en un contexto de carga distinto; no está demostrada una mejora causal del tiempo completo ni un ahorro exacto por request para cualquier carga. No se inventan traces del run verde #323: `trace: on-first-retry`, sin retries, no generó nuevos.

**Atribución correcta:** DoD 2 también pasó en el run verde propio de PR #320 **sin T-352** (38361113528, 21,4s). El GREEN de DoD 2 de esta PR confirma compatibilidad, no prueba que T-352 fuera la causa necesaria de pasar.

### Revisión de alcance y seguridad

Diff actual frente a `develop`: **dos archivos de código** `src/features/requests/actions.ts` y `actions.test.ts`, más bitácora y carpeta `docs/revision-pr/pr-323/**`; todo permitido por T-352. `actions.ts:162` solo cambia el destino exitoso a `/merchant/dashboard`. `actions.test.ts:283` y `:520` verifican ambos éxitos y conservan aserciones RPC/error. `create-request-form.tsx:217` consume el `redirectTo` sin cambios; alias `merchant/requests/page.tsx:4` mantiene el redirect a dashboard. No se tocaron middleware, auth, permisos, RLS, migraciones, dependencias, workflow, timeout ni E2E en esta PR. El merge de Develop incorporó ambos seeds de #320: `materializeFixtureDrop` antes de `finalizeSeededRequestState`, en ambas rutas.

### Checks, limitaciones y decisión

- Revisor inspeccionó código, diff, commits, bitácora y **logs reales** de GitHub Actions; no corrió Vitest, Playwright, Supabase ni Docker local, y no escribió SQL remoto.
- El RED de referencia unitario (2 tests de destino contra literal anterior) consta en bitácora del autor y se corroboró que ambas expectativas reales siguen activas; el revisor no repitió una mutación local por falta de clon.
- **H01 cerrado** sobre SHA `f11cfd8`, **H02 ya cerrado** por R4. No hay hallazgos funcionales adicionales ni decisiones de alcance pendientes.
- `approval-policy` anterior está rojo porque el cuerpo aún decía «CON BLOQUEANTES»; al publicar el informe **SIN BLOQUEANTES** corresponde verificar el nuevo job. Los demás checks del nuevo HEAD documental deben estar verdes antes de mergear.
- **Lautaro073 decide Ready for review y merge**; esta revisión no aprueba ni mergea. Paso 3/4 de T-340 continúa bajo los checkpoints posteriores obligatorios de esa ficha, que no quedan liberados solo por T-352.

**Dictamen:** SIN BLOQUEANTES, sujeto al gate normal de checks del último HEAD para merge.
