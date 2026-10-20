# Lecciones — PR #457 / T-386

Dos patrones existentes reaparecen por inspección, sin mutaciones propias ejecutadas todavía.

- **P01 / validación SQL de JSONB:** `->>` textualiza números y booleanos. El servidor SQL debe validar `jsonb_typeof` explícitamente antes de regex para cumplir el contrato, independientemente del wrapper y del fake.
- **P08 / el oráculo mide un proxy:** dos auditorías y dueño final B no demuestran que la segunda transición auditó A→B. Las carreras sobre ownership necesitan inspeccionar `before` y `after` fila por fila, y mutar el lock concreto.

**No se asigna AG nuevo** hasta reproducir RED independiente y reconciliar la numeración global de todas las ramas. El hallazgo menor H03 es una asociación de comentario incorrecta. No tocar AGENTS.md ni catálogo global en esta ronda.

**Siguiente revisión:** comprobar el RED de datos JSON no textuales y del mutante sin `FOR UPDATE`, y verificar el GREEN del mismo SHA tras restaurar el código.
