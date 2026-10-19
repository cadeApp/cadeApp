# Lecciones de la PR #425 para `AGENTS.md` y las reglas

**Fuente:** 4 hallazgos (2 verificados, 1 bloqueante abierto y 1 mejora). Datos crudos en
[`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

Los controles generales quedaron verdes, pero no podían certificar propiedades específicas del flujo: alcance canónico,
orden visible y la diferencia entre ausencia esperada del viaje y un fallo interno de lectura.

## Lecciones propuestas

No se propone modificar `AGENTS.md` por esta única PR. Las reglas existentes ya son explícitas:

- `revisar-pr` clasifica un archivo fuera de «Archivos permitidos» como bloqueante.
- Regla 00 dice que una ficha solo cambia cuando el cambio está aprobado en `develop`.
- Regla 40 exige demostrar que la prueba falla al romper la garantía.
- El contrato ya conserva códigos de error; el nuevo hallazgo aparece cuando una capa intermedia los colapsa antes de
  decidir qué estado de UI corresponde.

## Qué cambiar, en orden de impacto

1. Resolver PR425-H02 preservando la causa del error hasta la decisión de página y agregando un caso RED/GREEN de
   `INTERNAL_ERROR` con historial previo.
2. Cumplir los controles existentes: autorizar el alcance antes de usarlo y agregar oráculos de orden sensibles a
   inversión.
3. Si el colapso de resultados tipados reaparece en otra PR, proponer una regla/control común para que las queries no
   conviertan `INTERNAL_ERROR` en ausencia válida.
4. Si este patrón de ampliaciones escritas dentro de la misma rama reaparece en otra PR, evaluar un check automático
   que compare el diff con la ficha de `origin/develop`.

## Advertencias

- Esta PR consume una RPC ya cubierta por pgTAP; el hallazgo de orden no cuestiona el orden SQL, sino que la UI y su E2E no lo protegen ante una regresión propia.
- PR425-A01 no se corrige declarando nuevamente 5-B en la rama: la autorización debe ser efectiva en la fuente canónica o los cambios deben salir del diff.
- PR425-H02 se apoya en un solo caso de esta PR; se registra como AG-02, pero no justifica aún cambiar `AGENTS.md`.
