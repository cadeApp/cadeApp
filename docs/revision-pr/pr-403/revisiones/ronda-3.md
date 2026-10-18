# Revisión independiente — PR #403 / T-367 — Ronda 3

**Fecha:** 2026-10-17 (Argentina)  
**HEAD de código revisado:** `aa7903bc35bec39a9b711194a29670a5b7ea2c68`  
**Rama:** `feat/T-367-avatar-perfil` → `develop`  
**Resultado:** **CON BLOQUEANTES (1: PR403-H08)**. E2E Preview del SHA examinado sin resultado verde al cerrar la inspección.

## Resumen de cambios desde R2

- Los commits posteriores al informe independiente `6ddd1831` cambian **solo** `e2e/specs/courier-onboarding.spec.ts` y `docs/tasks/log/T-367.md`. No se tocaron implementaciones de producto ni `docs/revision-pr/**` desde R2 por parte de agy.
- **H07 corregido por inspección:** `courier1` es requisito obligatorio, `browser.newContext({baseURL: new URL(page.url()).origin})` aísla la segunda sesión (E2E:1570-1581), y se eliminó el segundo login sobre `page` del primer courier. El resto del test mantiene el contexto original de courier 0. Pendiente del resultado real del E2E remoto antes de asignar `arreglado-verificado`.
- **H05 atendido documentalmente:** `docs/tasks/log/T-367.md:112-153` incluye el caso concreto de la mutación del render `<Image>`: RED por ausencia de foto accesible (1 failed, 100 skipped), restauración GREEN (11 passed, 241 skipped), suites focalizadas 140 pruebas y fichas 7. Esa es **evidencia declarada por el autor**, no una mutación ejecutada por esta revisión; no se falsifica su verificación.
- Los arreglos **H01**, **H03**, **H06** permanecen como se analizaron en R2. **H04** (autorrevisión) se mantiene separado y preservado.

## PR403-H08 — BLOQUEANTE (medio) — El E2E puede confundir ícono de navegación con fallback del avatar

**Fuentes exactas:**  
`e2e/specs/courier-onboarding.spec.ts:1577-1578,1592-1593,1605-1606`  
`src/app/(courier)/courier-nav.tsx:17-35`  
`src/ui/bottom-nav.tsx`  
`src/features/courier-onboarding/components/courier-profile-view.tsx:307-323`  

**Estado: [ANÁLISIS DE CÓDIGO CRUZADO], no RED ejecutado.**

En tres escenarios la E2E hace:
```ts
await expect(page.locator('svg.lucide-user').first()).toBeVisible();
```
o la misma expectativa con `otherPage`. Este selector es **global**, no apunta al avatar de la tarjeta de identidad.

La ruta `/courier/profile` siempre renderiza `CourierNav` (`src/app/(courier)/layout.tsx`) y esa navegación contiene su propio `<User />` para el enlace *Perfil*. `BottomNav` lo renderiza visible. Por lo tanto, si se elimina por completo el `<User />` de fallback del perfil, todavía queda el SVG `.lucide-user` de la barra y `.first()` puede hacer que la prueba siga en verde. En la falla de Storage solo se comprueba ese SVG y ni siquiera se afirma que `img` haya desaparecido. Este control **no demuestra el DoD** de placeholder correcto ante error, ausencia o rechazo; es P08, no un defecto de seguridad ya reproducido en producción.

Además, el placeholder del avatar en `courier-profile-view.tsx:321` está marcado `aria-hidden="true"`, por lo que no tiene un nombre accesible propio. La ficha exige fallback seguro/accesible.

### Arreglo exacto sin dependencia ni infraestructura

1. En `src/features/courier-onboarding/components/courier-profile-view.tsx`, **solo en el ícono de fallback de la tarjeta de identidad**, reemplazar:
```tsx
<User className="h-7 w-7" aria-hidden="true" />
```
por:
```tsx
<User className="h-7 w-7" role="img" aria-label="Avatar de perfil no disponible" />
```
No modificar el `User` del menú de navegación ni el estado sin legajo. La etiqueta describe el placeholder; no presenta selfie ni documento de identidad.

