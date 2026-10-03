# Lecciones de la PR #234 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 5 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

H01 fue una instancia prolongada de `P08-control-no-cubre-lo-que-dice`. La revisión tuvo que ampliar el modelo de amenaza por capas hasta cubrir la cadena completa que determina si el audit realmente se ejecuta y bloquea.

## Lecciones

No se asigna AG nuevo.

- presencia textual no prueba ejecución;
- blacklist parcial no prueba estructura;
- allowlist del job no prueba contexto heredado;
- allowlist top-level no prueba el contenido semántico del trigger;
- para gates pequeños y críticos, conviene fijar por allowlist la estructura completa relevante y después probar mutaciones desde capas externas hacia internas.

## Resultado

R5 cierra H01 con diez mutaciones independientes RED y evidencia de CI real. H02 permanece cerrado.

## Bloqueo externo

T-333 rompe `verify-fichas` en la base. No forma parte de esta PR y debe corregirse por separado antes de que el DoD de T-332 pueda marcar CI GREEN.
