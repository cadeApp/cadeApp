# Lecciones — PR #376 / CC-025 Fase B

- **P08 / pr-63/AG-68 y AG-37:** verificar qué unicidad hay realmente en DB. `UNIQUE(storage_path)` no impide dos paths distintos del mismo kind. Un test Vitest que añade dos documentos con rutas iguales viola esa constraint y no simula un interleaving válido.
- **P05:** mismo resultado “idempotente” debe exigir los mismos estados válidos en todos los caminos de una acción; comparar path sin status acepta rejected indebidamente.
- **P08:** un SELECT luego de INSERT no serializa otras escrituras; no se vende como prueba de unicidad. Hacen falta transacción/lock/constraint bajo DB real.
- **Proceso:** green unit/db de CC previo no demuestra el invariante nuevo de onboarding B. Unit del autor 2374 en body no coincide con 2377 del job del HEAD exacto; citar logs de SHA.
- **Scope:** introducir RPC transaccional intermedia puede ser la solución más sostenible, pero requiere autorización expresa de ampliación de CC y no tocar schema ya aplicado a escondidas.
