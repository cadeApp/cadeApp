# Evidencia y comandos reproducibles — PR #275

## Ronda 3 — reproducción de H04

Evidencia aportada por la bitácora y contrastada con el código:

```bash
pnpm test
# exit=1
# Tests 3 failed | 1918 passed (1921)
```

Repetido dos veces con el mismo patrón.

Diagnóstico de la carrera:

```bash
pnpm vitest run --exclude src/server/rpc/cc007.test.ts
```

Con `cc007.test.ts` fuera, los fallos de `guards.test.ts` desaparecen.

El patrón peligroso inspeccionado en `src/server/rpc/cc007.test.ts` es:

```ts
fs.writeFileSync(filePath, mutated, 'utf8');
spawnSync('pnpm', testArgs, ...);
...
fs.writeFileSync(filePath, original, 'utf8');
```

Eso modifica el checkout compartido mientras Vitest ejecuta otros archivos.

## Patrón de arreglo exigido para cc007.test.ts

- Crear un **git worktree temporal y detached** dentro del helper de mutaciones.
- Las llamadas de mutación deben resolver `filePath` contra ese worktree, nunca contra `process.cwd()` del checkout principal.
- Ejecutar el Vitest hijo con `cwd` igual al worktree temporal.
- Reusar el worktree para las mutaciones del bloque si resulta práctico y eliminarlo en `afterAll`.
- No modificar `guards.ts`, `queries.ts`, `actions.ts` ni la migración en el checkout principal.
- Mantener las mismas expectations: la mutación tiene que producir exit != 0 y salida FAIL/failed.
- No usar `.skip`, locks globales ni `fileParallelism: false` como parche.

## Patrón de arreglo exigido para verify-scaffold.test.ts

- Construir una tabla/objeto con todos los paths actualmente usados por el archivo.
- En `beforeAll`, llamar **una sola vez** a `eslint.lintFiles([...paths])`.
- Guardar los resultados en un `Map` indexado por `path.resolve(result.filePath)`.
- Cada `it` obtiene su resultado desde ese Map y conserva las assertions existentes.
- No aumentar timeout del test ni timeout global.

## GREEN requerido

```bash
pnpm vitest run src/server/rpc/cc007.test.ts src/features/auth/guards.test.ts
pnpm vitest run tools/verify-scaffold.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm test
```

Las dos últimas corridas completas deben terminar con exit 0 de manera consecutiva.
