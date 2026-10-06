# Lecciones — PR #224

## Ronda 1

No se agrega un número AG nuevo. Los hallazgos refuerzan reglas ya existentes:

- **AG-37 — enumerar la clase completa:** el primer fallo del bootstrap de admin no debía cerrar el análisis. Al recorrer DoD 1 completo aparecieron además la precondición `matched` incompleta y el contrato incompatible de `LoginPage.login()`.
- **AG-68 / AG-70 — un RED escrito no prueba que haya ocurrido:** `Expected: true / Received: false` sin mutación ni nombre de test no permite reproducir qué control se puso rojo.
- **AG-71 — develop se vuelve a mirar en cada ronda:** la PR quedó 49 commits detrás y, precisamente, develop incorporó helpers canónicos para admin/MFA y estados de solicitudes que evitan duplicar precondiciones parciales.
- **AG-75 — la batería de mutaciones es de la revisión:** en la ronda de reparación no se considerará verificado un control solo porque el autor lo nombre; se reproducirán sus RED y se agregarán sondas independientes sobre el SHA corregido.

## Ronda 2

No se agrega número AG nuevo.

- **AG-37 vuelve a aplicar literalmente:** el gate mostró un copy viejo en el primer radio; barrer todos los selectores de DoD 1 encontró tres copies viejos adicionales antes de devolver el trabajo.
- **AG-70 se refuerza:** la bitácora decía «Salida GREEN real: evaluada en el gate» antes de que existiera el resultado; cuando el gate corrió, quedó RED. La salida se copia después de ejecutar, no se anticipa.
- **AG-71 vuelve a ser relevante:** entre la reparación y la revisión, develop avanzó 5 commits y T-334 cambió auth/guards. Un arreglo MFA no se cierra contra un árbol anterior al que se va a mergear.

## Ronda 3

No se agrega número AG nuevo.

- **No convertir un bloqueo de infraestructura en evidencia:** el autor hizo lo correcto al registrar el rate limit de Vercel y dejar M1–M4 pendientes en vez de fabricar RED/GREEN.
- **`arreglado-sin-verificar` existe para esto:** H03 y H05 parecen corregidos por inspección, pero sin ejecución independiente no pasan a verificados.
- **No generar commits inútiles mientras el gate no puede dispararse:** más pushes no aportan señal si Vercel rechaza el deployment antes de crear Preview.

## Ronda 4

No se agrega número AG nuevo.

- **AG-37 también aplica a los datos sintéticos:** no alcanza con enumerar selectors y estados; cada dato que el E2E inyecta debe respetar los contratos reales del producto.
- **Agujero de la revisión anterior:** R2/R3 miraron copy y MFA, pero no contrastaron `incidentDescription` con CC-012. El Preview real mostró que `testRunId` hace inválido el relato.
- **Baseline primero, mutaciones después:** una batería RED no aporta evidencia si el caso sano ya está rojo. H06 debe cerrarse antes de M1–M4.
- **AG-71 vuelve a aplicar:** develop avanzó con T-336 en auth/middleware mientras se esperaba el Preview; H03 debe revalidarse sobre el árbol actualizado.

## Ronda 5

No se agrega número AG nuevo.

- **AG-68 se refuerza con un caso concreto:** una mutación no cuenta si para volverla roja hay que cambiar también la expectativa. La propiedad tiene que estar protegida por el test final, no por un oráculo temporal.
- **P07 — coincidencia demasiado amplia:** un locator puede ser sintácticamente correcto y aun así comprobar el elemento equivocado. Un texto esperado que también aparece dentro de un campo libre necesita scope + match exacto.
- **Las mutaciones sirven también para auditar el oráculo:** M1 descubrió que el test final no distinguía el kind del contenido del relato. Eso es justamente la señal que la fase RED debía producir.
- **No repetir evidencia válida por rutina:** M2–M4 ya tienen RED reproducible y específico; corregir H07 solo exige repetir M1 y cerrar con GREEN final.


## Ronda 6

No se agrega número AG nuevo.

- **AG-68 queda satisfecha, no solo declarada:** M1 finalmente cambia únicamente la precondición y mata el test final sin tocar el oráculo.
- **El oráculo sensible debe sobrevivir al experimento:** el fix de H07 queda permanente; la mutación se revierte, la expectativa no.
- **La evidencia mínima también puede ser fuerte:** para cerrar H04 no fue necesario repetir M2–M4; se conservó la evidencia RED ya válida y se reprodujo únicamente la pieza defectuosa, M1.
- **Cierre con CI por dentro:** antes de mergear se comprobaron los conteos reales de unit, db-tests, build y E2E, no solo los badges.
