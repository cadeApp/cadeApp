# Informe de revisión — PR #248 / T-336 — Ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/248  
**SHA revisado:** `752707bf5cc885d14924d01eb281d0313406298f`  
**SHA funcional:** `0638339d0b4a7027e17fba51310d93005d99cf1d`  
**Base:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **CON BLOQUEANTES (4)**

## Estado inicial

- T-336 leída desde `develop`.
- Rama 3 commits adelante / 0 atrás.
- 8 archivos modificados, todos autorizados.
- Preview del SHA funcional `0638339d0b4a7027e17fba51310d93005d99cf1d` está Ready.
- El commit posterior `752707bf5cc885d14924d01eb281d0313406298f` solo actualiza bitácora y su deployment falló por cuota diaria de Vercel.
- No se hace auditoría exhaustiva de CI mientras existan bloqueantes.

---

## PR248-H01 — BLOQUEANTE · alto · correctness · P05-semantica-invertida-vs-dod

**Archivo:** `src/features/auth/guards.ts`  
**Líneas principales:** ~340–404, ~450, ~461

### Qué pasa

T-336 define explícitamente que un usuario autenticado debe volver al **home real de su sesión** y que:

> Admin autenticado no cae en la landing: AAL1 entra al MFA hacia `/admin/applicants`; AAL2 entra a `/admin/applicants`.

La PR corrige `/login`, pero conserva múltiples fallbacks que todavía llaman:

`getRoleDefaultPath(session.role)`

y para admin esa función sigue devolviendo `/`.

Además, en las ramas protegidas de merchant/courier se agregó explícitamente:

`session.role === 'admin' ? getRoleDefaultPath('admin') : getSessionHomePath(session)`

o sea que el caso admin se **desvía deliberadamente de la nueva home real** para seguir enviándolo a `/`.

Ejemplos actuales:

- admin AAL1/AAL2 → `/merchant/dashboard` → `/`;
- admin AAL1/AAL2 → `/courier/feed` → `/`;
- admin → aliases `/requests`, `/feed`, `/offers`, `/profile`, `/onboarding/*` → `/`.

El test viejo `PR60-H02` todavía espera `getRoleDefaultPath('admin')`, por eso la implementación mantuvo el comportamiento histórico en vez de adaptar el control al nuevo contrato T-336.

### Por qué es bloqueante

Es exactamente la clase que originó la tarea: **usuario autenticado enviado a la landing pública**.

La nueva función `getSessionHomePath` ya sabe resolver admin AAL1/AAL2, pero varias ramas no la usan.

### Arreglo esperado

Reconciliar el test viejo con T-336 y usar el home de sesión real en todos los fallbacks de rol/alias que hoy pueden devolver `/`.

No basta con arreglar solo `/merchant/dashboard`: hay que enumerar la clase completa.

Controles mínimos:

- tabla paramétrica para admin AAL1 y AAL2 sobre:
  - una ruta merchant;
  - una ruta courier;
  - al menos un alias legacy merchant;
  - al menos un alias legacy courier;
- ninguna puede devolver `/`;
- AAL1 → MFA con `redirectTo=/admin/applicants`;
- AAL2 → `/admin/applicants`.

Mutación RED: reintroducir un fallback a `getRoleDefaultPath('admin')` debe romper la tabla.

---

## PR248-H02 — BLOQUEANTE · medio · test-coverage · P08-control-no-cubre-lo-que-dice

**Archivo:** `src/app/route-integrity.test.ts`  
**Líneas:** ~759–800

### Qué pasa

El nuevo control afirma:

> «los enlaces directos a la landing pública / están restringidos exclusivamente a la allowlist documentada»

pero solo busca:

`href="/" / href: "/"`

mediante:

`const rootLinkRegex = /\bhref\s*[:=]\s*["']\/["']/g;`

Eso deja pasar otros productores de navegación genérica a `/`, por ejemplo:

- `router.push('/')`;
- `router.replace('/')`;
- `redirect('/')`;
- `redirectTo: '/'`;
- una variable/helper que termina en `/`;
- defaults como `logoHref = '/'`.

El helper preexistente `assertNoInvalidInternalLinks` no compensa esto porque `/` es una ruta existente y, por lo tanto, la considera válida.

Además, la regex usa flag global `g` y se reutiliza entre archivos con `.test(content)`. En JavaScript, `.test` con regex global conserva `lastIndex`; un match en un archivo puede hacer que el siguiente empiece a escanear desde un offset distinto y se salte una violación.

