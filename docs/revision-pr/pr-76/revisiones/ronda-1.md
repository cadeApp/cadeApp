# Informe de revisión — PR #76 / T-113

**PR:** https://github.com/cadeApp/cadeApp/pull/76  
**Head SHA revisado:** `d0470aa02496e1bbe8f0e302e2c79a64f10053c9`  
**Base:** `origin/develop` @ `b6b5f3952cb5964071bb548673165285ffa2d639`  
**Fecha:** 2026-09-24  

---

## Cómo leer este informe

Cada hallazgo trae **Diagnóstico**, **Evidencia** (marcada `[VERIFICADO]` si se reprodujo ejecutando, `[ANÁLISIS]` si se derivó leyendo) y **Arreglo** con código concreto.

Leé primero la sección `NO TOCAR`.

---

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | 🔴 Crítico | `docs/tasks/log/T-113.md:16` | Trabajo principal declarado en la descripción del PR no está commiteado ni en la rama | Correctness (`P15`) |
| H02 | 🔴 Crítico | `src/features/offers/actions.test.ts:4` | `pnpm typecheck` falla con 24 errores de compilación TypeScript | Correctness (`P15`) |
| H03 | 🟠 Alto | `src/features/offers/actions.test.ts:508` | Tests de `acceptOfferAction` asumen contrato inventado e inexistente en vez de `src/domain/rpc-contracts.ts` | Correctness (`P11`) |
| H04 | 🟠 Alto | `src/features/requests/components/request-offers.test.tsx:105` | `request-offers.test.tsx` asume matchers de `@testing-library/jest-dom` no soportados y omite entorno jsdom | Test Coverage (`P01`) |
| H05 | 🔴 Crítico | `src/features/requests/components/request-offers.test.tsx:1` | La suite de pruebas de la tarea está en rojo (`pnpm test` falla con 5 suites rotas) | Test Coverage (`P15`) |
| H06 | 🟡 Medio | PR #76 (metadata) | Plantilla del PR incompleta: sección de informe agy sin reporte y checklist del DoD sin tildar | Conventions (`P19`) |

---

## 1. 🔴 H01 · Trabajo principal declarado en la descripción del PR no está commiteado ni en la rama

**Archivo:** `docs/tasks/log/T-113.md:16` y descripción de GitHub PR #76  
**Estado:** `[VERIFICADO]`

### Diagnóstico
La descripción del PR #76 afirma detalladamente:
- "Server Action acceptOfferAction en src/features/offers/actions.ts llamando a la RPC atómica accept_offer..."
- "Pantalla de listado 'Mis solicitudes' (C02) en /merchant/requests..."
- "Pantalla de detalle de solicitud con ofertas entrantes (C04) en /merchant/requests/[id]..."
- "Diálogo accesible de confirmación de aceptación (C05)..."
- "Purga estricta de calificaciones..."

Sin embargo, el diff real contra `develop` (`git diff origin/develop...d0470aa`) contiene únicamente 3 archivos:
1. `docs/tasks/log/T-113.md`
2. `src/features/offers/actions.test.ts`
3. `src/features/requests/components/request-offers.test.tsx`

Ninguna de las pantallas, componentes, schemas o server actions declaradas existe en el árbol de Git. La propia bitácora (`docs/tasks/log/T-113.md:16-17`) confirma:
*"Falta: Implementar schemas de aceptación y consultas de solicitudes de comercio, acceptOfferAction en src/features/offers/actions.ts, queries en src/features/requests/queries.ts, hook de tiempo real en src/features/requests/hooks/, componentes UI (C02, C04, C05) y rutas en src/app/(merchant)/requests/**."*

Sin commit no hay SHA verificable para la implementación prometida.

### Evidencia
```bash
git diff origin/develop...d0470aa --stat
```
Salida: solo 3 archivos tocados (+455 líneas de pruebas y log).

### Arreglo
El autor/agy debe completar el ciclo de desarrollo e implementar:
1. `acceptOfferAction` en `src/features/offers/actions.ts`.
2. Componentes de UI C02, C04 y diálogo C05 bajo `src/features/requests/components/` y rutas correspondientes en `src/app/(merchant)/requests/**`.
3. Commitear y pushear el código correspondiente a la rama `feat/T-113-requests-offers`.

### Cómo verificar
```bash
git diff origin/develop...HEAD --stat
```
Verificar que los archivos implementados aparezcan en el árbol de trabajo y estén dentro de los "Archivos permitidos" de `docs/tasks/T-113.md`.

---

## 2. 🔴 H02 · `pnpm typecheck` falla con 24 errores de compilación TypeScript

