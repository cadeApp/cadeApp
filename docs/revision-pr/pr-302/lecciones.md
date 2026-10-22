# Lecciones de la PR #302 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, ambos cerrados en ronda 2. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

En RLS, una prueba negativa debe usar exactamente la frontera de identidad que declara proteger. «No puedo insertar la fila de otro» no demuestra «no puedo insertar mi propia fila».

## Lecciones propuestas

No se agrega una regla global nueva.

- H01 reutiliza **P08 — control no cubre lo que dice**.
- H02 reutiliza **P15 — entregable declarado pero no ejecutable/demostrado**.

La regla existente de demostrar RED fue suficiente: al aplicarla al caso 24b, el defecto de sensibilidad quedó expuesto y corregido.

## Qué funcionó en la corrección

1. Se cambió el test para ejercer INSERT self real.
2. La mutación aislada modificó únicamente la policy de producción, no el test.
3. El RED fue discriminante: `caught: no exception`, `wanted: 42501`.
4. La rama de mutación se cerró sin mergear y la rama real mantuvo GREEN.

## Advertencias

- La PR es pequeña y centrada en RLS; no generalizar una nueva AG por un solo caso.
- La migration productiva ya era correcta en ronda 1; el hallazgo estaba en la capacidad del test para detectar regresiones futuras.
