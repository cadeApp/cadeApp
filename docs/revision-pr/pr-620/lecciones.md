# Lecciones — PR #620

No se numera AG nuevo sin corroborar el máximo de **todas** las ramas remotas; no inventar correlativos.

- **P08 — enumerar la clase entera (pr-56/AG-37):** en promesas de componentes controlados, revisar desmontaje, remontaje, borrado (null), ediciones del query, GPS y respuestas tardías; testear solo ids viejos no cubre todo.
- **P05 — test contrario al contrato:** «no consulta» no implica «termina»; el test de query vacía refuerza un error del DoD.
- **P01 — dependencia parcial:** API general disponible no implica biblioteca opcional lista; modelar no-resolve y timeout, no solo reject de geocode.
- **Disciplina:** mutaciones del autor no son las de revisión (pr-68/AG-75). No completar `verificado_en_sha` con inspecciones ni por un CI genérico.
- **Privacidad:** issue #619 es checkpoint humano previo al rollout; la excepción interna de CC-045 no reemplaza aviso versionado.

## Ronda 2
- **Secuencias cíclicas:** los tests A→B deben continuar hasta B→A y volver a ejecutar la acción inicial. Un `lastQuery` que se conserva mientras se invalida el estado derivado produce una trampa de deduplicación: la prueba simple de invalidación pasa (PR620-H07).
- **Estado persistido vs estado visual:** un test que verifica coords `null` en RHF no garantiza que `MapPicker` deje de dibujar el marcador anterior, especialmente cuando `defaultZoneCenter` es null (PR620-H08).
- **Tests medibles:** el agente documentó R11 primero verde y después rojo al agregar cobertura, práctica correcta de reconocer un agujero de test. La revisión sigue requiriendo una batería independiente y no firma como verificadas las mutaciones del autor.
