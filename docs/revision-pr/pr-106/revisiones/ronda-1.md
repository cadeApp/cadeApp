# PR #106 · T-122 — Ronda 1

- **SHA revisado:** `085d2c3d85c49c17d950c217353b91d4a6ffbdd6`
- **Base:** `develop@366a2b859be586278bff9245b3f1ce1d1b6533ec`
- **Resultado:** **CON BLOQUEANTES (11)**
- **Decisiones 🔵:** resueltas por Lautaro073 antes del cierre: **1-A** y **2-A**.

## Resumen

La implementación tiene una base aprovechable, pero el shell admin todavía no es operable de punta a punta:

1. las páginas se publican sin el segmento `/admin`;
2. el flujo MFA no alcanza la pantalla MFA;
3. las mutaciones administrativas pierden la identidad del admin al usar service_role;
4. la verificación documental usa un payload distinto del contrato RPC;
5. quedan incumplimientos vinculantes de diseño, paginación, boundaries y evidencia visual.

El CI verde no contradice esto: las pruebas actuales mockean exactamente las fronteras donde están H04/H05, y el build demuestra H01 al listar las rutas reales.

## Decisiones de Lautaro073

### D01 — 1-A · Mantener `/admin/...`

Se mantiene el namespace canónico del panel. T-122 debe reestructurar las páginas para que Next publique el segmento real `admin`.

La pantalla MFA puede conservar el endpoint especial `/login/mfa`; lo obligatorio es que el guard de un admin aal1 redirija a esa pantalla, preserve un destino interno seguro y, tras verificar aal2, vuelva a `/admin/...`.

### D02 — 2-A · Usar shadcn vía contract-change

Confirmado en el repo: `components.json` es configuración shadcn y aliasa `ui` a `@/ui`.

No se acepta dejar primitivas paralelas. Hacer un CC separado para incorporar las primitivas requeridas —Table, Tabs, InputOTP— y cualquier dependencia que el generador oficial necesite. El CC se mergea/reserva en develop antes de traerlo a T-122; no se crea un número de CC “solo” dentro de esta rama.

---

## PR106-H01 — BLOQUEANTE · alto
### El route group `(admin)` no publica `/admin/*`

La ficha y A00 fijan `/admin/applicants` como ruta canónica. El código está en:

```text
src/app/(admin)/applicants/page.tsx
src/app/(admin)/applicants/[id]/page.tsx
src/app/(admin)/couriers/page.tsx
```

En Next App Router, `(admin)` es un route group y no forma parte de la URL.

El propio build del SHA revisado demuestra el resultado:

```text
ƒ /applicants
ƒ /applicants/[id]
○ /couriers
ƒ /login/mfa
```

Mientras tanto `ADMIN_NAV_TABS`, los botones Revisar, el cambio de tabs y el alias apuntan a `/admin/applicants`.

**Corrección:** conservar el route group para layout si sirve, pero agregar el segmento real `admin` en el filesystem para las rutas operativas. Agregar control de integridad que lea también el alcance admin y falle si una href canónica no existe.

**RED reviewer-owned:** antes de mover archivos, una prueba de integridad que resuelva `/admin/applicants`, `/admin/applicants/<id>` y `/admin/couriers` contra el filesystem debe quedar roja sobre este SHA.

---

## PR106-H02 — BLOQUEANTE · alto
### El guard de aal1 nunca llega al MFA

El test actual solo comprueba:

```ts
evaluateRouteGuard('/admin/applicants', adminAal1)
// => /login?mfaRequired=1&redirectTo=...
```

Pero el segundo request es `/login`. Para la misma sesión admin, la rama de auth route devuelve el default de admin (`/`). Por eso el usuario rebota antes de `/login/mfa`.

**Corrección:** el guard de rutas admin debe enviar aal1 directamente al endpoint MFA real, con `redirectTo` interno y codificado. Agregar prueba de flujo de dos saltos: admin aal1 solicita ruta admin → destino MFA; MFA con aal1 se permite; admin aal2 vuelve a la ruta original.

**RED reviewer-owned:** el nuevo test debe fallar con el guard actual porque el primer destino es `/login`, no la pantalla MFA.

---

