# Lecciones — PR #359
Ronda 1: decisiones de arquitectura cerradas.
Ronda 2: tests de Realtime inicialmente probaban invalidación manual; cobertura reforzada en ronda 3 con callbacks reales. La presencia de E2E escrito no acredita ejecución remota.
Ronda 3: un localizador compuesto por elementos que no existen en el DOM real (+ fallback a .first()) da falsa sensación de determinismo. Hay que usar identidad del fixture, elemento semántico real y prohibir fallback de selección del primer actor. P08.
No proponer regla AG-xx adicional sin reproducción de mutación independiente y análisis de patrón multi-PR. Ningún RED/GREEN independiente ejecutado por el revisor en estas rondas.