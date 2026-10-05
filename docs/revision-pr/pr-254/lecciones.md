# Lecciones de la PR #254 para `AGENTS.md` y las reglas

**Fuente:** 4 hallazgos de la ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

El E2E fue escrito como "best effort": si un elemento no está, se omite; si una transición UI no funciona, se reemplaza por navegación/RPC directa. Eso produce controles verdes que prueban precondiciones o efectos laterales, no el flujo que nombran.

## Lecciones propuestas

No se agrega una AG nueva en esta ronda. Los cuatro casos ya están cubiertos por patrones existentes:

- **P04-test-tautologico:** un camino condicional sin aserción positiva puede pasar sin ejecutar la conducta.
- **P08-control-no-cubre-lo-que-dice:** UNIQUE + boolean local no prueban la deduplicación de la action; un courier ya aprobado no prueba onboarding.
- **AG-37:** al encontrar el primer `if (isVisible)` se barrió la clase completa antes de cerrar la ronda.
- **AG-76 (analogía):** una ausencia/negativa no alcanza; el control debe afirmar la acción positiva que la arquitectura promete.

## Qué cambiar, en orden de impacto

1. Hacer obligatorias las interacciones UI y eliminar fallbacks que ejecutan la transición por otra vía.
2. Preparar estados iniciales que representen el escenario real bajo prueba.
3. Mantener la misma sesión de autenticación cuando el invariante depende de AAL/MFA.
4. Para cada arreglo, demostrar una mutación que rompa exactamente esa propiedad y haga fallar el E2E corregido.

## Advertencias

- Esta PR es una tarea puramente E2E: sustituir UI por llamadas directas tiene más impacto que en un test de integración común.
- No se propone tocar fixtures compartidos ni producción; la ficha permite resolver los cuatro hallazgos dentro del spec.