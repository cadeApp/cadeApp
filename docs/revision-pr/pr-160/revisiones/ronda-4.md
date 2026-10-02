# Ronda 4 — PR #160 / T-303

**Fecha:** 2026-10-01  
**SHA revisado:** `5aa689201b360cb1c0369900bf2dae80e05463fe`  
**Resultado:** **CON BLOQUEANTES (4)**

## Decisión P1 — 1-B

Lautaro073 resolvió la única decisión de esta ronda como **1-B**:

> T-303 queda dispensada de demostrar una mutación RED local de la guarda SQL de doble aceptación, porque el proyecto no usa Supabase/Docker local como parte del flujo habitual. La evidencia obligatoria para cerrar pasa a ser una corrida real en staging/CI del E2E de concurrencia con el oráculo fuerte de estado final: exactamente una oferta `accepted`, la otra no aceptada, request `matched` y `accepted_offer_id` coincidente.

La simulación previa de `acceptedCount: 2` no se considera evidencia RED, pero H04 deja de ser bloqueante por decisión P1.

## Sincronización

Al iniciar Ronda 4:

- base actual `develop`: `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- head revisado: `5aa689201b360cb1c0369900bf2dae80e05463fe`
- behind: **24**
- ahead: 17
- merge-base: `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`

La rama debe volver a sincronizarse antes del cierre.

## Revalidación de los 6 bloqueantes de Ronda 3

### PR160-H04 — RESUELTO POR DECISIÓN P1 1-B

No se exige mutación local de Supabase/Docker. La bitácora ya reconoce que la simulación anterior no cuenta como evidencia real. Para cerrar T-303 será obligatoria la corrida staging/CI del E2E de concurrencia con el oráculo fuerte.

### PR160-H05 — PARCIAL, SIGUE BLOQUEANTE

El body ahora incluye salida de `pnpm test`, pero esa salida es roja:

```text
Test Files  6 failed | 104 passed (110)
Tests       7 failed | 1573 passed (1580)
```

Aun así el DoD mantiene marcado:

```markdown
- [x] pnpm typecheck && pnpm lint && pnpm test
```

Eso es contradictorio. Un comando compuesto no puede quedar verde si `pnpm test` falla.

Además:
- no hay corrida real de `main-flow.spec.ts` en staging;
- `test:db` local sigue rojo y no hay evidencia de su job CI correspondiente;
- el DoD principal sigue abierto, correctamente.

### PR160-H08 — ARREGLADO SIN VERIFICAR

El selector de cambio usa `formatArs(amount)`. Cash/transferencia crean un marker único, resuelven el request ID por `notes` y navegan al detalle exacto antes de afirmar los valores.

La estructura corrige el falso positivo anterior. Falta ejecución staging.

### PR160-H09 — ARREGLADO SIN VERIFICAR

El test ahora afirma el orden exacto:
- Documentación: Courier 0 antes que Courier 1.
- Precio: Courier 1 antes que Courier 0.

Falta ejecución staging.

### PR160-H10 — PARCIAL

Separar merchant/courier en contextos distintos fue la dirección correcta y el mensaje WhatsApp ahora se valida con monto, courier y medio de pago.

Sin embargo los contextos manuales se crean con:

```ts
await browser.newContext()
```

Playwright no aplica automáticamente el `baseURL` configurado en `playwright.config.ts` a un `browser.newContext()` creado manualmente. El `baseURL` de `BrowserContextOptions` queda sin definir salvo que se pase explícitamente.

Eso rompe dos lugares de este mismo spec:
- concurrencia: `LoginPage.navigate()` usa `goto('/login')`;
- Flow 5 courier: `loginAsCourier(...)` termina navegando a rutas relativas.

**Arreglo:** crear esos contextos con el mismo `baseURL` efectivo del proyecto, sin hardcodear staging. La opción más simple es obtenerlo desde `testInfo.project.use.baseURL` y pasarlo a `browser.newContext({ baseURL })`, fallando cerrado si falta.

### PR160-R03 — ARREGLADO SIN VERIFICAR

El cleanup ahora incluye `rate_limits` por subjects de usuarios de la corrida y `audit_log` por actor/request de la corrida, antes de borrar profiles. Los tests unitarios declarados aumentaron a 45/45.

Falta ejecución staging para verificar el teardown real.

## Hallazgos nuevos

### PR160-H11 — El test de privacidad no detecta el teléfono en formato visible

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice

El DoD busca:
- el sentinel original, por ejemplo `+5493865123456`;
- los dígitos crudos `5493865123456`.

Pero el producto dispone de `formatPhone()`, que puede renderizar un número como:

`3865 12-3456`

Ese texto no contiene ni el sentinel original ni la secuencia de dígitos contigua, por lo que una fuga formateada podría pasar el E2E.

**Arreglo:** normalizar el DOM visible antes de comparar (por ejemplo quitar todo carácter no numérico y buscar los 10 dígitos nacionales) y además comprobar explícitamente `formatPhone(sentinelPhone)`.

### PR160-H12 — La rama volvió a quedar 24 commits detrás de develop

**Severidad:** alto · **Patrón:** P10-desvio-de-ficha-sin-consultar

Aunque Ronda 3 había dejado la rama sincronizada, `develop` avanzó 24 commits antes de esta revisión. Entre ellos hay cambios recientes de auth/T-322.

**Arreglo:** merge normal de `origin/develop`, sin rebase/force, y repetir los checks sobre el nuevo HEAD.

## CI

No se inspeccionan workflows para aprobación todavía porque existen bloqueantes estáticos (H05, H10, H11, H12). La siguiente ronda sí debe mirar CI si esos cuatro quedan corregidos.

## Resultado

**CON BLOQUEANTES (4):**
- H05 — body/checks contradictorios y evidencia staging/DB ausente.
- H10 — contextos manuales sin `baseURL`.
- H11 — privacidad no detecta teléfono formateado.
- H12 — rama 24 commits detrás de `develop`.

No aprobar ni mergear.
