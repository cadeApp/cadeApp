# Informe revisar-pr — T-351 · PR #309 · Ronda 1

**Fecha:** 2026-10-08 · **HEAD examinado:** `0a249a803a42db4e74b8ff6e7a435895f6f02fca` · **Base develop:** `8750d3f86e9abf0b9f4ebba7a3ba11917e11baa3`.

**Resultado: CON BLOQUEANTES DE EVIDENCIA (2).** Esta PR es por contrato **REVIEW ONLY / NEVER MERGE**. No se aprueba ni mergea. No aparecen 🔵 decisiones pendientes: la ficha T-351 ya establece qué resultados faltan y cómo producirlos.

## Alcance

Se consultaron `docs/tasks/T-351.md` desde `develop`, `docs/tasks/log/T-351.md` en la PR productiva #310, las normas de revisión, el diff y la historia de #309. El diff global contiene 16 archivos y 37 commits porque la ficha exige partir del HEAD de T-309 `3ff8984`: no atribuirlos erróneamente al arreglo T-351. `3ff8984...${sha}` añade solo un spec provisional y los dos cambios de clase:
- `bf8069303a6428c4b84d10af5604cec18b09e5e9`: `e2e/specs/onboarding-axe.review.spec.ts` con auditoría temporal.
- `0a249a803a42db4e74b8ff6e7a435895f6f02fca`: `text-primary` → `text-primary-dark` en «Subir» de `document-upload-card.tsx` y asterisco DNI de `identity-form.tsx`.

El test mantiene seis tags axe de WCAG 2.0/2.1/2.2 A/AA, `violations=[]` y `passes>0`. Usa `getByLabel` para los cuatro inputs de documentos y `Subir` count 4 como precondición, sin confiar en `data-status`. Audita los estados `idle`, `uploading` (POST retenido), `error` (POST abortado) y `success` (reintento); el `finally` borra de Storage si creó un objeto, verificando ausencia. No aparecen expectations adulteradas, `.skip/.only` ni silenciamiento de `color-contrast`. Los dos cambios de UI son los indicados por la ficha.

## RED de referencia confirmado por logs remotos

**Run [37740771482](https://github.com/cadeApp/cadeApp/actions/runs/37740771482), intento 7, job 113221577705**, del commit `bf8069303a6428c4b84d10af5604cec18b09e5e9`: Preview, health y setup OK. El test temporal llegó a la auditoría **idle** y falló por `Error: Violaciones WCAG en idle`, regla `color-contrast` `serious`, en cuatro `<span class="text-sm font-semibold text-primary">Subir</span>`. Datos axe: `#09babd` sobre `#f3fcfc` da **2.29:1**; sobre `#ffffff` **2.39:1**, menor que 4.5:1. El `DoD: axe AA en onboarding` de T-309 también falló. **Este RED sí es válido**, no un fallo de precondición o infraestructura.

Otros tests del checkout T-309 heredado fallaron (viaje, T-350; main-flow y notificaciones por base antigua). La ficha manda evaluar **por test**: un GREEN T-351 no exige que la suite heredada completa pase.

## PR309-H01 — bloqueo externo: GREEN E2E sin Preview

**Ruta:** `e2e/specs/onboarding-axe.review.spec.ts`. El SHA GREEN `0a249a803a42db4e74b8ff6e7a435895f6f02fca` pasa typecheck, lint, unit, build, audit, bundle-budget y db-tests. El log del CI exact-head dice `Test Files 123 passed`, `Tests 1942 passed`; db-tests `Files=19, Tests=1854, Result: PASS`. **Vercel falla por `Deployment rate limited — retry in 24 hours`.** No hay deployment GREEN ni `e2e-preview` de este SHA. Los E2E verdes de la PR #310 no prueban el spec provisional de esta rama. No declarar GREEN de axe a partir de unit/typecheck.

**Corrección:** cuando Vercel admita desplegar, capturar run/SHAs/salida reales del test provisional T-351 en los cuatro estados y del `DoD: axe AA en onboarding` sin cambiar el spec T-309 ni expectations.

## PR309-H02 — RED adversariales aún no ejecutados

**Rutas:** `document-upload-card.tsx` y `identity-form.tsx`. Según `docs/tasks/T-351.md` se requieren dos mutaciones temporales y reverts **solo en esta PR**:
1. Romper asociación `htmlFor` del label de DNI frente sin cambiar el input ni las expectativas: `getByLabel(/DNI frente/i)` debe fallar aunque «Subir» siga count 4.
2. Omitir solo `DocumentUploadCard` de `dni_front`, conservando las otras tres; debe fallar `getByLabel` y/o el count 4 (se renderizan 3).

En el historial actual no hay commits, runs ni reverts de ambos adversariales. La bitácora los reconoce pendientes de la cuota. **No son pruebas realizadas por este revisor ni por el autor todavía.** Cada uno exige SHA RED, salida específica del locator, revert normal y GREEN exact-head restaurado. Prohibido mutar expectations para fabricar rojo.

## Checks y verificación independiente

| Check | Estado |
|---|---|
| typecheck, lint, unit, build, audit, bundle-budget | PASS |
| db-tests | PASS — 19 archivos / 1854 tests |
| Vercel | FAIL — cuota |
| GREEN `e2e-preview` | NO CORRIDO |
| approval-policy | FAIL — esta PR no está terminada y jamás se mergea |

El revisor inspeccionó el código y los logs GitHub del RED y CI, **no ejecutó Playwright del repo en un clon independiente ni ejecutó las mutaciones adversariales**. Se consignan como pasos futuros en [evidencia](../evidencia/comandos.md), no como resultados.

**Próximo paso:** resolver solamente evidencia pendiente; segunda ronda independiente; cerrar #309 sin mergear. La PR #310 se revisa separadamente.
