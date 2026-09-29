# PR #122 — T-205 — Ronda 1 vigente

**Fecha:** 2026-09-29  
**SHA revisado:** `5ff06783a0b70558c03d05d91c9b55dd7d1c2b3a`  
**Resultado:** **CON BLOQUEANTES (3)** · **1 mejora**

> Por decisión de Lautaro073, la revisión que antes ocupaba “Ronda 1” queda descartada. Esta revisión parte de cero sobre el HEAD actual y reemplaza esos artefactos; no arrastra hallazgos anteriores por defecto.

## Alcance y estado

- `develop` y la rama comparten merge-base `ae514947...`; la rama está 3 commits ahead y 0 behind.
- La PR ya no es Draft.
- Se leyó la ficha autoritativa desde `develop`. En el HEAD de la PR, `docs/tasks/T-205.md` cambia todos los ítems del DoD de `[ ]` a `[x]`.
- Los archivos funcionales cambiados están dentro de la lista permitida de T-205.
- No se consultó CI para aprobar: existen bloqueantes y el procedimiento reserva CI final para una ronda aprobable.
- El entorno del revisor no permite checkout/ejecución local; los hallazgos se sostienen con inspección reproducible del SHA exacto y no se inventa evidencia runtime.

## BLOQUEANTES

### PR122-H01 — La pasada de accesibilidad no está terminada

**Severidad:** alta · accesibilidad / correctness  
**Archivos principales:**  
- `src/features/offers/components/my-offers-list.tsx:80-107`
- `src/features/offers/components/courier-feed.tsx:130-156`
- superficies con `animate-*` enumeradas en evidencia.

La ficha oficial exige objetivos de 48 px, axe AA sin violaciones y verificación de `prefers-reduced-motion` en las pantallas clave. El HEAD marca esos ítems como completados, pero todavía contiene incumplimientos concretos:

1. **Targets < 48 px en una pantalla de repartidor real.**  
   `/courier/offers` renderiza `MyOffersList`. Sus tres tabs de estado siguen con `min-h-10` en líneas 83, 94 y 105, es decir, 40 px de altura mínima. La pasada no los incluyó.

2. **Jerarquía de headings aún inválida en la lista del repartidor.**  
   `CourierFeed` presenta un `h1` en línea 130 y, cuando el repartidor no está disponible, el siguiente heading del estado es un `h3` en línea 154. Sigue existiendo un salto `h1 -> h3` en una de las cinco superficies que el DoD obliga a auditar.

3. **Reduced motion no está resuelto de forma general.**  
   La Regla 60 indica que las animaciones deben pasar por `src/ui/motion` y respetar la preferencia del usuario. `globals.css` no contiene una regla global que desactive Tailwind animations bajo `prefers-reduced-motion`. Sin embargo, las superficies auditadas mantienen clases directas como:
   - `courier-feed.tsx:136` — `animate-ping`
   - `create-request-form.tsx:296,390` — `animate-spin`
   - `identity-form.tsx:278` — `animate-spin`
   - `vehicle-form.tsx:336,374,472` — `animate-spin`
   - `status-view.tsx:42` — `animate-pulse`
   - `trip-merchant-view.tsx:92` — `animate-pulse`
   - `courier/profile/notifications/page.tsx:12` — `animate-pulse`

**Por qué los checks actuales no lo detectan:** el test central de targets solo renderiza `CreateRequestForm` y `RequestOffersList`; el test de headings solo renderiza `TripMerchantView`; no existe un control real de reduced-motion en esa suite.

**Corrección esperada:** ampliar la pasada a las superficies omitidas, llevar los tabs de `MyOffersList` a 48 px, corregir `CourierFeed` a una jerarquía continua y eliminar/reemplazar las animaciones crudas por comportamiento compatible con reduced motion sin editar `src/ui/**`.

---

### PR122-H02 — La suite DoD contiene controles de falso verde

**Severidad:** alta · testing / test-coverage  
**Archivo:** `src/features/requests/dod-t205.test.tsx`  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

La Regla 40 exige que toda prueba nueva pueda fallar al romper deliberadamente la regla que protege. La suite actual no cumple ese requisito en varios puntos:

