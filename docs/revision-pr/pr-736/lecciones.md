# Lecciones — PR #736 / ronda 1

**No se reserva un AG nuevo.** Este caso refuerza lecciones existentes sin disputar numeración global de ramas remotas.

- **pr-56/AG-37 — enumerar la clase entera:** no alcanza comprobar un UPDATE restringido si el callback acumula INSERT/UPDATE de dos IDs para cuatro actores. Hay que **recorrer toda la colección** después de la barrera y ventana, incluidos eventos tardíos y los opcionales.
- **pr-68/AG-75 — batería independiente del autor:** el test real pasó, pero seis eventos/errores adversos aislados en simulador muestran que las expectativas actuales no están completas. La revisión agrega mutaciones propias al oráculo, sin tocar Develop ni fingir una fuga real.
- **pr-63/AG-68 / pr-62/AG-60 — contrastar evidencia con propiedades:** un log correcto del run demuestra privacidad observada, no que fallaría por todas las variantes de fuga. El control S exige ambas columnas y ambos valores para evitar verde parcial; no solo notes.
- **pr-56/AG-34 — negativos de autorización:** para `anon` el resultado de PostgREST esperado aquí es `42501` (CC-023). Tratar `500`, `42501` y una lista realmente vacía como el mismo `[]` borra el oráculo.
- **Control de cleanup:** `finally` tiene que verificar la restauración y garantizar que **todos** los canales se intentaron remover, incluso ante un error. Una prueba de limpieza solo por ruta exitosa no certifica aislamiento en Develop.

No agregar reglas de `AGENTS.md` con una sola PR. Se debe comprobar RED de los oráculos corregidos mediante un harness local real de sus funciones; los payloads artificiales del harness NO equivalen a una fuga capturada por Realtime.
