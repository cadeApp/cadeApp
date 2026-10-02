# Evidencia y comandos — PR #160

## Ronda 4

**SHA revisado:** `5aa689201b360cb1c0369900bf2dae80e05463fe`

### Decisión P1

Lautaro073 eligió **1-B**: no se exige mutación RED local de la guarda SQL porque el proyecto no usa Supabase/Docker local. El cierre exige staging/CI real con el oráculo fuerte de concurrencia.

### Sincronización

Comparación remota:
- develop: `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- head revisado: `5aa689201b360cb1c0369900bf2dae80e05463fe`
- ahead: 17
- behind: **24**
- merge-base: `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`

### H08/H09/R03

Por inspección:
- publicación cash/transfer usa marker único y request ID exacto;
- selector $5.000 usa `formatArs`;
- sorting compara contra nombres esperados seeded;
- cleanup agrega `rate_limits` y `audit_log`.

Quedan como `arreglado-sin-verificar` hasta ejecutar staging.

### H10 — BrowserContext sin baseURL

El spec crea contextos manuales:

```ts
const context = await browser.newContext();
const courierContext = await browser.newContext();
```

y luego usa Page Objects que navegan rutas relativas:

```ts
goto('/login')
goto('/merchant/requests/:id')
goto('/trips/:id')
```

En un `browser.newContext()` manual, el `baseURL` debe pasarse como opción; no se hereda del `use.baseURL` del test runner.

### H11 — privacidad ante teléfono formateado

El test niega:
- `+5493865123456`;
- `5493865123456`.

Pero `formatPhone('+5493865123456')` puede renderizar:

`3865 12-3456`

Esa cadena no contiene ninguna de las dos buscadas. El DOM debe normalizarse antes de verificar el teléfono nacional.

### H05 — check compuesto rojo

El propio body registra:

```text
Test Files  6 failed | 104 passed (110)
Tests       7 failed | 1573 passed (1580)
```

pero mantiene:

```markdown
- [x] pnpm typecheck && pnpm lint && pnpm test
```

El check es inválido mientras cualquiera de los tres comandos falle.

### CI

No se inspeccionó CI para aprobación porque persisten H05/H10/H11/H12. Ronda 5 debe consultar workflow runs si estos cuatro quedan corregidos.