**Archivo:** `src/features/offers/actions.test.ts:4`, `src/features/requests/components/request-offers.test.tsx:4`  
**Estado:** `[VERIFICADO]`

### Diagnóstico
La suite de TypeScript falla con 24 errores al compilar los tests agregados en la rama:
- `src/features/offers/actions.test.ts(4,50)`: `Module '"./actions"' has no exported member 'acceptOfferAction'.`
- `src/features/offers/actions.test.ts(508,9)`: `Type '"INVALID_STATE"' is not assignable to type ...`
- `src/features/offers/actions.test.ts(553,9)`: `Type '{ matched: true; ... }' is missing properties from type '{ status: "matched"; ... }'.`
- `src/features/requests/components/request-offers.test.tsx(4,35)`: `Cannot find module './request-offers-list' or its corresponding type declarations.`
- `src/features/requests/components/request-offers.test.tsx(5,40)`: `Cannot find module '../types' or its corresponding type declarations.`
- 16 errores de tipo por matchers no reconocidos en Vitest (`toHaveTextContent`, `toBeInTheDocument`).
- Parámetros `any` implícitos e invocaciones de click sobre tipos potencialmente indefinidos (`HTMLElement | undefined`).

### Evidencia
```bash
pnpm typecheck
```
Código de salida 1 con 24 errores.

### Arreglo
Exportar `acceptOfferAction`, crear los módulos requeridos con sus tipos y corregir las firmas de los tests para satisfacer TypeScript estricto (`noImplicitAny`, etc.).

### Cómo verificar
```bash
pnpm typecheck
```
Debe salir con código 0 sin errores.

---

## 3. 🟠 H03 · Tests de `acceptOfferAction` asumen contrato inventado e inexistente en vez de `src/domain/rpc-contracts.ts`

**Archivo:** `src/features/offers/actions.test.ts:508,543-562`  
**Estado:** `[VERIFICADO]`

### Diagnóstico
El archivo `src/features/offers/actions.test.ts` redactó aserciones contra una interfaz inexistente:
1. En línea 508 afirma el código `'INVALID_STATE'`. En `src/domain/rpc-contracts.ts` (RPC `accept_offer` definida en T-102), el código canónico es `'INVALID_STATE_TRANSITION'`. `'INVALID_STATE'` no forma parte de `DomainErrorCode`.
2. En líneas 543-550 mockea el retorno de la RPC como:
   ```ts
   const matchOutput = {
     matched: true as const,
     requestId: '...',
     offerId: validAcceptInput.offerId,
     courierId: 'courier-uuid-1',
     matchedAt: '...',
   };
   ```
   Pero el contrato canónico `acceptOfferOutputSchema` (`src/domain/rpc-contracts.ts:96-102`) es:
   ```ts
   {
     requestId: uuidSchema,
     acceptedOfferId: uuidSchema,
     status: z.literal('matched'),
     matchedAt: isoTimestampSchema,
     idempotent: z.boolean(),
   }
   ```
   No existen las propiedades `matched: true`, `offerId` (es `acceptedOfferId`), ni `courierId` en la salida de `accept_offer`.

### Evidencia
Lectura de `src/domain/rpc-contracts.ts` líneas 96-102 y 393-401.

### Arreglo
Alinear el mock y las aserciones de `src/features/offers/actions.test.ts` con el contrato canónico:
- Cambiar `'INVALID_STATE'` por `'INVALID_STATE_TRANSITION'`.
- Mockear y esperar las propiedades `status: 'matched'`, `acceptedOfferId`, `idempotent: false/true`.

### Cómo verificar
```bash
pnpm vitest run src/features/offers/actions.test.ts
```

---

## 4. 🟠 H04 · `request-offers.test.tsx` asume matchers de `@testing-library/jest-dom` no soportados y omite entorno jsdom

**Archivo:** `src/features/requests/components/request-offers.test.tsx:1,105`  
**Estado:** `[VERIFICADO]`

### Diagnóstico
1. Falta en la línea 1 la directiva de entorno de Vitest: `// @vitest-environment jsdom`.
2. El archivo utiliza métodos que no forman parte de Vitest sin `@testing-library/jest-dom`:
   - `toHaveTextContent`: líneas 105, 106, 107, 115, 116, 117 (6 veces).
   - `toBeInTheDocument`: líneas 141, 144, 145, 148, 149, 156, 188, 206, 228, 229 (10 veces).

Los tests de UI del repositorio (como `src/features/requests/components/create-request-form.test.tsx`) demuestran el patrón correcto: `expect(screen.getByText(...)).toBeDefined()`, `expect(screen.queryByText(...)).toBeNull()`, o comprobaciones sobre `.textContent`.

