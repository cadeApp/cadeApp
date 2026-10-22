# Informe de revisión — PR #98 / T-311 — Ronda 4

**SHA revisado:** `cccb88c460a858d85d15b77e6df5d19a20596aea`  
**Base:** `develop@ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`  
**Resultado:** **CON BLOQUEANTES**

La rama está 0 commits detrás de `develop`, PR mergeable y AGY no modificó `docs/revision-pr/pr-98/**` después de la Ronda 3.

## H06 — CERRADO

CC-007 ya está mergeado y T-311 usa la frontera correcta:

```ts
adminClient.rpc('activate_account_consents', {
  p_user_id: data.user.id,
  p_tos_version: parsed.data.acceptedTermsVersion,
  p_privacy_version: parsed.data.acceptedPrivacyVersion,
});
```

Si la activación falla:
- `registerAction` retorna `INTERNAL_ERROR`;
- `deleteUser` queda solo como cleanup best-effort;
- el invariante ya no depende de esa compensación;
- el perfil permanece `pending` y CC-007 lo bloquea en guards/RLS/RPC.

Los tests cubren RPC fallida y cleanup que devuelve error o rechaza.

## H12 — CERRADO

`src/features/legal/legal-red.test.ts`:
- no usa `as any` ni `: any`;
- ejecuta `registerSchema`;
- ejecuta `merchantOnboardingSchema`;
- ejecuta `courierOnboardingSchema`;
- ejecuta `createDeliveryRequestSchema`;
- cubre opcionales, requeridos y condicionales.

El control textual del copy queda como complemento, no como única fuente de verdad.

---

## H13 · 🔴 Onboarding courier falla por duplicado de consentimientos

`public.consents` tiene:

```sql
primary key (profile_id, document, version)
```

CC-007 hace que el registro persista TOS + Privacy mediante `activate_account_consents` antes de dejar la cuenta `active`.

Pero `courierOnboardingAction` vuelve a hacer un plain INSERT de:

```text
(user, tos, 1.0)
(user, privacy, 1.0)
(user, courier_contract, 1.0)
```

Para un courier recién registrado, las dos primeras PK ya existen. El bulk INSERT real falla por unique violation y la action retorna `INTERNAL_ERROR`; `courier_contract` tampoco llega a persistirse.

El test feliz no lo detecta porque el mock de insert siempre devuelve `error:null` y afirma ese payload duplicado.

### Reintentos también quedan rotos

Merchant y courier insertan consentimientos antes de completar los pasos siguientes. Si el consentimiento se escribió pero un paso posterior falla, el reintento con la misma versión vuelve a chocar con la PK.

### Arreglo esperado

Hacer los writes idempotentes sin reescribir `accepted_at` histórico.

Recomendado:

```ts
.upsert(payload, {
  onConflict: 'profile_id,document,version',
  ignoreDuplicates: true,
})
```

para los consentimientos de onboarding/piloto, conservando los guards de versión.

Tests mínimos:
- courier posterior a registro no falla aunque TOS/Privacy ya existan;
- reintento merchant después de fallo posterior puede continuar;
- reintento courier después de fallo posterior puede continuar;
- mutar el write idempotente de vuelta a `insert` debe volver rojo.

---

## H08 · 🔴 Capturas y “axe AA” siguen sin evidencia reproducible

La ficha marca `[x]` navegador 390/360 + capturas + axe AA y la bitácora dice que existen `evidence/legal_*.png` y `evidence/register_*.png`.

En el SHA revisado:
- no existe directorio `evidence/`;
- no existen esas PNG;
- no hay salida JSON/TXT de axe asociada al SHA;
- `package.json` no contiene `axe-core` ni `@axe-core/*`;
- `components-a11y.test.tsx` usa `auditDomAccessibilityStructure`, un checker interno, no axe;
- no hay evidencia de axe sobre merchant/courier onboarding.

El proyecto Vercel conectado tampoco tiene un preview desplegado de esta rama que permita al revisor reproducir la evidencia externamente.

### Arreglo esperado

Ejecutar navegador real y conservar artefactos asociados al commit:

- 390×844: `/legal` + documento largo;
- 360×800: `/legal` + documento largo;
- mantener login/register si se declaran en el body;
- axe real WCAG AA en legal + auth + merchant onboarding + courier onboarding.

No usar `docs/revision-pr/**`. Puede guardarse evidencia dentro de un path ya permitido, por ejemplo:

```text
src/features/legal/evidence/T-311/
```

con PNG y salida de axe, referenciados desde bitácora/body.

`auditDomAccessibilityStructure` puede quedar como cobertura complementaria, pero no debe presentarse como axe.

---

## H09 · 🟠 Estado documental sobredeclara el cierre

La bitácora post-CC-007 está actualizada, pero dice “H08 cerrado” basándose en artefactos que no están en la PR.

El body abre con “resuelve todos los hallazgos H01–H12” y marca todo el DoD aunque H08 no está demostrado y H13 acaba de aparecer.

H09 queda abierto hasta cerrar H08/H13 y sincronizar ficha, bitácora y body.

## CI final

No se inspecciona CI final mientras H08/H13 estén abiertos, conforme al protocolo.

## Prompt AGY

1. `git pull` en `feat/T-311-legal-consents`.
2. No toques `docs/revision-pr/**`.
3. **H13:** hacé idempotentes las escrituras de consentimientos de merchant/courier sin reescribir `accepted_at`. Preferí `upsert(..., { onConflict: 'profile_id,document,version', ignoreDuplicates: true })` o equivalente.
4. En courier, contemplá expresamente que TOS/Privacy ya existen desde `activate_account_consents`; el onboarding normal no puede fallar por esas PK.
5. Agregá tests de camino normal post-registro + reintento tras fallo parcial para merchant y courier. Demostrá rojo si el write vuelve a `insert`.
6. **H08:** repetí navegador real 390×844 y 360×800. Guardá PNG reproducibles de `/legal` + documento largo. Ejecutá axe real WCAG AA en legal, login/register, merchant onboarding y courier onboarding.
7. Guardá evidencia fuera de `docs/revision-pr/**`, por ejemplo `src/features/legal/evidence/T-311/**`, y referenciala desde bitácora/body.
8. No presentes `auditDomAccessibilityStructure` como axe.
9. **H09:** solo cuando H08/H13 estén cerrados, sincronizá `docs/tasks/T-311.md`, bitácora y body.
10. Corré tests dirigidos + `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
11. Push normal y pasá SHA remoto. No hagas merge.

Después pedí Ronda 5.
