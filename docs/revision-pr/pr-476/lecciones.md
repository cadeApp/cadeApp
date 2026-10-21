# Lecciones — PR #476 / T-389

**Fuente:** PR476-H01, un pendiente de evidencia operativa; ningún defecto de código demostrado en ronda 1.

## Lección candidata (sin número AG)

**Nunca declarar en el body que un E2E ya tiene evidencia cuando la última bitácora todavía dice «pendiente».** En especial cuando varios Preview disparan ejecuciones en paralelo: `cancelled` es un resultado distinto de `failed` y de `success`. Para certificar una tarea visual, exigir run, SHA y prueba efectivamente ejercida.

No se propone cambiar `AGENTS.md` por un solo episodio ni alterar el CI hasta tener una repetición independiente y una causa concreta.

## Limitación de esta ronda

Sin clon local accesible, la inspección y los logs de GitHub no reemplazan mutaciones independientes RED→GREEN. Se conserva un harness completo propuesto en `evidencia/comandos.md` para un futuro revisor con clon; no se presenta como ejecutado.
