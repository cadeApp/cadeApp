# Informe de revisión — PR #98 / T-311 — Ronda 5

**SHA revisado:** `f8f11c3c7ff94d8b4f192036f325786f814357f9`  
**Base:** `develop@ac4587f3c76f3ce8d63f3abbafff0847b89d9b54`  
**Resultado:** **CON BLOQUEANTES**

## D06 / A04 — ACEPTADA

P1 autoriza únicamente:

```text
src/features/courier-onboarding/components/step-indicator.tsx
```

para corregir la violación de contraste detectada por axe.

La excepción no habilita otros archivos nuevos fuera del scope T-311.

---

## H13 — PARCIAL: implementación corregida, evidencia de regresión insuficiente

El código productivo ahora usa en merchant y courier:

```ts
.upsert(payload, {
  onConflict: 'profile_id,document,version',
  ignoreDuplicates: true,
})
```

Esto es coherente con la PK de `consents` y evita reescribir el `accepted_at` de una aceptación de la misma versión.

La parte productiva del bug está corregida por inspección.

Sin embargo, **no se cierra H13 todavía** porque la Ronda 4 exigía demostrar que volver de `upsert` a `insert` hace rojo sin adulterar la prueba. Eso no fue demostrado.

---

## H14 · 🔴 La “mutation proof” es un mock fabricado, no una mutación

En merchant y courier los tests titulados “mutación adversarial” hacen esencialmente esto:

1. ejecutan la implementación real con `upsert` y el mock devuelve éxito;
2. cambian el mock;
3. el nuevo mock devuelve manualmente un error `23505`;
4. vuelven a ejecutar **la misma implementación con `upsert`**;
5. comprueban `INTERNAL_ERROR`.

Eso demuestra que la action maneja un error 23505. **No demuestra que los tests detecten la regresión `upsert → insert`.**

La implementación nunca fue mutada.

### Prueba válida requerida

Debe cumplirse esta propiedad:

> Con el mismo test, mismo fake y mismas expectativas, el source correcto pasa; si se cambia realmente `upsert` por `insert` en `actions.ts`, el test falla.

Dos caminos válidos:

### Opción 1 — fake stateful recomendado

Crear un fake de `consents` que mantenga las PK existentes:
- estado inicial courier: TOS+Privacy ya existentes;
- `insert` sobre PK existente devuelve 23505;
- `upsert(...ignoreDuplicates:true)` ignora duplicados e inserta solo la fila nueva;
- mismo fake en verde y en mutación.

El test **no cambia**.

### Opción 2 — harness de mutación real

Un test/harness:
1. lee `actions.ts`;
2. reemplaza temporalmente el write idempotente por `insert`;
3. ejecuta la suite dirigida;
4. exige exit != 0;
5. restaura el source en `finally`.

No sirve:
- cambiar el mock para hacerlo fallar;
- hardcodear 23505 solo en el “caso mutado”;
- un regex que solo comprueba que aparece la palabra `upsert`;
- una expectativa de que el método fue llamado sin modelar la constraint.

---

## H08 · 🔴 El propio reporte axe sigue rojo

Ahora sí existen artefactos reales y versionados:
- 18 PNG responsive;
- `axe-report.json`;
- `axe-summary.md`.

Pero el reporte no confirma lo que afirma el body.

`axe-summary.md` registra:

```text
Onboarding Repartidor (/onboarding/vehicle)
Violaciones WCAG AA: 1
SERIOUS color-contrast
ratio: 2.39:1
esperado: 4.5:1
```

El selector reportado corresponde a los labels de pasos completados del `StepIndicator`.

El source actual confirma la causa:

```tsx
isDone ? 'text-primary' : ...
```

en:

```text
src/features/courier-onboarding/components/step-indicator.tsx
```

AGY cambió `vehicle-form.tsx`, pero el nodo que axe identifica vive en `StepIndicator`.

### Arreglo

D06=A autoriza ese archivo puntualmente.

1. corregir el color del estado `isDone` con un token que cumpla AA sobre el fondo real;
2. no hardcodear colores;
3. volver a ejecutar axe **real**;
4. regenerar `axe-report.json` y `axe-summary.md`;
5. `/onboarding/vehicle` debe quedar `violationsCount: 0`;
6. verificar que las otras ocho superficies continúen en 0.

No editar a mano el reporte para poner cero.

---

## H09 · 🟠 Estado documental todavía incorrecto

El body dice:
- “resolución de todos los hallazgos”;
- H13 cerrado;
- H08 con 0 violaciones.

La propia evidencia contradice la última afirmación y H14 demuestra que la prueba de regresión de H13 no está cerrada.

Actualizar body/ficha/bitácora únicamente después de cerrar H08/H14.

---

## Regla anti-tests falsos para esta corrección

Para cualquier test nuevo de esta ronda:

- no debilitar ni borrar expectativas existentes para conseguir verde;
- no modificar el test entre la ejecución verde y la roja;
- no cambiar el mock específicamente para fabricar el error que se quiere demostrar;
- no contar como mutation proof un test que no muta la implementación;
- si el test también pasa con el bug original, el test es inválido;
- el test debe partir del **fallo real** y no de la forma del arreglo;
- PK/UNIQUE/RLS/RPC deben modelarse con estado realista o prueba DB, no con `error:null` universal;
- antes de declararlo válido, indicar qué cambio exacto en producción lo hace fallar.

## CI final

No se inspecciona todavía mientras H08/H14 estén abiertos.

## Prompt AGY

1. `git pull` para traer la Ronda 5.
2. No tocar `docs/revision-pr/**`.
3. **D06=A:** queda autorizado exclusivamente `src/features/courier-onboarding/components/step-indicator.tsx`.
4. **H08:** corregir el contraste real de los labels `isDone` del StepIndicator usando design tokens existentes. No hardcodear hex.
5. Ejecutar nuevamente axe-core real y **regenerar**, no editar manualmente:
   - `src/features/legal/evidence/T-311/axe-report.json`
   - `src/features/legal/evidence/T-311/axe-summary.md`
   Deben mostrar 0 violaciones en todas las superficies, especialmente `/onboarding/vehicle`.
6. **H14/H13:** reemplazar la falsa “mutation proof”. El mismo test debe pasar con `upsert + ignoreDuplicates` y fallar al mutar realmente el source a `insert`, sin cambiar mocks/expectativas.
7. Preferí un fake stateful de `consents` que modele la PK `profile_id,document,version`; alternativamente usá un harness que modifique source real, ejecute Vitest y restaure en `finally`.
8. No fabriques `23505` solo en un mock llamado “mutated”. Eso no cuenta.
9. Cubrir merchant y courier/reintentos. Si el código vuelve a plain INSERT, al menos una suite debe quedar roja.
10. Mantener `accepted_at` histórico sin sobrescribir.
11. **H09:** cuando y solo cuando H08/H14 estén realmente verdes, sincronizar ficha, bitácora y body. No decir “todos resueltos” antes.
12. Correr tests dirigidos + `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
13. Push normal, pasar SHA y pedir Ronda 6. No mergear.