- **Targets:** el test se llama “Objetivos táctiles ... en todas las superficies clave”, pero `interactiveContainers` solo contiene `CreateRequestForm` y `RequestOffersList`. Si se deja `MyOffersList` en 40 px, la prueba sigue verde; de hecho eso ocurre en el HEAD revisado.
- **Inputmode:** el test se llama “Todos los inputs numéricos o de teléfono”, pero los selectores de líneas 196-197 solo inspeccionan teléfonos en dos formularios. Quitar `inputMode="numeric"` del monto de `OfferSheet` o del DNI de `IdentityForm` no afectaría ese test.
- **Bundle/code splitting:** el test “Arquitectura de carga diferida y aislamiento de bundle” solo importa módulos y hace `.toBeDefined()` sobre cuatro exports. Reemplazar `dynamic()` por imports estáticos mantendría esos exports definidos y el test seguiría verde. Por lo tanto no prueba carga diferida ni presupuesto de bundle.

**Corrección esperada:** mover las regresiones concretas a las suites de sus componentes y demostrar las mutaciones RED. El presupuesto de bundle debe verificarse con el build canónico y `check-bundle-budget.mjs`; no debe sustituirse por un `toBeDefined()` que no observa el aislamiento.

---

### PR122-H03 — DoD cerrado sin la evidencia obligatoria de navegador, axe y Lighthouse

**Severidad:** alta · evidencia / aceptación  
**Archivos:** `docs/tasks/T-205.md:30-35`, `docs/tasks/log/T-205.md:15-33`, body de PR.

La ficha en `develop` requiere explícitamente:

- axe AA sin violaciones;
- Lighthouse móvil **rendimiento >= 80** y **accesibilidad >= 95** en crear solicitud, detalle con ofertas, lista del repartidor, onboarding y viaje;
- navegador a 390 y 360 px;
- reduced motion, teclado, contraste, ausencia de scroll horizontal;
- capturas comparativas Stitch/implementación.

En el HEAD, esos ítems aparecen `[x]` y la bitácora dice `Falta: nada para T-205`. Sin embargo, ni la bitácora, ni el body, ni los comentarios actuales de la PR contienen:

- puntajes Lighthouse por cada una de las cinco pantallas;
- salida de una auditoría axe AA real;
- resultados 390/360;
- evidencia de teclado/foco, contraste y overflow;
- evidencia de `prefers-reduced-motion`;
- enlaces o rutas a las capturas comparativas exigidas.

CI tampoco ejecuta Lighthouse, axe ni esa verificación de navegador: sus jobs cubren typecheck, lint, tests, DB, build y bundle budget. Además H01 demuestra que dos criterios marcados como completados todavía tienen defectos actuales.

**Corrección esperada:** volver a `[ ]` los ítems que todavía no estén demostrados, ejecutar la verificación real y recién entonces marcarlos `[x]`. Si axe no puede ejecutarse realmente sin agregar una dependencia —T-205 prohíbe dependencias nuevas— debe quedar explícitamente pendiente; no reemplazarlo por un test semántico parcial ni por Lighthouse.

---

## MEJORA

### PR122-H04 — La bitácora apunta a un commit inexistente

`docs/tasks/log/T-205.md:33` registra:

`f7fe5dd (feat(T-205): ...)`

La API de GitHub no resuelve ese SHA en el repositorio. El commit funcional visible y revisado es `5ff06783a0b70558c03d05d91c9b55dd7d1c2b3a`.

No bloquea por sí solo el producto, pero debilita la trazabilidad de la evidencia. Al cerrar la próxima sesión no se debe inventar/autorreferenciar un SHA: usar el commit real conocido o dejar `por commitear` hasta que exista.

## Lo que sí quedó bien en esta revisión

- Se eliminó el require privado de axe del test.
- Los campos telefónicos revisados ya declaran `inputMode="tel"`.
- Los campos numéricos inspeccionados actualmente sí tienen `inputMode="numeric"`: cambio en CreateRequestForm, monto de OfferSheet y DNI de IdentityForm.
- Los targets corregidos en CreateRequestForm, RequestOffersList, OfferSheet y uploads de VehicleForm están en 48 px.
- El switch de CourierProfileView **sí** tiene un wrapper táctil `min-h-12 min-w-12`; el track interno de 24×44 no se considera un hallazgo.
- `src/ui/button.tsx` y `src/ui/bottom-nav.tsx`, leídos desde develop, ya establecen targets base de 48 px y no fueron editados por T-205.

## Estado

**No aprobar ni mergear todavía.** Corregir H01-H03, completar evidencia real y volver a revisar un SHA nuevo.
