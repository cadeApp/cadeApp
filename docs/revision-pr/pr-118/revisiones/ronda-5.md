# Ronda 5 — PR #118 · T-206

**SHA revisado:** `f53d8856b99c359d14982a7ceee5ff905115c04a`  
**Resultado:** **CON BLOQUEANTES**

## Delta

Desde la Ronda 4 hay un único commit del autor y solo modifica `docs/tasks/log/T-206.md`. No hay cambios nuevos de producto ni del autor en `docs/revision-pr/**`.

La rama está sincronizada: **0 behind / 13 ahead** respecto de `develop`.

## H05-R4

### merchant_id ausente

La bitácora reproduce una mutación válida:
- se retira `!reqRes.data?.merchant_id`;
- el test específico falla porque se envía push al courier aunque la request no pudo resolverse;
- el fallo observable es `safeNotifyPostTransition` llamado indebidamente.

La evidencia es coherente con la implementación inspeccionada.

### offersRes.data == null

La bitácora también reporta honestamente que retirar solo `offersRes.data == null` **no pone el test en rojo**. El `for...of null` produce una excepción interna, pero el `catch` best-effort del bloque de notificación la absorbe; por eso el resultado de negocio sigue exitoso y no hay push.

Esto significa que existen **dos defensas redundantes** para la propiedad pública:
1. la guarda explícita de `data == null`;
2. el catch best-effort.

No corresponde adulterar el test para hacerlo fallar ni considerar el TypeError capturado como RED. Tampoco corresponde exigir que quitar una sola defensa rompa la propiedad si la segunda todavía la conserva.

Para cerrar la prueba nueva, la siguiente mutación de revisión debe romper la propiedad observable sin tocar el test:
- retirar temporalmente la guarda `offersRes.data == null`;
- en el catch interno del branch `cancel_request`, re-lanzar temporalmente el error;
- ejecutar solo el test `offers devuelve data: null sin error`.

Con ambas defensas temporalmente desactivadas, el test debe fallar en `result.ok === true` porque el TypeError llega al catch externo y se transforma en error de wrapper. Ese RED demuestra la propiedad real: una anomalía post-commit no puede degradar el resultado exitoso de negocio.

Después se revierten **ambas** mutaciones y se confirma GREEN. No se modifica el test, sus mocks ni expectativas.

## CI

Run exacto del SHA revisado: `36466803301`.

```text
Test Files 93 passed (93)
Tests      1280 passed (1280)
verify-workflows # tests 22
verify-adr       # tests 6

DB:
All tests successful.
Files=12, Tests=1601
Result: PASS
```

Todos los jobs completaron success.

## M02

El body conserva `Run 36465838994`, que pertenece al commit de revisión `4afa194...`, no al SHA actual. Los conteos coinciden, pero la evidencia debe apuntar al run del SHA que se está cerrando.

## M03

El body contiene:
`Resultado: SIN BLOQUEANTES`
dentro del informe generado por Kira.

Eso contradice el estado independiente vigente y además incumple la instrucción explícita de Ronda 4 de no autofirmar cierre antes de la siguiente revisión. Mientras H05-R4 siga abierto, debe decir `PENDIENTE REVISIÓN INDEPENDIENTE` o `CON BLOQUEANTES`.

## Lecciones

No se crea una lección AG nueva: esta ronda reutiliza la regla ya existente de mutación semántica (pr-63/AG-70) y evidencia reproducible (pr-63/AG-68). La diferencia importante es que dos defensas redundantes requieren romper la **propiedad**, no forzar que cada defensa individual sea indispensable.
