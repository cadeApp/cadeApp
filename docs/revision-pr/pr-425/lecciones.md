# Lecciones de la PR #425 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Los controles generales quedaron verdes, pero no podían certificar dos propiedades específicas del DoD: el alcance canónico de la ficha y el orden visible con más de un evento.

## Lecciones propuestas

No se propone modificar `AGENTS.md` por esta única PR. Las reglas existentes ya son explícitas:

- `revisar-pr` clasifica un archivo fuera de «Archivos permitidos» como bloqueante.
- Regla 00 dice que una ficha solo cambia cuando el cambio está aprobado en `develop`.
- Regla 40 exige demostrar que la prueba falla al romper la garantía.

## Qué cambiar, en orden de impacto

1. Cumplir los controles existentes: autorizar el alcance antes de usarlo y agregar un oráculo de orden sensible a inversión.
2. Si este patrón de ampliaciones escritas dentro de la misma rama reaparece en otra PR, evaluar un check automático que compare el diff con la ficha de `origin/develop`.
3. Si vuelve a aparecer una cronología sin mutación de orden, evaluar una receta común de pruebas para listas keyset.

## Advertencias

- Esta PR consume una RPC ya cubierta por pgTAP; el hallazgo de orden no cuestiona el orden SQL, sino que la UI y su E2E no lo protegen ante una regresión propia.
- PR425-A01 no se corrige declarando nuevamente 5-B en la rama: la autorización debe ser efectiva en la fuente canónica o los cambios deben salir del diff.