## PR106-H03 — BLOQUEANTE · alto
### `redirectTo` del MFA es una frontera XSS abierta

La page toma el query param y lo entrega sin sanitizar:

```tsx
<MfaForm redirectTo={resolvedParams.redirectTo} />
```

Luego:

```tsx
router.push(redirectTo);
```

Next.js advierte expresamente no enviar URLs no confiables a `router.push`/`replace`; una URL `javascript:` se ejecuta en contexto de la página.

**Corrección:** no navegar con el valor crudo. Validar server-side contra destinos internos admin permitidos, o usar exclusivamente un destino seguro producido por servidor. Casos negativos mínimos: `javascript:`, `https://...`, `//host`, backslash y CR/LF.

**RED reviewer-owned:** una prueba con `redirectTo='javascript:alert(1)'` debe demostrar que el valor nunca llega a `router.push`.

---

## PR106-H04 — BLOQUEANTE · alto
### Las RPC admin reciben service_role en vez de la sesión aal2

`requireAdminAal2()` valida correctamente con el cliente de sesión. Sin embargo las mutaciones luego hacen:

```ts
const adminClient = createAdminClient();
await adminDecideCourierRpc(adminClient, ...)
await adminSuspendCourierRpc(adminClient, ...)
await adminVerifyDocumentRpc(adminClient, ...)
```

Las RPC T-105 hacen su propia defensa en profundidad con `app_private.assert_admin_aal2()`, que exige `auth.uid()`, rol admin y `auth.jwt()->>'aal' = 'aal2'`. Esa identidad debe venir del JWT del usuario autenticado.

**Corrección:** las RPC se invocan con el cliente de sesión autenticado. El service-role queda para las operaciones que realmente lo necesitan, por ejemplo el acceso server-side al bucket privado después de validar aal2.

**RED reviewer-owned:** en `actions.test.ts`, hacer que el test feliz exija que el primer argumento del wrapper sea el mock de `serverSupabase.createClient`, no `expect.anything()`; también afirmar que la mutación no usa `createAdminClient` para la RPC. Ese test queda rojo con el código actual.

---

## PR106-H05 — BLOQUEANTE · alto
### La verificación documental llama el wrapper con nombres de campos equivocados

Contrato:

```ts
{ documentId, decision: 'verified' | 'rejected', reason }
```

Action actual:

```ts
{ documentId, verified: boolean, rejectionReason }
```

El wrapper hace `safeParse` contra el contrato canónico, así que el camino real termina en `VALIDATION_ERROR` antes de Postgres.

**Corrección:** mapear la intención UI al contrato: `verified=true → decision:'verified', reason:null`; rechazo → `decision:'rejected', reason:<motivo>`.

**RED reviewer-owned:** cambiar primero la expectativa del test a la forma canónica; debe quedar roja contra este SHA y verde recién con el mapeo correcto.

---

## PR106-H06 — BLOQUEANTE · medio
### Las primitivas vinculantes se duplicaron en la feature

A00 exige primitivas del sistema para Table/Tabs/InputOTP. La ficha dice que esas primitivas o equivalentes solo entran mediante `contract-change`.

Hoy:
- MFA usa un `<input>` manual;
- A01 usa `<button role="tab">` manual;
- A01 usa `<table>` manual.

**Decisión aplicada:** 2-A.

**Corrección:** CC separado, basado en shadcn, para agregar las primitivas oficiales en `src/ui/**`; luego T-122 las consume. No editar `src/ui/**`, `package.json` o lockfile directamente dentro de T-122.

**RED reviewer-owned:** después del CC, un control de T-122 debe fallar si A00/A01 vuelven a primitivas paralelas en vez de importar las oficiales.

---

## PR106-H07 — BLOQUEANTE · medio
### La cola no está paginada

`getApplicantsQueue` hace select + eq + order y devuelve todo. También trae todos los `courier_documents` relacionados.

**Corrección:** paginación server-side con tamaño acotado y parámetros validados. La UI debe navegar páginas/cursor sin cargar la cola completa.

**RED reviewer-owned:** el mock de query debe exigir una llamada de límite/rango; con la implementación actual el test falla.

---

## PR106-H08 — BLOQUEANTE · medio
### Un error de DB se muestra como “vacío” o “404”

