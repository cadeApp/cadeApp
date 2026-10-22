# Informe de revisión — PR #98 / T-311 — Ronda 2

**Head SHA revisado:** `c5c737116a9a55da0dfe78b2fd76c079fcc95520`  
**Base:** `develop@7edcfe01ca62762159b053af59204f3de0d94e2b`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (5)**

## Cierres

- **H02 cerrado:** responsable/contactos reales, art. 6/11, ARCO y retiro de soporte ficticio.
- **H03 cerrado:** piloto hasta 7 días, cierre anticipado informado, sin cobro retroactivo/adhesión automática.
- **H04 cerrado:** setting de `pilot_terms` se normaliza y debe coincidir con el documento publicado.
- **H05 cerrado:** auth/merchant/courier ya tienen casos 0.9 que cortan antes de escrituras; bitácora registra M1–M3.
- **H07 cerrado:** `aria-labelledby` + tests por role/name.
- **H10 cerrado:** desde R1 el autor no volvió a tocar `docs/revision-pr/**`.

Fuente oficial usada para contrastar H02/H11: Ley 25.326, arts. 6 y 11: https://www.argentina.gob.ar/normativa/nacional/64790/texto

## H01 · 🔴 T-312 todavía exige “abogado OK”

**Archivo:** `docs/implementation-plan.md:337`  
**Estado:** [ANÁLISIS] · abierto parcial

La rama ya mergeó develop y está 0 commits atrás, pero T-312 conserva `abogado OK`, incompatible con la decisión P1 formalizada para T-311.

**Arreglo:** quitar ese gate y reemplazarlo por una condición coherente con T-311 sin atribuir revisión jurídica externa.

## H06 · 🔴 El rollback es best-effort y no observa el error de deleteUser

**Archivo:** `src/features/auth/actions.ts:124-132`  
**Estado:** [ANÁLISIS] · abierto parcial

La compensación existe, pero:

```ts
try {
  await adminClient.auth.admin.deleteUser(data.user.id);
} catch {
  // best-effort
}
```

`deleteUser` puede devolver `{ error }` sin lanzar. Ese resultado se ignora. Si falla la compensación, puede quedar un usuario Auth sin TOS/privacy persistidos. El test nuevo solo cubre borrado exitoso.

**Arreglo:** primero test rojo con `deleteUser` devolviendo `error` (y preferentemente rechazo). El cierre requiere que la cuenta no quede utilizable sin consentimientos. Si no puede garantizarse dentro del alcance, usar `contract-change` como pidió R1; no silenciar el fallo.

## H08 · 🔴 Sigue pendiente navegador 390/360 + capturas + axe

La ficha y la bitácora ahora lo dejan correctamente `[ ]`. Eso es honesto, pero el DoD sigue incompleto.

Esta revisión consultó el Vercel conectado: el proyecto `cadeapp` no tiene deployment disponible para esta rama, así que no hay preview actual con el cual cerrar la evidencia desde aquí.

**Arreglo:** ejecutar P04 a 390×844 y 360×800, hub + documento largo, y axe AA en las superficies tocadas. Asociar evidencia al SHA.

## H09 · 🔴 El body real del PR sigue desactualizado

La bitácora está corregida, pero el body persistido de PR #98 todavía:
- marca `[x]` navegador/axe;
- contiene la autorrevisión vieja “SIN BLOQUEANTES”;
- apunta a `docs/revision-pr/pr-98/evidencia/fuentes-legales.md`, ruta ya reemplazada por material del autor;
- muestra cifras de tests anteriores a R2.

El resumen entregado en chat no sustituye el body de GitHub.

**Arreglo:** actualizar el body al estado real y dejar H08 sin marcar hasta tener evidencia.

## H11 · 🔴 La Política informa como obligatorios campos que el producto no exige

**Archivo:** `src/features/legal/documents.ts:153-160`  
**Estado:** [ANÁLISIS] · nuevo

El texto dice para repartidores que son obligatorios “nombre, DNI, imágenes de DNI, selfie y datos del vehículo y patente”. Los schemas reales dicen:

- `registerSchema.displayName`: opcional.
- `registerSchema.phone`: opcional.
- courier: DNI, frente/dorso, selfie, avatar y `vehicleType`: obligatorios.
- patente: obligatoria solo para `moto`/`car`.
- licencia y seguro: opcionales.
- merchant: `businessName`, `phone`, `defaultPickupAddress` obligatorios; `defaultPickupZoneId`, coordenadas y notas opcionales.
- request: pickup/dropoff zone+address, recipientName/phone, declaración, paquete, medio de pago y `needsChange` obligatorios; coordenadas/notas/cambio son opcionales o condicionales.

El art. 6 exige informar correctamente el carácter obligatorio/facultativo, así que esta divergencia es material.

**Arreglo:** reescribir esa sección desde los schemas. No cambiar los schemas para que coincidan con el texto.

## CI final

No se inspecciona todavía: el procedimiento manda revisar CI final recién cuando no quedan bloqueantes estáticos.

## Prompt AGY

T-311 · PR #98 · Ronda 2. Empezá con `git pull`. Sin rebase, force ni amend. No toques `docs/revision-pr/**`.

1. **H01:** quitá `abogado OK` de T-312 y dejá el plan coherente con la decisión P1.
2. **H11:** corregí “obligatorio/facultativo” usando literalmente los schemas de auth, merchant, courier y requests; no modifiques schemas para acomodar el texto.
3. **H06:** escribí primero un test donde `deleteUser` devuelve `error` y otro si podés donde rechaza. La cuenta no debe quedar utilizable sin consents. Si no podés garantizarlo en el alcance actual, ejecutá `contract-change`; no mantengas rollback best-effort silencioso.
4. **H09:** actualizá el body real de PR #98: H08 `[ ]`, sin “SIN BLOQUEANTES”, sin ruta de evidencia obsoleta y con checks reales del SHA actual.
5. **H08:** browser real 390×844 + 360×800, P04 hub + documento largo, axe AA en legal/registro/onboardings; adjuntá evidencia. Si no podés, sigue bloqueando.
6. Actualizá bitácora.
7. Tests dirigidos + `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
8. Push normal y pasá SHA remoto.

No edites ni cierres hallazgos dentro de `docs/revision-pr/**`.