### Evidencia
Enumeración completa: 16 llamadas incompatibles reportadas por `tsc` y Vitest.

### Arreglo
1. Añadir `// @vitest-environment jsdom` al inicio del archivo.
2. Reemplazar `.toBeInTheDocument()` por `.toBeDefined()` (o `.not.toBeNull()`).
3. Reemplazar `.not.toBeInTheDocument()` por `.toBeNull()`.
4. Reemplazar `.toHaveTextContent(val)` por `expect(cards[0]?.textContent).toContain(val)`.

### Cómo verificar
```bash
pnpm vitest run src/features/requests/components/request-offers.test.tsx
```

---

## 5. 🔴 H05 · La suite de pruebas de la tarea está en rojo (`pnpm test` falla con 5 suites rotas)

**Archivo:** `src/features/requests/components/request-offers.test.tsx:1`, `src/features/offers/actions.test.ts`  
**Estado:** `[VERIFICADO]`

### Diagnóstico
Al ejecutar la suite general de pruebas con `pnpm test --run`, 5 archivos de prueba y 9 tests resultan en falla inmediata:
- `actions.test.ts` falla con `TypeError: (0 , actions_1.acceptOfferAction) is not a function`.
- `request-offers.test.tsx` falla con `Failed to resolve import "./request-offers-list"`.

### Evidencia
```bash
pnpm test --run
```
Salida:
```text
Test Files  5 failed | 27 passed (32)
     Tests  9 failed | 257 passed (266)
```

### Arreglo
Implementar las funcionalidades pendientes y corregir los tests para que la suite completa pase en verde.

### Cómo verificar
```bash
pnpm test
```
Debe finalizar con todos los archivos en verde.

---

## 6. 🟡 H06 · Plantilla del PR incompleta: sección de informe agy sin reporte y checklist del DoD sin tildar

**Archivo:** PR #76 (cuerpo en GitHub)  
**Estado:** `[VERIFICADO]`

### Diagnóstico
El cuerpo del PR mantiene el texto por defecto:
- `### Informe de revisión de agy (obligatorio; lo verifica approval-policy)` -> `*Pendiente de ejecución con skill revisar-pr al completar la implementación.*`
- En el DoD, todas las casillas están vacías (`[ ]`).

### Evidencia
Lectura de `gh pr view 76`.

### Arreglo
Al terminar la implementación y los arreglos de los bloqueantes H01-H05, el agy debe ejecutar la skill `revisar-pr`, pegar su informe en dicha sección y tildar únicamente los ítems de DoD que hayan sido verificados con evidencia.

### Cómo verificar
Inspección visual del cuerpo del PR en GitHub.

---

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Archivos fuera de alcance por commits anteriores | Commit `6546965` agregó accidentalmente `docs/tasks/log/T-121.md`, pero el commit `664db78` lo eliminó. En el árbol actual `d0470aa` solo se tocan archivos 100% permitidos por la ficha T-113. |
| Invocación de `acceptOfferRpc` en servidor | `acceptOfferRpc` ya existe en `src/server/rpc/offers.ts` (mergeado en develop desde T-102 / PR #64); usarla desde `src/features/offers/actions.ts` es el diseño previsto. |

---

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| PR status (Draft) | Permite abrir PRs tempranos | No valida que el código declarado en la descripción esté commiteado |
| CI local | `lint` pasa en verde | No revisa coherencia de contratos de RPC ni existencia de módulos referenciados solo en tests si no compilan |

---

## Checklist de verificación final

- [ ] `acceptOfferAction` implementada en `src/features/offers/actions.ts` y exportada en `src/features/offers/server.ts`
- [ ] Módulos UI implementados en `src/features/requests/components/` y `src/app/(merchant)/requests/**`
- [ ] Errores y matchers de tests corregidos (`actions.test.ts` y `request-offers.test.tsx`)
- [ ] `pnpm typecheck` en verde (0 errores)
- [ ] `pnpm lint` en verde (0 errores)
- [ ] `pnpm test` en verde (todas las suites pasando)
- [ ] Bitácora `docs/tasks/log/T-113.md` actualizada con la sesión de cierre
- [ ] Informe de auto-revisión pegado en el cuerpo del PR

---

## Metodología

Verificado contra `d0470aa02496e1bbe8f0e302e2c79a64f10053c9` sobre la rama `feat/T-113-requests-offers`. Comprobado mediante inspección estática, barrido de contratos contra `src/domain/rpc-contracts.ts` y ejecución de `pnpm typecheck`, `pnpm lint` y `pnpm test --run`.
