# Lecciones — PR #376 / CC-025 Fase B

- **P08 / pr-63/AG-68 y AG-37:** verificar qué unicidad hay realmente en DB. `UNIQUE(storage_path)` no impide dos paths distintos del mismo kind. Un test Vitest que añade dos documentos con rutas iguales viola esa constraint y no simula un interleaving válido.
- **P05:** mismo resultado “idempotente” debe exigir los mismos estados válidos en todos los caminos de una acción; comparar path sin status acepta rejected indebidamente.
- **P08:** un SELECT luego de INSERT no serializa otras escrituras; no se vende como prueba de unicidad. Hacen falta transacción/lock/constraint bajo DB real.
- **Proceso:** green unit/db de CC previo no demuestra el invariante nuevo de onboarding B. Unit del autor 2374 en body no coincide con 2377 del job del HEAD exacto; citar logs de SHA.
- **Scope:** introducir RPC transaccional intermedia puede ser la solución más sostenible, pero requiere autorización expresa de ampliación de CC y no tocar schema ya aplicado a escondidas.


## Ronda 2

- Validación pura compartida entre caminos de lectura inicial, error y postINSERT reduce inconsistencia de status/path; H02/H03 cambiaron de abiertos a corregidos por inspección+CI, sin fingir RED independiente.
- Un lock en RPC protege a quienes invocan esa RPC, no necesariamente a escritor viejo o REST con políticas INSERT abiertas. El rollout de fases requiere analizar ambos actores antes de declarar unicidad global.
- Las compatibilidades deben probarse contra esquemas de transición: `is_current` en código nuevo exige migración A realmente aplicada. Se corrigió una frase falsa del body sin tocar implementación.


## Ronda 3
- E2E trusted es un estado de commit separado de CI principal y approval-policy. Validar el SHA real del checkout del job repository_dispatch, no el SHA default.
- Las fixtures de Storage deben respetar prefijo courier/<uid>/ sin fabricar éxito ni suprimir controles.
- El lock de autorización termina al COMMIT de la RPC; el UPDATE administrativo posterior debe repetir status y comprobar filas realmente afectadas.
- Un test unit con RPC mock valida la reacción del caller, no la serialización de DB; atribuirla al runner multisesión B0.
