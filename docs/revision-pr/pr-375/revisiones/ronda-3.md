# PR #375 — T-358 · Informe independiente, ronda 3

**Código revisado inicial:** `837fc14c6580808dcfa99b788625a7d42af19693` · **Corrección recibida durante la revisión:** `17330878f795804c5820be94dc64a764f9fa232c` · **Base:** `develop` @ `7424dc276a34a172776a4ed77965bc4e189e01e2` · **Fecha:** 2026-10-16.

**Resultado: CON BLOQUEANTES para merge por evidencia incompleta (H07), documentación H08 y CI/E2E pendiente del SHA final**. R01–R03 están corregidos por inspección; R04 fue hallazgo de sintaxis real y se corrigió durante la revisión con una línea, typecheck y lint ya verdes en nuevo HEAD.

## Evolución
| Hallazgo | Estado | Qué se comprobó |
|---|---|---|
| H01-H06 | arreglado-sin-verificar | Soluciones de R1 persisten, CC-027/028 mergeados. R2 ya analizó código y tests. No mutaciones propias del revisor en esta ronda. |
| H07 | parcial | Tests R01–R03 incorporados con checks concretos. El autor relata RED/GREEN, pero faltan mutaciones independientes del revisor y E2E Preview de último SHA. |
| H08 | abierto | `docs/tasks/T-358.md` todavía marca nueve DoD y dice 'esta PR solo publica las fichas'; PR body aún dice 'Draft inicial' y 'Pendiente de implementación', pese a PR real y revisión R3. |
| R01 | arreglado-sin-verificar | `onboarding-form.tsx:130-137` no borra pin cuando GPS fuera; test `onboarding-form.test.tsx:774-823` comprueba coords conservadas y payload phone-only. |
| R02 | arreglado-sin-verificar | `onboarding-form.tsx:96-100,331-363` muestra etiqueta histórica legible, opción `disabled`, rechaza re-selección. Tests `:825-897` comprueban phone-only y cambio activo. |
| R03 | arreglado-sin-verificar | `form-hooks.ts:108-128` implementa setFields con validación conjunta; `onboarding-form.tsx:429-455` lo usa para pin. Test `:899-932` comprueba sin error y PATCH null/null. |
| R04 (nuevo) | arreglado-verificado SOLO sintaxis | En SHA `837fc14` faltaba cierre de `it` en test, bloqueando CI; en SHA `17330878` se agregó `    });`. GitHub Actions typecheck/lint SUCCESS en ese SHA. |

## R04 — Regresión real detectada por GitHub CI durante la revisión
**Archivo:** `src/features/merchants/components/onboarding-form.test.tsx:930-932`.
- GitHub Actions run [38871188667](https://github.com/cadeApp/cadeApp/actions/runs/38871188667), SHA `837fc14`: typecheck falla TS1005 `'}' expected` en 932, lint y build también fallan, unit informa `1 failed | 134 passed` en suites y 2382 tests entre suites ejecutadas. **No eran 2414 verdes en ese commit**.
- Durante la revisión el agente subió commit `17330878`, añadiendo `    });` y actualizando bitácora. Reinspeccioné la cola: ahora cierra `it`, `describe` interno y `describe` externo correctamente.
- Run [38922166022](https://github.com/cadeApp/cadeApp/actions/runs/38922166022) del nuevo SHA: **typecheck SUCCESS, lint SUCCESS, audit SUCCESS** cuando se consultó. Build, unit y db-tests seguían en progreso. `verificado_en_sha` de R04 se refiere **únicamente al parseo/typecheck/lint**, no a la suite completa.

## H07 — Qué falta para dar por terminada la revisión
- Aunque el autor dejó en bitácora mutaciones RED (GPS reinsertando setValue null, zona histórica oculta, dos setters secuenciales), esta sesión no ejecutó mutaciones propias. Mantener marca de `arreglado-sin-verificar` para esos comportamientos; un test del autor no sustituye revisión independiente.
- Comprobar la suite específica `onboarding-form.test.tsx` con el SHA `17330878` (o posterior) y el resumen real `32/32` solo si el log confirma que corrió. Confirmar CI completa y E2E Preview de ese mismo HEAD; el E2E PASS del SHA anterior `e8206d77` no se hereda.
- Para R01-R03 se requieren mutantes que generen RED real sin alterar test/mocks. Si no hay clon disponible, registrar esta limitación y no marcar verificado por simple inspección.

## H08 — Desfase documental
- La ficha de la rama conserva nota 'esta PR solo publica las fichas' y 9 `[x]` en DoD. El body de PR contiene `En progreso (Draft inicial)` y `Pendiente de implementación y revisión independiente`, y DoD [ ] mientras la implementación está hecha. Actualizar los textos contradictorios al estado comprobable, **sin atribuir verificación al agente** ni tocar la carpeta del revisor.

## Calidad, alcance y posibles mejoras
- R2→R3 (+ dos commits del autor) afectó únicamente: `docs/tasks/log/T-358.md`, `components/form-hooks.ts`, `components/onboarding-form.tsx` y `.test.tsx`. Los 20 archivos del diff `develop...HEAD` se mantienen dentro del alcance de ficha.
- No se encontraron contratos nuevos sin CC, dependencias nuevas, secretos o cambios de RLS en el delta.
- Mejora H15 no bloqueante: con zona histórica `disabled`, el selector compartido incluye esa opción en el recorrido de flechas; se rechaza seleccionar pero puede interrumpirse el ciclo de teclas. No modificar `src/ui/select.tsx` en T-358; si se confirma problema operativo, gestionar CC separado.
- Sin repo clonado ni dependencias ejecutables: **no se corrió `pnpm`, `git merge-tree` ni mutaciones locales por esta revisión**. GitHub confirma `mergeable=true`, lo cual no sustituye checks.

## Cierre de ronda 3
Estado final de esta ronda: **CON BLOQUEANTES hasta que H07 y H08 estén satisfechos y todos los checks/E2E del SHA funcional final sean verificables**. La corrección R04 ya se publicó en el HEAD autor. No aprobar ni mergear esta PR.
