# PR #122 — T-205 — Ronda 2

**Fecha:** 2026-09-29  
**SHA revisado:** `2e3d6edad1fd127294e360288cd8857263c90948`  
**Resultado:** **CON BLOQUEANTES**

## Alcance y sincronización

- Se revisó únicamente el commit de arreglo posterior a la Ronda 1: `9ddfaf3d... -> 2e3d6eda...`.
- La rama está 0 commits behind y 5 ahead respecto de `develop`.
- La PR está abierta y no es Draft.
- La ficha autoritativa se volvió a leer desde `develop`; sus criterios no se sustituyen por la versión editada en la rama.
- No se inspeccionó CI final porque permanecen bloqueantes.
- No existe preview accesible mediante los proyectos Vercel conectados `cadeapp-staging` / `cadeapp`; ambos devuelven 0 deployments.
- No hubo checkout ejecutable independiente en este entorno; no se inventan resultados runtime.

## Revalidación de la Ronda 1

### PR122-H01 — arreglado sin verificar runtime

La inspección del SHA actual confirma:

- `MyOffersList`: los tres tabs pasaron de `min-h-10` a `min-h-12`.
- Se agregó una regresión específica en `my-offers-list.test.tsx`.
- `CourierFeed`: el estado no disponible pasó de `h3` a `h2`.
- Se agregó una regresión específica de jerarquía.
- Las animaciones directas enumeradas en Ronda 1 fueron retiradas de las siete superficies indicadas.

La bitácora documenta mutaciones RED/VERDE, pero el revisor no pudo ejecutarlas en un checkout independiente. Por la regla de verificación, el estado correcto es **arreglado-sin-verificar**, no `arreglado-verificado`.

### PR122-H02 — arreglado sin verificar runtime

La inspección confirma:

- el test central de targets fue renombrado/acotado a las superficies que realmente renderiza;
- el caso falso de code-splitting basado en `.toBeDefined()` fue eliminado;
- se agregaron regresiones específicas de `inputmode` en requests, offers, courier-onboarding y merchants.

De nuevo, las mutaciones declaradas por el autor no fueron ejecutadas independientemente por esta revisión. Estado: **arreglado-sin-verificar**.

### PR122-H03 — parcial y todavía bloqueante

Hubo una mejora correcta: la rama dejó de afirmar que axe está completo y puso la casilla combinada en `[ ]`.

Sin embargo, el cierre sigue siendo insuficiente:

1. **No hay resultados Lighthouse por superficie.**  
   La ficha exige performance >= 80 y accessibility >= 95 en:
   - crear solicitud;
   - detalle con ofertas;
   - lista del repartidor;
   - onboarding;
   - viaje.

   La bitácora no registra ningún par de puntajes. El body tampoco.

2. **La casilla de navegador sigue en `[x]` sin evidencia reproducible.**  
   `docs/tasks/T-205.md` mantiene como completo:
   - 390 px;
   - 360 px;
   - reduced motion;
   - teclado;
   - contraste;
   - sin scroll horizontal;
   - capturas comparativas Stitch/implementación.

   La bitácora solo dice de forma genérica que se verificaron las cinco superficies. No hay tabla por ruta, bounding boxes, orden de tabulación, resultado de overflow ni rutas/enlaces de capturas actuales.

3. **Las capturas citadas en el body son de T-116, no de T-205.**  
   En el árbol del SHA actual existen `src/features/merchants/evidence/T-116/` y `src/features/requests/evidence/T-116/`, pero no evidencia T-205 equivalente para las cinco superficies. T-205 cambió componentes después de T-116, por lo que esas capturas no demuestran el estado actual.

4. **La auditoría de `src/ui/**` sigue marcada `[x]` sin evidencia.**  
   La ficha exige auditar las primitivas; PR y bitácora no enumeran cuáles se revisaron ni el resultado.

5. **Axe sigue pendiente.**  
   Esto está correctamente reflejado con `[ ]`, pero mientras siga pendiente la tarea no cumple el DoD completo.

Por lo tanto H03 queda **parcial** y continúa bloqueando la aprobación.

### PR122-H04 — arreglado sin verificar runtime

La bitácora reemplazó `f7fe5dd` por `5ff0678` y la entrada activa usa `por commitear`. La corrección es visible por inspección.

---

## REGRESIONES NUEVAS

### PR122-R01 — Se reescribió el criterio autoritativo de axe

**Archivo:** `docs/tasks/T-205.md:30`  
**Severidad:** alta · conventions / scope  
**Patrón:** `P10-desvio-de-ficha-sin-consultar`

La ficha en `develop` dice:

`axe AA sin violaciones; objetivos de 48 px; ...`

La rama lo cambió por:

`axe AA pendiente (sin dependencias nuevas en T-205 según decisión de Lautaro073); ...`

La decisión 1-A fue **no incorporar dependencias nuevas al proyecto**. No autorizó a modificar el criterio de aceptación ni a sustituir “sin violaciones” por “pendiente”.

Aunque la casilla permanece `[ ]`, el texto de la ficha debe seguir siendo el original. El estado pendiente se documenta en la bitácora, no reescribiendo el DoD.

**Corrección:** restaurar exactamente la línea de `develop` y dejarla `[ ]` hasta producir axe + Lighthouse + resto del criterio.

---

### PR122-R02 — El test nuevo introduce non-null assertions prohibidas

**Archivo:** `src/features/offers/courier-panel.test.tsx:562` aprox.  
**Severidad:** media, pero bloqueante por regla raíz · conventions  
**Patrón:** `P03-comentario-contradice-codigo`

El test agregado contiene:

```ts
expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
```

`AGENTS.md` prohíbe `!` non-null assertions antes de pedir review. La misma bitácora del arreglo afirma “Cero `!`”, por lo que documentación y código se contradicen.

**Corrección segura:** iterar sin non-null assertions, por ejemplo leyendo `current` y `previous`, comprobando `undefined` explícitamente antes de restar.

No hace falta cambiar la lógica del test ni rebajar su aserción.

---

## Estado de aprobación

**No aprobar ni mergear todavía.**

Para pasar a una ronda aprobable deben ocurrir las tres cosas:

1. resolver R01 y R02;
2. completar H03 con evidencia real o mantener los ítems correspondientes en `[ ]`;
3. volver a revisión sobre un SHA nuevo, donde recién corresponde consultar CI final.
