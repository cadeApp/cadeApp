# Lecciones PR #333

- P05: una rama de idempotencia «que parece validar» puede continuar a `raise` incondicional, incluso cuando fake y TypeScript pasan. Exigir la misma semántica en SQL real que en fake y tests postestado.
- P08: las guardas PL/pgSQL usan variables declaradas NULL hasta asignación; probar autoAssign=true con precio válido y negativo sin precio, con oráculo SQL real.
- La cobertura 90% es un invariante por archivo que puede fallar aunque 2141 tests estén verdes. No reducir threshold; agregar ramas de negocio y mutaciones RED útiles.
- Un único caso de rollback al validar zona ANTES de insertar no demuestra rollback ante error DESPUÉS de insertar contactos/drops o publish. Injectar fallos deliberadamente en fases reales y verificar cero filas en todas las tablas.
- No manipular tipos generados para pasar typecheck: CI con base efímera debe producir y verificar output de `pnpm db:types --local`.
- User authorized runner de concurrencia CC-024 propio, no reuso indiscriminado de `t340_concurrency.mjs`; documentar la autorización en la ficha y preservar el resto de CI.
- Sin número AG nuevo asignado: no se consultó el máximo de TODAS las ramas remotas y no se inventa número.
- JSONB `->>` compara texto, no tipos: consentimiento debe requerir JSON literal true (P08).
- Permutar etiquetas `holderFirst` no demuestra órdenes distintos de ganador SQL. Exigir payload y actor persistidos que permitan detectar qué actor realmente ganó el lock (P08).
- `setTimeout` para esperar COMMIT es sleep-oráculo: confirmar COMMIT con marcador devuelto por psql y cero errores (P08).
- Construir campo audit en un helper y no afirmarlo deja un hueco de control aunque tests pasen (P08).
- Sin número AG nuevo al no verificar máximo global en todas las ramas; no inventar secuencias.
