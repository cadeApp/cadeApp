# Evidencia y comandos — PR #160 — Ronda 1

**SHA revisado:** `803632187079aab355b3cadb8d20477a50ef274d`

## Sincronización reproducible

```bash
git fetch origin
git rev-parse origin/feat/T-303-main-flow
git rev-parse origin/develop
git merge-base origin/develop origin/feat/T-303-main-flow
git diff --stat origin/develop...origin/feat/T-303-main-flow
git diff origin/develop -- docs/tasks/T-303.md
```

Valores observados al iniciar la ronda:
- head PR: `803632187079aab355b3cadb8d20477a50ef274d`
- base/merge-base: `9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- ahead: 2
- behind: 0
- archivos: `docs/tasks/T-303.md`, `docs/tasks/log/T-303.md`, `e2e/specs/main-flow.spec.ts`

## Enumeración de mocks que sustituyen la aplicación

```bash
git grep -n "route.fulfill" 803632187079aab355b3cadb8d20477a50ef274d -- e2e/specs/main-flow.spec.ts
git grep -n "page.route\|context.route" 803632187079aab355b3cadb8d20477a50ef274d -- e2e/specs/main-flow.spec.ts
git grep -n "stagingContext" 803632187079aab355b3cadb8d20477a50ef274d -- e2e/specs/main-flow.spec.ts
```

Resultado por inspección:
- hay `route.fulfill` para las pantallas principales;
- existe un mock para `**/api/offers/accept`;
- el spec no consume `stagingContext`.

## Enumeración de la falsa concurrencia

```bash
git show 803632187079aab355b3cadb8d20477a50ef274d:e2e/specs/main-flow.spec.ts | sed -n '69,129p'
```

Propiedad observada:
1. `acceptedCount` decide el 200/409;
2. `res1` se espera con `await`;
3. recién después se inicia `res2`.

Por lo tanto el test no produce dos operaciones simultáneas contra el backend.

## Enumeración completa de los flujos nominales

```bash
git show 803632187079aab355b3cadb8d20477a50ef274d:e2e/specs/main-flow.spec.ts | sed -n '133,357p'
```

Casos que deben revalidarse en la próxima ronda:
- publicación: fill + submit + efecto;
- oferta: valor menor al piso real + rechazo, valor válido + creación;
- retiro: click + confirmación + desaparición/estado;
- orden: default por documentación + cambio a precio + orden;
- pago: efectivo/cambio y transferencia;
- WhatsApp: href generado por la aplicación;
- viaje: retirar + confirmar entrega + estado final.

## Estado de ejecución de esta revisión

No se ejecutó `pnpm typecheck/lint/test` ni Playwright en esta ronda porque este entorno no dispone de un clon ejecutable del repositorio. No se inventa una salida GREEN ni una mutación runtime.

Los hallazgos H01-H05 quedan con `deteccion: analisis`. La próxima ronda debe reproducir las pruebas RED/GREEN del autor y sumar mutaciones independientes del revisor antes de marcar cualquier hallazgo como `arreglado-verificado`.

## Mutaciones obligatorias para la revalidación independiente

Estas son propiedades a probar; el harness concreto de la revisión siguiente debe guardarse completo aquí cuando pueda ejecutarse:

1. **Revelación:** mutar la app real para exponer el teléfono a un courier no aceptado. El E2E debe fallar.
2. **Concurrencia:** mutar la guarda real para permitir dos aceptaciones. El E2E concurrente debe fallar.
3. **Publicar:** impedir el submit/persistencia real. El flujo debe fallar.
4. **Piso:** permitir una oferta menor que `platform_settings.min_offer_ars`. El flujo debe fallar.
5. **Retirar:** convertir la acción de retiro en no-op. El flujo debe fallar.
6. **Ordenar:** invertir/ignorar uno de los criterios. El flujo debe fallar.
7. **Viaje:** convertir la transición de estado en no-op. El flujo debe fallar.

No se aceptan mutaciones sobre el HTML de prueba ni mocks que fabriquen el resultado esperado.
