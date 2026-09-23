# Revisión PR #61 — T-111 (`feat/T-111-merchant-onboarding`) · Ronda 2

- **Resultado:** **SIN BLOQUEANTES**
- **Rama / SHA revisado:** `feat/T-111-merchant-onboarding` @ `efd8d9f8db8337ea48fc97ed79cd2e12b73b4a96` (`efd8d9f`, fix principal en `c6aeb16`)
- **Ronda anterior:** [`ronda-1.md`](ronda-1.md) (`49642ed4e18a23909587545f04642149ad736f57`, 4 bloqueantes `H01`–`H04` + 5 mejoras `H05`–`H09`)
- **Alcance verificado contra `docs/tasks/T-111.md`:** 14 archivos de tarea + 5 archivos de `docs/revision-pr/pr-61/**` (**0 fuera de «Archivos permitidos»**, **0 modificaciones del autor sobre `docs/revision-pr/pr-61/**`**, respetando `AG-36`)
- **Checks ejecutados en worktree aislado (`../cadeApp-rev61`) + CI real (`run 35832549815`):**
  - `pnpm typecheck`: `0 errores` (exit 0)
  - `pnpm lint`: `✔ No ESLint warnings or errors` (exit 0)
  - `pnpm test`: `18 passed (18)` · `140 passed (140)` + `verify-workflows` (19/19) + `verify-adr` (6/6) (exit 0)
  - `db-tests` (log de CI job `107088290516`): `Result: PASS`
  - `bundle-budget` (log de CI job `107088611950`): `/onboarding` `124 kB` (presupuesto `180 kB`)
  - Cobertura `src/features/merchants` (log de CI job `107088290304`): `actions.ts` **89.36 % líneas**, `queries.ts` **100 %**, `schemas.ts` **100 %**
  - `npx prettier --check`: `All matched files use Prettier code style!`

---

## Verificación de hallazgos de Ronda 1 (`H01`–`H09`)

| ID        | Sev.     | Estado en Ronda 2         | Verificación en `efd8d9f8db8337ea48fc97ed79cd2e12b73b4a96`                                                                                                                                                                                                                                                                          |
| --------- | -------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`H01`** | 🟡 medio | ✅ `arreglado-verificado` | `src/features/merchants/server.ts:1` comienza con `import 'server-only';`.                                                                                                                                                                                                                                                          |
| **`H02`** | 🟡 medio | ✅ `arreglado-verificado` | `src/features/merchants/actions.ts:16` usa `const supabase = await createClient();` sin `AppSupabaseClient` ni `as unknown as`; los payloads en líneas 76, 89 y 104 están tipados explícitamente con `TablesInsert<'consents'>`, `TablesUpdate<'profiles'>` y `TablesInsert<'merchants'>`.                                          |
| **`H03`** | 🟡 medio | ✅ `arreglado-verificado` | `src/features/merchants/components/onboarding-form.tsx:25-43` usa `useForm<MerchantOnboardingInput>({ resolver: zodResolver(merchantOnboardingSchema), ... })` provisto por `src/features/merchants/components/form-hooks.ts` (sin tocar `package.json`, fuera de alcance de T-111), con errores inline por campo e `isSubmitting`. |
| **`H04`** | 🟠 alto  | ✅ `arreglado-verificado` | `src/features/merchants/actions.ts:50-73` valida `settingData.value` y retorna `err('INTERNAL_ERROR')` si `platform_settings` devuelve `null`, `error` o string vacío (`grep "'1.0'"` vacío). Cubierto por el nuevo test en `src/features/merchants/actions.test.ts:277-332`.                                                       |
| `H05`     | 🔵 bajo  | ✅ `arreglado-verificado` | Los 5 textos en español (`locating`, `geoNotSupported`, `geoErrorFallback`, `locationMarked`, `acceptTermsPrefix`) fueron movidos a `merchantCopy.onboarding` en `src/features/merchants/copy.ts:20-35`.                                                                                                                            |
| `H06`     | 🔵 bajo  | ✅ `arreglado-verificado` | `src/features/merchants/components/onboarding-form.tsx:316-326` envuelve el checkbox `#pilotTerms` en un `<label className="flex min-h-12 min-w-12 ...">` (`48×48 px`).                                                                                                                                                             |
| `H07`     | 🔵 bajo  | ✅ `arreglado-verificado` | `src/features/merchants/components/onboarding-form.tsx:298` reemplazó `min-h-[80px]` por `min-h-20`.                                                                                                                                                                                                                                |
| `H08`     | 🔵 bajo  | ✅ `arreglado-verificado` | `src/features/merchants/actions.ts:76-80` omite `accepted_at` del payload de `consents` para delegar el timestamp al `DEFAULT now()` de Postgres.                                                                                                                                                                                   |
| `H09`     | 🔵 bajo  | ✅ `arreglado-verificado` | `npx prettier --check` pasa limpio en todos los archivos del PR (`docs/tasks/log/T-111.md` incluido).                                                                                                                                                                                                                               |

---

## BLOQUEANTES

Ninguno.

---

## MEJORAS (no bloqueantes)

1. **[`src/server/supabase/server.ts:15` — seguimiento para tarea de base / `contract-change`]** `@supabase/ssr@0.5.2` invoca `SupabaseClient<Database, SchemaName>` con 2 genéricos frente a `@supabase/supabase-js@2.116.0` (que espera `ClientOptions` en el 2.º genérico cuando `Database` incluye `__InternalSupabase`), haciendo que `.insert()` / `.update()` / `.upsert()` infieran parámetro `never` y obligando a pasar `payload as never` luego de tipar la variable con `TablesInsert` / `TablesUpdate`. Ajustar el tipo de retorno en `src/server/supabase/server.ts` eliminará la necesidad de `as never` en todas las features.
2. **[`src/features/merchants/components/form-hooks.ts:106-112`]** En `setValue`, mover `setErrors(res.errors)` fuera del actualizador puro de `setValues` y validar solo el campo afectado cuando `options?.shouldValidate` es `true`, para que pulsar «Usar mi ubicación actual» antes de completar el resto del formulario no dispare los mensajes de error de los demás campos vacíos.