Actualmente:
- error en cola → `[]`;
- error al leer courier → `null`;
- no hay `loading.tsx` ni `error.tsx` en applicants.

Eso hace indistinguible “no hay postulantes” de “la DB falló”, y “no existe” de “falló la consulta”.

**Corrección:** diferenciar error de ausencia, lanzar/propagar fallos de infraestructura y agregar boundaries con Skeleton y error recuperable. Mantener `notFound()` solo para inexistencia real.

**RED reviewer-owned:** modificar el test de error para esperar rechazo/throw en vez de `[]`; queda rojo con este SHA. Agregar control de existencia de boundaries.

---

## PR106-H09 — BLOQUEANTE · medio
### 13 usos de `text-xs`

Barrido completo del alcance nuevo:

```text
src/app/(admin)/admin-nav.tsx                         1
src/features/admin/components/applicants-queue.tsx   5
src/features/admin/components/applicant-detail-view.tsx 6
src/features/admin/components/mfa-form.tsx           1
TOTAL                                                13
```

A01 exige eliminar `text-xs`; D16 fija piso de 14px.

**Corrección:** eliminar las 13 ocurrencias del alcance T-122 y usar `text-sm`/tokens aprobados.

**RED reviewer-owned:** control estático sobre todo el alcance T-122; hoy debe listar las 13 y fallar.

---

## PR106-H10 — BLOQUEANTE · medio
### “Salir” no hace logout

```tsx
<form action="/login">
  <Button ...>Salir</Button>
</form>
```

Eso solo navega. La cookie/sesión sigue activa y el guard de `/login` detecta al admin autenticado y lo redirige.

El proyecto ya tiene `logoutAction()` que llama `supabase.auth.signOut()`.

**Corrección:** el CTA debe cerrar la sesión y luego navegar a login.

**RED reviewer-owned:** test del AdminNav que haga click en Salir y afirme que se llamó a la acción de logout; debe quedar rojo sobre este SHA.

---

## PR106-H11 — BLOQUEANTE · medio
### Falta la evidencia visual exigida

La ficha está marcada:

> navegador desktop 1280 y 1024, capturas A00/A01/A02, foco y contraste AA comprobados.

No hay capturas en el PR, comentarios ni archivos de evidencia. Además H01 obliga a repetir la verificación sobre las rutas canónicas arregladas.

**Corrección:** después de los arreglos, adjuntar capturas A00/A01/A02 a 1280 y 1024; registrar recorrido de teclado/foco y resultado de contraste AA. Si algo no se pudo comprobar, dejar el checkbox sin marcar.

**Demostración:** el PR tiene 0 comentarios y 0 capturas/artefactos visuales referenciados pese al DoD marcado como completo.

---

## RED inicial — válido

El commit `8cdd5396fc23931e69fadaef458c6551a23b0c83` sí dejó una fase roja real.

Run `36220145463`, job unit `108343734457`:

```text
src/features/admin/admin.test.ts (13 tests | 7 failed)
Test Files 1 failed | 55 passed (56)
Tests      7 failed | 607 passed (614)
```

Entre los rojos:
- AAL2 esperado, stub devolvía INTERNAL_ERROR;
- motivos obligatorios;
- visor firmado;
- cola vacía;
- detalle null.

El workflow global terminó `cancelled` por pushes posteriores, pero el job unit alcanzó a ejecutar y dejó el rojo completo antes de la cancelación. Esa evidencia se considera válida.

## CI final del autor

Run `36221635164` sobre `085d2c3`:
- typecheck ✅
- lint ✅
- unit ✅ 58 archivos / 621 tests
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅ 12 archivos / 1529 tests

No se usa ese verde como aprobación porque permanecen los 11 bloqueantes.

## Preflight

- rama y remoto: SHA `085d2c3...`;
- base develop: `366a2b8...`;
- GitHub: mergeable;
- comentarios de PR: ninguno;
- carpeta `docs/revision-pr/pr-106/**` previa: inexistente;
- intento local de `git clone/merge-tree`: no reproducible porque el contenedor no resuelve `github.com`; no se inventa salida. Se usó mergeability + merge ref de GitHub.
