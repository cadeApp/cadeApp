# Informe de revisión — PR #455 / T-385

**PR:** https://github.com/cadeApp/cadeApp/pull/455  
**HEAD revisado:** `cffb9ff62d98eba993a2e14124afa639cdce709a`  
**Base:** `develop` @ `03dec5b074e634d6f3895c282e58f7d7e6eb4456`  
**Fecha:** 2026-10-20  
**Resultado:** CON BLOQUEANTES (2)  
**Método:** inspección independiente de archivos completos/patches y contraste con la ficha T-385 de `develop`, CC-034 y logs CI del SHA. No hubo clon local disponible; no se atribuyen ejecuciones locales ni mutaciones propias no ejecutadas.

## Resumen

| ID | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR455-H01 | Medio · bloqueante de contrato | `src/domain/testing/rpc-fake.ts:3118` | El fake fuerza `available=false` mientras la SQL deja `available` intacto | Análisis |
| PR455-H02 | Medio · bloqueante de cobertura DoD | `supabase/tests/cc034_admin_reinstate_courier.sql:302` | Idempotencia solo verifica respuesta y auditoría, no ausencia de UPDATE | Análisis |

## PR455-H01 — El fake altera disponibilidad contra el contrato

**Diagnóstico:** `src/domain/testing/rpc-fake.ts` fija `courier.available = false` al reactivar. La SQL en `supabase/migrations/20261020113000_cc034_admin_reinstate_courier.sql:55-61` solo actualiza `status`, `decided_at`, `decided_by`, `deactivated_at`. CC-034 exige expresamente que `available` no se toque. Aunque la ruta habitual comienza en `false`, un fake debe implementar el contrato para todo estado permitido. Los únicos fixtures nuevos arrancan con `available=false`, ocultando la divergencia.

**Evidencia:** [ANÁLISIS] Comparación literal de los dos cuerpos en `cffb9ff62d98eba993a2e14124afa639cdce709a`. **No** fue ejecutado el test RED en este entorno.

**Arreglo:** eliminar únicamente la asignación `courier.available = false` en `admin_reinstate_courier`. En `src/domain/cc034-admin-reinstate-courier.test.ts`, sembrar un rechazado con `available: true`, llamar al fake y afirmar que `available` permanece `true`, junto con `status=approved`. Mantener cobertura del suspendido normal con disponibilidad `false`.

**Prueba/mutación:** la nueva prueba debería quedar RED con la implementación actual, GREEN al eliminar esa asignación; como control negativo, reintroducir temporalmente la línea debe poner la **misma** prueba en RED. No alterar expectations ni inventar mocks de producción.

## PR455-H02 — La ruta idempotente no está protegida contra un UPDATE físico

**Diagnóstico:** CC-034 exige que `approved` retorne `idempotent: true` **sin UPDATE ni auditoría**. El pgTAP comprueba respuesta y recuento de auditoría, pero ninguna prueba observa si la fila de `couriers` fue físicamente actualizada. Un cambio del tipo `UPDATE couriers SET available = available` antes del `return` podría conservar las aserciones y violar la regla de no escritura.

**Evidencia:** [ANÁLISIS] SQL correcto en la migración actual: el `return` está antes del `update`. Hueco de cobertura detectado al enumerar lo que afirman las 49 aserciones. El contraejemplo propuesto no se ejecutó; no afirmar un RED observado.

**Arreglo:** añadir snapshot de `ctid::text` del repartidor inmediatamente antes de su llamada idempotente en sección 6 de `supabase/tests/cc034_admin_reinstate_courier.sql` y comparar el `ctid::text` posterior. Una nueva versión de fila por UPDATE cambia `ctid`, incluso si asigna los mismos valores. Probar tanto sobre el aprobado original como el que acaba de reactivarse, si resulta sencillo. Actualizar `plan(49)` al número correcto de nuevas aserciones.

**Prueba/mutación:** en una **base efímera de CI**, nunca en Supabase remoto, instalar una copia temporal de la RPC con un `UPDATE public.couriers SET available = available WHERE profile_id=p_courier_id` dentro del caso `approved` antes del `return`. La misma aserción de `ctid` debe fallar (RED), la migración original restaurada debe pasar (GREEN). Registrar ambas salidas y restaurar siempre la función. No editar el SQL de producción para introducir la mutación.

## NO TOCAR — supuestos descartados

- La ruta idempotente de producción **sí** termina sin UPDATE en el SHA revisado.
- `approved` conserva `available` también si era `true`; el contrato prohíbe tocar la columna y no exige forzarla a `false` en la RPC.
- La migración contiene el `FOR UPDATE` pactado y el CI demostró la mutación de ese lock con auditoría duplicada; no reclamar un bug de concurrencia sin nueva evidencia.
- Los cambios están dentro de los patrones de archivos permitidos en la ficha de `develop`.
- No es fallo de T-385 que la UI existente no use todavía la nueva RPC: T-380 se encarga de esa integración.

## Checks del SHA revisado

- GitHub Actions `CI` run 39386300478, correspondiente a `cffb9ff62d98eba993a2e14124afa639cdce709a`: `typecheck`, `lint`, `build`, `audit`, `unit`, `db-tests`, `bundle-budget` en success.
- Logs `unit`: 149 archivos Vitest PASS, 79 verificaciones de workflow PASS, 6 ADR PASS. El total global declarado en el body es 2906, pero aquí solo se certifica la lectura independiente de los extractos del job.
- Logs `db-tests`: pgTAP `cc034_admin_reinstate_courier.sql` `ok`, prueba final `Result: PASS`; escenarios CC-034 1/2/3 GREEN, y `--mutation-check` RED sin `FOR UPDATE` seguido de GREEN. El drift de tipos consta success como paso de job.
- Check `approval-policy`: **failure** sobre `cffb9ff62d98eba993a2e14124afa639cdce709a`, pendiente informe independiente; Vercel preview disponible. La aprobación de revisión o merge NO se otorgaron.
- Los logs pertenecen a ejecución automatizada, **no** a reproducción manual del revisor.
- Repositorio no clonable desde el contenedor de revisión (sin DNS hacia github.com): no se ejecutaron `pnpm`, `git merge-tree`, mutaciones de prueba ni `node docs/revision-pr/analizar.mjs` localmente. Comparación de commits GitHub: ahead=2, behind=0, mergeable=true.

## Decisiones pendientes

Ninguna nueva. CC-034 declara 0 decisiones abiertas; ambos hallazgos piden ajustar la implementación y sus pruebas, no cambiar política de producto.

## Verificación de la próxima ronda

Revisar el nuevo HEAD real de GitHub, leer la bitácora y comentario, comprobar que ambos casos RED→GREEN fueron auténticos y que no se adulteraron tests, validar CI de código y comprobar que la carpeta de revisión sigue siendo del revisor. La nueva ronda debe escribirse en `revisiones/ronda-2.md`, nunca sobre este archivo.
