# Evidencia y Comandos Reproducibles — PR #77 (T-121)

Todos los comandos fueron ejecutados en la sesión de revisión independiente sobre la rama `feat/T-121-courier-onboarding` en el commit `29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c` (base `develop` @ `b6b5f39`).

---

## 1. Verificación de sincronización con remoto y rama

```bash
git fetch origin
git rev-parse HEAD
# Salida: 29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c
git rev-parse origin/feat/T-121-courier-onboarding
# Salida: 29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c
gh pr view 77 --json headRefOid,commits
# Salida: headRefOid: 29f7a1deaf07afbcf81d4d8be94e0239a7a9bd1c (2 commits)
```

---

## 2. Inspección del diff y chequeo de alcance

```bash
git diff origin/develop...HEAD --stat
```
Salida:
```text
 docs/tasks/log/T-121.md                            |  21 ++
 src/features/courier-onboarding/actions.test.ts    | 235 +++++++++++++++++++++
 .../courier-onboarding/image-compression.test.ts   |  47 +++++
 .../courier-onboarding/upload-resilience.test.ts   |  59 ++++++
 4 files changed, 362 insertions(+)
```

Contraste con «Archivos permitidos» de `docs/tasks/T-121.md` (leída desde `origin/develop`):
- `src/features/courier-onboarding/**` → permitido
- `src/app/(courier)/onboarding/**` (visto bueno P2) → permitido (sin archivos en diff)
- `src/lib/image-compression.ts` (visto bueno P2) → permitido (sin archivos en diff)
- `docs/tasks/T-121.md` → permitido (sin modificaciones)
- `docs/tasks/log/T-121.md` → permitido
- `docs/revision-pr/**` → permitido

**Resultado de alcance:** 0 archivos fuera de alcance.

---

## 3. Estado de checks locales

### 3.1 Typecheck

```bash
pnpm typecheck
```
Salida:
```text
src/features/courier-onboarding/actions.test.ts(2,41): error TS2307: Cannot find module './actions' or its corresponding type declarations.
src/features/courier-onboarding/actions.test.ts(24,58): error TS2345: Argument of type 'Promise<SupabaseClient...>' is not assignable to parameter of type 'SupabaseClient...'.
src/features/courier-onboarding/actions.test.ts(51,58): error TS2345: Argument of type 'Promise<SupabaseClient...>' is not assignable to parameter of type 'SupabaseClient...'.
src/features/courier-onboarding/actions.test.ts(92,58): error TS2345: Argument of type 'Promise<SupabaseClient...>' is not assignable to parameter of type 'SupabaseClient...'.
src/features/courier-onboarding/actions.test.ts(159,58): error TS2345: Argument of type 'Promise<SupabaseClient...>' is not assignable to parameter of type 'SupabaseClient...'.
src/features/courier-onboarding/image-compression.test.ts(7,8): error TS2307: Cannot find module '@/lib/image-compression' or its corresponding type declarations.
src/features/courier-onboarding/upload-resilience.test.ts(6,8): error TS2307: Cannot find module './upload-manager' or its corresponding type declarations.
```
**Resultado:** ❌ 7 errores de compilación TypeScript.

### 3.2 Lint

```bash
pnpm lint
```
Salida:
```text
✔ No ESLint warnings or errors
```
**Resultado:** ✅ Limpio (código 0).

### 3.3 Tests unitarios

```bash
pnpm test --run
```
Salida (resumen de suite):
```text
FAIL src/features/courier-onboarding/actions.test.ts
FAIL src/features/courier-onboarding/image-compression.test.ts
FAIL src/features/courier-onboarding/upload-resilience.test.ts

Test Files  3 failed (de la feature T-121) | 31 passed
```
**Resultado:** ❌ 3 suites de la feature rotas por falta de implementación previa.

---

## 4. Demostración de mutación y controles ciegos

### 4.1 `mockInsertConsents` y `mockUpsertDocuments` nunca asertados (`PR77-H03`)

Inspección de `src/features/courier-onboarding/actions.test.ts:154-234`:
```ts
156:    const mockInsertConsents = vi.fn().mockResolvedValue({ error: null });
157:    const mockUpsertDocuments = vi.fn().mockResolvedValue({ error: null });
...
227:    expect(result.ok).toBe(true);
228:    if (result.ok) {
229:      expect(result.data.redirectTo).toBe('/onboarding/status');
230:    }
231:
232:    // Se actualizó dni_hmac y vehículo mediante admin client
233:    expect(mockUpdateCourier).toHaveBeenCalled();
```
**Demostración:**
Si una implementación de `courierOnboardingAction` ejecuta únicamente `mockUpdateCourier` y omite por completo interactuar con `consents` o `courier_documents`, este test pasa en verde. Las variables `mockInsertConsents` y `mockUpsertDocuments` están declaradas pero son huérfanas en el bloque de aserciones.

---

## 5. Validación de `analizar.mjs`

```bash
node docs/revision-pr/analizar.mjs verificacion
```
Verifica la sintaxis y schema de `hallazgos.jsonl`.
