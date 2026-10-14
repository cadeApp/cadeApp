# Informe de revisión — PR #242 / T-325 hotfix — Ronda 4

**HEAD revisado:** `c14fead12f0e42ecf42216b1de9b8ea2f3546907`  
**SHA funcional:** `ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3`  
**Base actual:** `develop@3e5d5381dbf59717763f1927e1cf080504a9ebf1`  
**Fecha:** 2026-10-03/04  
**Resultado:** **CON BLOQUEANTE RESIDUAL (1)**

## Decisiones

No hay decisiones 🔵 pendientes.

La ampliación de `/courier/profile` continúa tratándose como autorizada por Lautaro073.

## Sincronización

La integración solicitada en R3 se realizó mediante merge normal:

`ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3` — `fix(courier-onboarding): merge develop preserving profile contracts [T-325]`

Padres:
- revisión R3 / rama T-325;
- `develop@3e5d5381dbf59717763f1927e1cf080504a9ebf1` con T-334.

Estado actual:

- ahead 12;
- behind 0;
- `mergeable=true`.

H05 deja de ser bloqueante.

## PR242-H05 — cerrado

**Estado:** `arreglado-verificado`

### Contrato T-334 preservado

El árbol actual contiene:

- `CourierProfileData.onboardingComplete: boolean`;
- `profile/page.tsx`: `onboardingComplete: courier.vehicle_type !== null`;
- badge «Completá tu registro» cuando es false;
- card «Todavía no enviaste tu registro»;
- CTA «Continuar registro»;
- ausencia del badge normal «En revisión administrativa» para onboarding incompleto.

### Contrato T-325 preservado

En el mismo árbol:

- `licenseStatus` se obtiene de `courier_documents`;
- `insuranceStatus` se obtiene de `courier_documents`;
- «Notificaciones» reemplaza «Notificaciones sonoras»;
- links legales:
  - `/legal/terms`;
  - `/legal/privacy`;
  - `/legal/courier`;
- los targets mantienen `min-h-12`.

### Tests de integración

`profile/page.test.tsx` ahora hace configurable `vehicle_type` y fija:

- motorcycle → `onboardingComplete=true` + documentos submitted;
- null → `onboardingComplete=false`;
- ausencia → none;
- verified;
- rejected.

`components.test.tsx` conserva simultáneamente los tests T-334 y el test T-325 de ajustes/legales.

La bitácora registra dos mutaciones discriminantes:

1. `onboardingComplete: true` → 1 failed / 4 passed;
2. condición del badge incompleto rota → 1 failed / 1 passed / 59 filtrados por `-t T-334`.

Restaurado: suite dirigida 90/90.

### Verificación CI

CI #1094 sobre el HEAD documental actual (mismo código funcional):

- `Test Files 118 passed (118)`;
- `Tests 1835 passed (1835)`;
- lint: success;
- typecheck: success;
- build: success;
- bundle-budget: success;
- `/courier/feed = 159 kB`;
- `/courier/profile = 178 kB`.

El job DB todavía estaba ejecutándose al momento de cerrar R4; no se inventa su resultado. No hay cambios DB propios de T-325.

H05 queda cerrado.

---

## PR242-H06 — único bloqueante residual

**Estado:** `abierto`  
**Categoría:** evidencia visual / P15

La integración funcional ya está lista, pero no existe un Preview del SHA combinado.

Vercel devuelve para `ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3` y los commits posteriores:

`Resource is limited - try again in 24 hours (api-deployments-free-per-day)`

Por eso no existen:

- `360-07-profile-documents.jpg`;
- `360-08-profile-settings.jpg`;
- verificación real de los tres links legales en el perfil combinado;
- medición de overflow del perfil combinado.

La bitácora lo declara correctamente y no fabricó capturas.

### Qué NO hacer

- no tocar código para resolver H06;
- no crear un commit vacío solo para “poner verde” Vercel mientras la cuota siga bloqueada;
- no reutilizar una captura del Preview viejo `3c46969`, porque no contiene la integración T-334 + perfil nuevo;
- no modificar DOM, props, DB/RLS ni interceptar respuestas para fabricar evidencia;
- no bajar la exigencia visual porque el proveedor esté rate-limited.

### Cierre cuando Vercel se libere

Sobre un Preview del HEAD que contenga `ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3`:

1. abrir `/courier/profile` a 360 px con courier completo/pending;
2. capturar documentación real;
3. capturar ajustes + links legales;
4. verificar que los tres links resuelven;
5. confirmar sin overflow;
6. si hay courier incompleto disponible, repetir «Completá tu registro»; si no, los tests exact-head ya fijan ese contrato.

Solo después H06 puede pasar a `arreglado-verificado`.

---

## CI / flakies

La corrida local completa registrada por el autor tuvo:
- timeout de `verify-scaffold`;
- un fallo de `auth/guards`.

Ambos pasaron aislados después de la integración. El CI exact-head ejecutó la suite completa y quedó **1835/1835**.

Esto es consistente con los seguimientos preexistentes (#72 y #243); no se abre otro hallazgo T-325 ni se debilitan tests.

## Resultado

**Código: sin bloqueantes conocidos.**  
**Entrega visual: bloqueada solo por H06 / Vercel rate limit.**

No aprobar ni mergear todavía.