La allowlist también es **por archivo completo**: si mañana `login/page.tsx` agrega un segundo `href="/"` no documentado, seguirá pasando por estar el archivo allowlisteado.

### Arreglo esperado

Crear un control discriminante de **ocurrencias**, no solo de archivos:

- detectar los productores de navegación a `/` que T-336 promete auditar;
- allowlist exacta de las ocurrencias legítimas, no permiso irrestricto al archivo;
- no reutilizar una regex global con estado entre fuentes.

Pruebas sintéticas mínimas:

- `router.push('/')` → violación;
- `redirect('/')` → violación;
- `redirectTo: '/'` → violación;
- segundo root-link no autorizado dentro de un archivo allowlisteado → violación;
- dos archivos consecutivos con root link → ambos se detectan;
- los tres usos públicos legítimos siguen permitidos.

---

## PR248-H03 — BLOQUEANTE · medio · test-coverage · P04-test-tautologico

**Archivo:** `src/app/route-integrity.test.ts`  
**Líneas:** ~801–829

### Qué pasa

Se agregaron dos tests llamados “mutación” que no mutan ni ejercen producción.

Ejemplo admin:

```ts
const mutatedGuard = () => ({
  action: 'redirect',
  redirectTo: '/',
});
const mutatedResult = mutatedGuard('/login', adminSession);
expect(mutatedResult.redirectTo).not.toBe('/login/mfa?...');
```

Ese test **pasa precisamente porque el mutante está roto**. No puede ponerse rojo por una regresión del producto.

Los tests de ErrorView/NotFoundView hacen lo mismo con strings simulados:

`'<Link href="/">Ir al inicio</Link>'`

y solo comprueban que el regex reconoce el string que el propio test acaba de construir.

La bitácora sí declara que se hicieron mutaciones reales y que las suites existentes quedaron RED. Eso es válido; los tests simulados permanentes no agregan protección y contradicen la regla de no aceptar tests falsos/tautológicos.

### Arreglo esperado

Eliminar esos tests simulados o reemplazarlos por tests que llamen al **helper real** / función real.

No hace falta inventar un framework de mutation testing:

- la prueba real de `evaluateRouteGuard('/login', admin)` ya es discriminante;
- `error-views.test.tsx` debe proteger el href real;
- el control de integridad corregido de H02 debe detectar la reintroducción real.

En la bitácora, conservar la evidencia RED/GREEN de las mutaciones temporales reales.

---

## PR248-H04 — BLOQUEANTE · medio · evidencia · P15-entregable-declarado-pero-no-ejecutable

**Archivos:** `docs/tasks/T-336.md`, `docs/tasks/log/T-336.md`

### Qué pasa

La propia ficha mantiene sin marcar:

> Verificación manual Develop/Preview

y la bitácora termina con:

> Falta: verificación visual manual en staging/preview.

El Preview del **SHA funcional `0638339d0b4a7027e17fba51310d93005d99cf1d` ya está Ready**, por lo que el bloqueo inicial de cuota ya no impide hacer esta parte.

El DoD pide verificar:

- 404 anónimo → login;
- 404 merchant autenticado → dashboard/onboarding;
- 404 courier autenticado → feed/onboarding;
- admin → MFA/home;
- 360 px sin overflow y target ≥48 px.

Los tests unitarios no sustituyen esa verificación: T-334 ya dejó como lección que la prueba manual encontró contratos que los tests no habían detectado.

### Arreglo esperado

Sobre el Preview del SHA funcional `0638339d0b4a7027e17fba51310d93005d99cf1d` (o un SHA posterior con el mismo código):

- ejecutar la matriz manual;
- registrar URL/SHA y resultados en bitácora;
- adjuntar evidencia 360 px del 404 y del retorno;
- no fabricar estados, DOM ni sesión;
- si falta una cuenta de algún estado, usar fixtures/cuentas de prueba existentes de Develop; no tocar DB/RLS para inventarla.

Solo después marcar el DoD manual como `[x]`.

---

## Correcto / descartado

- ErrorView y NotFoundView sí cambiaron a `/login`.
- `/login` anónimo queda permitido.
- Merchant/courier completo e incompleto están cubiertos por tests directos del gateway.
- Admin AAL1/AAL2 en `/login` quedó corregido.
- Admin AAL2 en `/login/mfa` ya va a `/admin/applicants`.
- No hay archivos fuera del alcance.
- No hay cambios de DB/RLS/dependencias.
- Vercel del SHA funcional está Ready; el failure del HEAD documental es cuota externa.

## Resultado

**4 bloqueantes. 0 decisiones 🔵.**
