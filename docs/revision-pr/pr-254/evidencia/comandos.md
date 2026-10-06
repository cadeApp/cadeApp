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

---

# Ronda 3 — SHA `8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a`

## Sincronización

Resultado de comparar contra `develop` vigente:

```text
develop @ 6e2da8fb02d4797b9add222206342e6055f1d81c
head    @ 8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a
ahead 8 / behind 48
mergeable: true
```

Entre los 48 commits nuevos hay cambios E2E; por procedimiento la rama debe mergear `origin/develop` antes de la próxima ronda.

## Autor no tocó la carpeta de revisión

Comparación desde el commit de revisión R2 `7a21a751...` hasta el head R3: un solo commit del autor, modificando únicamente:

```text
docs/tasks/log/T-302.md
e2e/specs/courier-onboarding.spec.ts
```

## H06 · secreto HMAC

Barrido del SHA R3:

```text
99: function requireDniHmacSecret(): string {
100:   const secret = process.env.DNI_HMAC_SECRET;
101:   if (!secret) throw ...
225: const hmacSecret = requireDniHmacSecret();
467: const hmacSecret = requireDniHmacSecret();
```

No queda el literal de fallback. H06 verificado por inspección exacta.

## R01 · clase completa de selectores amplios

Barrido de `courier-onboarding.spec.ts`:

```text
296: const alert = page.getByRole('alert');
402: const motoRadio = page.getByText(COURIER_ONBOARDING_COPY.transportMoto, { exact: false });
540: const alert = page.getByRole('alert');
```

No hay otra ocurrencia de `getByRole('alert')` ni selector de transporte por texto en el spec.

## e2e-preview exacto del SHA

Run: `37542083437`, job `112537293795`. El checkout confirma HEAD `8a39cab`. Supabase Develop y health check pasan; falla el paso `Run preview E2E gate`.

Resumen T-302 del log:

```text
✓ DoD MFA
✘ DoD DNI duplicado (3 intentos)
✘ Flujo 1 onboarding (3 intentos)
✘ Flujo 2 DNI duplicado (3 intentos)
✓ Flujo 3 admin MFA/UI
```

Errores reproducidos:

```text
DoD DNI / Flujo 2:
strict mode violation: getByRole('alert') resolved to 2 elements
1) alert productivo con 'Ese DNI ya está registrado...'
2) div#__next-route-announcer__[role=alert]

Flujo 1:
strict mode violation: getByText('Moto') resolved to 2 elements

Resultado del gate:
3 failed
```

Esto separa el comportamiento productivo del defecto de test: el alert correcto sí existe; el locator no es único.

## H05 · contraste con la bitácora del autor

La entrada 2026-10-06 19:35 declara primero que el host local se corta por:

```text
[E2E Fail-Closed] Proyecto Supabase 'desconocido' no está positivamente identificado como staging
```

Por lo tanto, un intento local de H01/H02 no puede contarse como RED de la aserción si no muestra que llegó después del seed/fixture. La entrada no copia línea de fallo para H01 ni H02. H03 sí aporta un RED de `actions.test.ts`, que es evidencia complementaria, no la mutación E2E pedida. H04 describe timeout pero no deja una salida completa reproducible.

El runner remoto sí ejecutó el spec real, pero quedó rojo por R01. H05 queda parcial hasta tener Preview GREEN en una rama actualizada y una aclaración append-only de qué evidencia local fue o no reproducible.

## Comandos para la siguiente ronda

```bash
git fetch origin
git merge --no-edit origin/develop
pnpm typecheck
pnpm lint
pnpm test
pnpm exec playwright test --list
git diff --check
git status --short
```

El E2E completo se valida con el `e2e-preview` automático del Preview; no disparar workflows manualmente.