2. En `e2e/specs/courier-onboarding.spec.ts`, reemplazar **las tres** aserciones globales `svg.lucide-user` por `getByRole('img', { name: 'Avatar de perfil no disponible' })` en las páginas respectivas. Para el caso de archivo inexistente, sumar `await expect(page.getByRole('img', {name:/^Foto de perfil de /})).toHaveCount(0)` y luego la prueba del placeholder. Evitar selectores CSS genéricos; el nombre accesible hace fallar si falta el fallback real.

3. En `src/features/courier-onboarding/components.test.tsx`, reforzar los casos de avatar ausente y `onError` con `screen.getByRole('img',{name:'Avatar de perfil no disponible'})`. Mantener caso positivo de `<Image>`. Las pruebas de `queryByRole('img', {name:/foto de perfil/i})` siguen válidas porque el placeholder tendrá nombre distinto.

4. **Demostrar RED→GREEN honestamente:** ejecutar primero el nuevo unit test GREEN; mutar temporalmente **solo el placeholder** quitando `role="img" aria-label="Avatar de perfil no disponible"`, correr el mismo test y exigir fallo concreto de `getByRole('img')`, restaurar en memoria en `finally`, ejecutar GREEN nuevamente y comprobar árbol limpio. No pushear la mutación, no cambiar expectativas ni fixtures ni omitir tests. El revisor aporta harness completo en `../evidencia/comandos.md`, pendiente de ejecución.

### Verificación final

- Vitest focalizada (queries, page, components), `pnpm typecheck && pnpm lint && pnpm test`, `tools/verify-fichas.test.ts`, `git diff --check`.
- E2E Preview **GREEN en el SHA exacto** con dos contextos, carga real (`naturalWidth > 0`) y fallback accesible; no confundir status pending/cancelled con pass.
- En `docs/tasks/log/T-367.md`: salidas reales, SHA, test de mutación; actualizar lo que falta, sin certificarse revisor.

**No tocar:** esquemas, migraciones, RLS, permisos de Storage, otros componentes, auth, dependencias, workflows, `docs/revision-pr/**`. No amerita CC ni decisión de alcance.

## Evidencia de CI en SHA examinado

- `CI` run 39080700590: **success**. `unit`: 141 test files / 2696 tests passed (log job 117536931103). `db-tests`: Files=29 / Tests=2735 / Result: PASS, generación de tipos local y diff sin cambios (job 117536930904). Typecheck, lint, build, audit, bundle-budget en verde.
- Algunos `Result: FAIL` en el log de db-tests corresponden a **mutaciones RED esperadas**, restauradas a PASS; no confundir con fallo final del job.
- Vercel Preview: success. `e2e-preview` run 39080764903: **pending** al cierre de inspección; no se ejecutó ni pudo observarse E2E exitosa en este SHA.
- `approval-policy` run 39080699306: failure; log de 117536857738 indica que falta aprobación vigente de Lautaro073. **No aprobar mientras haya H08**.
- `develop` avanzó 21 commits respecto del ancestro del PR; GitHub `mergeable=true`. No se ejecutó merge-tree local por falta de clon.

## Metodología y límites

Leídos diff incremental, fuente de los dos componentes, fixture/auth y tests, bitácora, historial de commits y CI con log numerado. **No hay clon local disponible** (git hacia GitHub no resuelve DNS), por lo que no se ejecutó Vitest ni el harness independiente ni Playwright desde esta sesión. Todos los cierres son por inspección o evidencia externa. El reporte declara lo comprobado y nunca inventa `verificado-runtime` ni resultados RED.

**Decisiones 🔵:** ninguna. Se trata de hacer cumplir el DoD y los selectores accesibles ya estipulados.  

**Veredicto:** **NO MERGEAR aún**. Revisión R4 tras el fix de H08 y E2E real del nuevo SHA. La validación humana de staging corresponde después del merge y promoción, no se exige antes.
