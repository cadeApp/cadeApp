# Informe de revisión — PR #224 / T-308 — Ronda 5

**SHA revisado:** `e4db646767baebda61ab74012a7591c64c33e222`  
**develop actual:** `865a82fbaeb2249e41f9ba22e4ec66a78b9b6f57`  
**Sincronización:** behind=0  
**Fecha:** 2026-10-05

## Resultado

**CON 2 BLOQUEANTES: H04 y H07.**

No hay decisiones 🔵 para P1.

El estado general mejoró mucho: CI normal y E2E final están verdes, y H03/H05/H06 ya pueden cerrarse por runtime real. El único problema restante es la validez de M1 y el oráculo demasiado amplio que la hizo pasar.

---

## H03 — ARREGLADO-VERIFICADO

El run final `37388458786` sobre `e4db646` deja DoD1 GREEN.

Para que DoD1 pase, el spec necesariamente ejecuta:

```text
merchant reporta
→ confirmación de envío
→ limpia sesión merchant
→ login admin
→ espera /login/mfa
→ completa TOTP
→ espera /admin
→ navega /admin/incidents
→ encuentra el incidente
```

Esto verifica el arreglo de R1 y su compatibilidad después de integrar los cambios de auth/middleware de develop.

---

## H05 — ARREGLADO-VERIFICADO

Los selectores viejos fueron reemplazados y DoD1 pasa completo en los runs:

- baseline `37378544680`;
- post-revert `37386075436`;
- HEAD final `37388458786`.

La corrección del copy queda cerrada. El nuevo H07 es distinto: no es texto viejo, sino una coincidencia demasiado amplia en una aserción final.

---

## H06 — ARREGLADO-VERIFICADO

El relato final usa:

```ts
const safeRunMarker = stagingContext.testRunId.replace(/[^a-z]/gi, '');
```

El baseline `37378544680` y el final `37388458786` demuestran que CC-012 ya no rechaza el relato, que el submit se completa y que el incidente llega a la bandeja.

---

## H04 — PARCIAL

### Lo válido

M2, M3 y M4 sí tienen RED real y específico.

Run `37380513473` ya demuestra:

- **M2 / DoD2:** no aparece heading de cuenta suspendida al reponer courier a approved.
- **M3 / DoD3:** `accept_offer` prospera y devuelve request matched.
- **M4 / DoD4:** `accept_offer` prospera en vez de devolver `COURIER_SUSPENDED`.

Estos tres cuentan.

Además existen baseline GREEN y GREEN final reales.

### Lo que no cuenta: M1

En el primer commit de mutaciones `f397896`, M1 cambia únicamente:

```text
Problema con el cobro → Otro
```

pero DoD1 **sigue GREEN** en run `37380513473`.

Luego `ea4c7e4` acota la búsqueda a la fila del incidente, pero DoD1 sigue GREEN en `37382368895`.

La razón es que dentro de la propia fila existe este relato:

```text
El repartidor tuvo un problema con el cobro acordado.
```

y la aserción no exacta `/problema con el cobro/i` también coincide ahí.

Finalmente `2c0dae6` cambia temporalmente el **oráculo** a:

```ts
incidentCard.getByText(/^problema con el cobro$/i)
```

y recién entonces M1 queda RED en `37384194749`.

Pero ese cambio de oráculo fue revertido después. Por lo tanto:

1. el test final sigue sin detectar la mutación M1;
2. el RED de M1 se consiguió cambiando expectativa + mutación, no solo la precondición;
3. contradice la instrucción explícita de R4: «No modifiques las expectativas para fabricar el rojo».

M1 no puede contarse como demostrada.

---

## PR224-H07 — NUEVO · MEDIO · BLOQUEANTE

En el árbol final:

```ts
await expect(adminPage.getByText(/problema con el cobro/i).first()).toBeVisible();
await expect(adminPage.getByText(incidentDescription)).toBeVisible();
```

La primera aserción no prueba que **el tipo del incidente** sea `Problema con el cobro`: puede encontrar el texto dentro de `incidentDescription`.

Evidencia runtime:

- `f397896`: radio cambiado a `Otro` → DoD1 pasa;
- `ea4c7e4`: fila acotada por descripción, matcher no exacto → DoD1 sigue pasando;
- `2c0dae6`: matcher exacto dentro de la fila → DoD1 falla correctamente.

La corrección que ya demostró sensibilidad debe quedar **permanente** en el test sano:

```ts
const incidentCard = adminPage.getByRole('listitem').filter({ hasText: incidentDescription });
await expect(incidentCard).toBeVisible();
await expect(incidentCard.getByText(/^problema con el cobro$/i)).toBeVisible();
```

No hay que tocar producto, RPC, schema ni copy.

---

## CI y sincronización

HEAD `e4db646`:

```text
unit            success
audit           success
lint            success
typecheck       success
db-tests        success
build           success
bundle-budget   success
e2e-preview     success
behind          0
```

El diff final del PR contra develop contiene únicamente:

```text
docs/revision-pr/pr-224/**
docs/tasks/log/T-308.md
e2e/specs/incidents.spec.ts
```

Sin desvíos de alcance.

---

## Qué falta

Solo una corrección funcional de test y una sonda:

1. dejar permanente el locator exacto dentro de la fila correcta;
2. baseline GREEN;
3. mutar únicamente el radio a `Otro`;
4. comprobar DoD1 RED sin tocar ninguna expectativa;
5. revertir solo esa mutación;
6. GREEN final;
7. corregir la bitácora para que no cuente el M1 anterior como válido.

M2–M4 **no necesitan repetirse**.

**NO MERGEAR todavía.**
