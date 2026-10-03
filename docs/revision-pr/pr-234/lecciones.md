# Lecciones de la PR #234

**Fuente:** 2 hallazgos, 6 rondas.

## Patrón dominante

H01 fue `P08-control-no-cubre-lo-que-dice`. El cierre exigió modelar el gate como una cadena completa: trigger → contexto global → job → steps → script bloqueante.

## Lecciones

- Una línea correcta no demuestra que se ejecute.
- Una blacklist no sustituye una estructura permitida.
- Una allowlist del job no cubre defaults heredados.
- Una allowlist top-level no cubre por sí sola la semántica del trigger.
- Para gates pequeños de seguridad, la combinación más robusta es allowlist estructural + mutaciones independientes + CI real.

## Resultado final

R6 integra T-333 corregida y deja todo el CI GREEN. No se propone AG nuevo; P08 y AG-75 ya cubren la lección general.
