# Comandos y evidencia reproducible — PR #254

**SHA revisado:** `32477a05841ca669ac9ac7a36f929f2261e4c926`

## Estado de rama y alcance

Resultado observado mediante GitHub:

```text
develop...32477a05841ca669ac9ac7a36f929f2261e4c926: ahead 2, behind 0
archivos: docs/tasks/log/T-302.md
          e2e/specs/courier-onboarding.spec.ts
```

## H01 · La prueba de DNI está desconectada de la action

```bash
grep -nE 'courierOnboardingAction|courier2Client|duplicateDbErr|isDuplicate' e2e/specs/courier-onboarding.spec.ts
```

Hallado en el SHA revisado: la action solo está importada/comentada; el bloque DoD usa un update directo de `dni_hmac` y un boolean `isDuplicate` local.

**Mutación RED que debe demostrar el arreglo:** temporalmente neutralizar en `src/features/courier-onboarding/actions.ts` la rama que devuelve `DNI_ALREADY_REGISTERED` para un `profile_id` distinto. El E2E corregido debe fallar porque no aparece el alert y/o avanza indebidamente. Revertir la mutación en memoria antes del commit.

## H02 · Escapes condicionales

```bash
grep -nE 'if \(await .*isVisible|if \(await submitBtn|page\.goto\(.*/courier/onboarding/(vehicle|status)|adminClient\.rpc' e2e/specs/courier-onboarding.spec.ts
```

El SHA revisado contiene condicionales alrededor de pasos obligatorios y `page.goto('/courier/onboarding/status')` como escape.

**Mutación RED que debe demostrar el arreglo:** hacer que un control obligatorio (por ejemplo `btnSubmitForReview`) no esté disponible. El test corregido debe fallar en `toBeVisible/toBeEnabled`; jamás caer en una rama vacía o navegación manual.

## H03 · Precondición incorrecta del courier

```bash
sed -n '430,470p' src/server/e2e/staging-seed.ts
```

El fixture general crea `status: 'approved'`, `available: true`, `vehicle_type: 'moto'`.

**Mutación RED que debe demostrar el arreglo:** omitir temporalmente la persistencia de `vehicle_type` en `courierOnboardingAction`. El flujo corregido debe fallar al intentar alcanzar/mostrar el estado de onboarding enviado o al verificar la fila final.

## H04 · MFA en sesión distinta

```bash
grep -nE 'createAuthenticatedClient\(admin\)|elevateAdminToAal2|/login/mfa|adminClient\.rpc' e2e/specs/courier-onboarding.spec.ts
```

El browser queda en MFA, pero la elevación se hace sobre otro cliente y el fallback RPC ejecuta la aprobación.

**Patrón exacto para el arreglo dentro del spec:**

```text
1. Crear el admin efímero.
2. Con un cliente Node AAL1, enrollar un factor TOTP y conservar `enrolled.totp.secret`.
3. Verificar ese factor una vez para que quede activo en la cuenta.
4. Iniciar sesión por la UI; al llegar a /login/mfa, generar `generateTotp(secret)`.
5. Rellenar `#totp-code`, pulsar el botón `ADMIN_COPY.mfa.verifyButton` y esperar `/admin/applicants`.
6. Abrir el postulante y aprobar solo mediante botón + modal UI.
```

**Mutación RED que debe demostrar el arreglo:** omitir el paso 4/5 (mantener el browser en AAL1). El E2E corregido debe fallar antes de poder aprobar.

## Limitación de ejecución de esta ronda

No se dispararon workflows ni se desplegaron mutaciones deliberadamente rotas. El entorno de esta revisión no pudo materializar el repositorio para ejecutar Playwright localmente contra el Preview; por eso las mutaciones anteriores son requisitos de verificación de la corrección y los hallazgos se registran como `[ANÁLISIS]`, no como verificados.

## Batería final exigida al autor después del arreglo

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test e2e/specs/courier-onboarding.spec.ts --project=chromium --workers=1
git diff --check
git status --short
```

Además, registrar en `docs/tasks/log/T-302.md` la mutación concreta, el comando y las líneas de resumen RED y verde. No crear ni adulterar tests para obtener verde.

---

# Ronda 2 — SHA `13caf3f68c5c28613487290a0797852c8a161b7c`

## Verificación estática de H01–H04

```bash
grep -nE 'if \(await .*isVisible|if \(await .*isEnabled|page\.goto\(.*/courier/onboarding/status|adminClient\.rpc\(.admin_decide_courier' e2e/specs/courier-onboarding.spec.ts
```

En el SHA R2 no aparecen los escapes originales.

```bash
grep -nE 'resetCourierToPendingOnboarding|enrollAdminTotpFactor|#totp-code|decision-reason|DNI_HMAC_SECRET' e2e/specs/courier-onboarding.spec.ts
```

Resultado relevante observado:
- helper de reset: línea 37;
- helper TOTP: línea 63;
- fallback de secreto HMAC: líneas 214 y 456;
- flujo browser MFA/aprobación presente en la sección final.

## H05 · E2E no ejecutado post-arreglo

La sesión de bitácora R2 enumera:

```text
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test --list
```

No registra:

```bash
pnpm exec playwright test e2e/specs/courier-onboarding.spec.ts --project=chromium --workers=1
```

Tampoco registra las cuatro mutaciones RED solicitadas en R1.

## H06 · Paridad del secreto DNI

```bash
grep -n "DNI_HMAC_SECRET" e2e/specs/courier-onboarding.spec.ts src/server/env.ts src/features/courier-onboarding/actions.ts
```

El spec usa fallback; `server/env.ts` declara el secreto obligatorio y la action usa el valor de servidor.

## CI observado en R2

```text
branch: ahead 6 / behind 0
Vercel: success
CI typecheck: success
CI unit: success
CI db-tests: success
CI build: success
CI lint: cancelled
CI audit: cancelled
CI bundle-budget: queued (al momento de revisar)
approval-policy: failure — El PR requiere aprobación vigente de Lautaro073.
e2e-preview: repository_dispatch en cola/pendiente; sin status publicado para el SHA
```

La aprobación de Lautaro no se pide hasta que esta revisión quede sin bloqueantes.