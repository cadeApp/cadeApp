# Lecciones de la PR #425 para `AGENTS.md` y las reglas

**Fuente:** 5 hallazgos (4 verificados y 1 bloqueante abierto). Datos crudos en
[`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Los controles generales quedaron verdes, pero no podían certificar propiedades específicas del flujo: alcance canónico,
orden visible y la diferencia entre ausencia esperada y fallos internos en dos lecturas paralelas.

## Lecciones propuestas

No se propone modificar `AGENTS.md` por esta única PR. Las reglas existentes ya son explícitas:

- `revisar-pr` clasifica un archivo fuera de «Archivos permitidos» como bloqueante.
- Regla 00 dice que una ficha solo cambia cuando el cambio está aprobado en `develop`.
- Regla 40 exige demostrar que la prueba falla al romper la garantía.
- Los contratos ya conservan códigos de error; H02 apareció cuando una query los colapsó y H04 cuando el consumidor
  agrupó todos los resultados fallidos antes de decidir qué estado de UI correspondía.

## Qué cambiar, en orden de impacto

1. Resolver PR425-H04 preservando también la causa del error del historial hasta la decisión del fallback del
   repartidor, con RED/GREEN de página para `NOT_FOUND` e `INTERNAL_ERROR`.
2. Cumplir los controles existentes: autorizar el alcance antes de usarlo y agregar oráculos de orden sensibles a
   inversión.
3. Si el colapso de resultados tipados reaparece en otra PR, proponer una regla/control común para que queries y
   consumidores no conviertan `INTERNAL_ERROR` en ausencia válida.
4. Si este patrón de ampliaciones escritas dentro de la misma rama reaparece en otra PR, evaluar un check automático
   que compare el diff con la ficha de `origin/develop`.

## Advertencias

- Esta PR consume una RPC ya cubierta por pgTAP; el hallazgo de orden no cuestiona el orden SQL, sino que la UI y su E2E no lo protegen ante una regresión propia.
- PR425-A01 no se corrige declarando nuevamente 5-B en la rama: la autorización debe ser efectiva en la fuente canónica o los cambios deben salir del diff.
- H02 y H04 son dos manifestaciones dentro de la misma PR; AG-02 todavía no justifica cambiar `AGENTS.md` sin evidencia
  de otra PR, pero sí exige revisar cada resultado paralelo por código y no solo por `ok`.
