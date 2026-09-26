# Lecciones de la PR #98

## Ronda 4

### Un mock de INSERT no prueba constraints reales de la DB

H13 muestra que un unit test puede afirmar un payload inválido y quedar verde porque el mock nunca ejecuta la PK real. Cuando un contract-change modifica precondiciones compartidas, hay que revisar los writes posteriores contra constraints reales.

### Consentimientos deben ser idempotentes en reintentos

Persistir evidencia antes de otros pasos del onboarding es válido, pero reintentar no puede fallar por volver a aceptar la misma versión. La clave `profile_id + document + version` permite un write idempotente que preserve el timestamp original.

### Axe no es sinónimo de un checker estructural propio

Un auditor DOM interno suma cobertura, pero no sustituye una exigencia explícita de axe. Si el DoD pide capturas y axe, deben existir artefactos reproducibles asociados al SHA.

No se propone una regla AG nueva: AG-61/63 y AG-70 ya cubren test efectivo y evidencia verificable.
