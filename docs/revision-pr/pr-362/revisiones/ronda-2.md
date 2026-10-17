# Informe de revisión — PR #362 / T-353 — Ronda 2

**Fecha:** 2026-10-15. **HEAD revisado:** `5dfb57b33f32f4fb4d20f3a824db7bd9cfc5b754`. **Base:** `develop@14c28ed3`. **Rama:** `feat/T-353-validacion-formularios`.
**Resultado:** **CON BLOQUEANTES** (H06/H07 residuales y H08 nuevo).
**Método:** lectura independiente del diff desde `edcc933a127d531e2a145ccc04dee3cac65cf63f`, código actual, tests, bitácora y estados de Actions. No se pudo clonar por resolución DNS de github.com; no se corrió Vitest, Playwright ni mutación runtime. Ningún hallazgo queda «arreglado-verificado».

## Arreglos que mejoraron la implementación (R1 → R2)

| Hallazgo | Evidencia inspeccionada en `5dfb57b` | Estado |
|---|---|---|
| H01 | `requests/schemas.ts`: máximo `2_147_483_647` aplicado a `fixedPriceArs` y `cashChangeAmount`; casos de frontera añadidos | arreglado-sin-verificar |
| H02 | `whatsapp.ts` rechaza `+` mal ubicado/repetido y paréntesis desbalanceados; `merchantOnboardingSchema.phone` y `dropSchema.recipientPhone` producen salida canónica; Actions ahora comprueban valor enviado | arreglado-sin-verificar |
| H03 | `courier-onboarding/schemas.test.ts` exige éxito para walk y bike, tanto con patente arbitraria como válida u omitida; Action test afirma `vehicle_plate: null` | arreglado-sin-verificar |
| H04 | `NOTES_CONTROL_REGEX` permite CR/LF/TAB en notas y rechaza NUL/C0; se agregaron casos positivos/negativos | arreglado-sin-verificar |
| H05 | Se agregaron tests con Actions reales, mocks de sus dependencias, rechazo sin RPC/escrituras y teléfonos canonizados | arreglado-sin-verificar |

**Alcance:** `compare(edcc933a...5dfb57b)` arroja 15 archivos del agy, todos permitidos por la ficha T-353. `docs/revision-pr/pr-362/**` no fue modificado por el agente. GitHub informa PR mergeable al HEAD consultado, que NO equivale a un `git merge-tree` ejecutado.
**CI:** para el SHA revisado, GitHub Actions `CI` run `38679121913` registró success en `lint`, `build`, `typecheck`, `audit`, `unit`, `bundle-budget` en una lectura de estado; `db-tests` seguía en curso. No se afirma contenido de logs ni corrida E2E; conforme a método de revisión, los logs completos se auditan después de corregir bloqueantes.

## Bloqueantes

### H06 residual — E2E no completa un flujo exitoso tras corregir
**`e2e/specs/courier-onboarding.spec.ts:672-707` y `e2e/specs/multi-drop.spec.ts:959-982` · [ANÁLISIS].**
La prueba nueva de DNI verifica error, corrige el valor y solo afirma desaparición del error. No afirma botón habilitado ni avance real del onboarding. La prueba de pedido corrige el teléfono y también termina después de desaparecer el error: no demuestra alta válida ni persistencia. El DoD de T-353 exige error específico, corrección posterior y caso válido que **complete el flujo** en Preview. No figura run E2E del SHA `5dfb57b` en la bitácora. 

**Corrección:** ampliar esas dos specs existentes: tras subsanar el error, completar requisitos reales/fixtures necesarios y probar la transición a la pantalla de destino y/o fila/RPC creada legítimamente. El E2E de pedidos debe afirmar el estado de formulario completo antes y después de la corrección (valores de campos ajenos intactos). Registrar URL Preview, run ID, SHA y resultado real. No alterar fixtures para saltarse el camino de producción ni desplegar mutaciones inseguras.

**Mutación RED exigida al agy:** quitar la corrección del teléfono o impedir el submit final y comprobar que la aserción final del E2E falla. Probar además que un error real de validación impide la persistencia.

### H07 residual — no hay rojo reproducible; referencias imposibles
**`docs/tasks/log/T-353.md:65-85` · [ANÁLISIS].**
La bitácora ahora enumera escenarios hipotéticamente rojos y verdes, pero no aporta comandos reproducibles de mutación ni líneas `Test Files/Tests` en rojo y luego verde. Dos pruebas citadas tienen ubicaciones imposibles en el árbol revisado: `src/lib/whatsapp.test.ts:162-178` (archivo de **109** líneas) y `src/features/courier-onboarding/schemas.test.ts:384-406` (archivo de **189** líneas). `merchants/schemas.test.ts` tiene 295 líneas y la cita `285-300` también se extiende fuera del archivo. Estas no son pruebas de rojo por sí mismas y no deben llamarse reproducciones verificadas.

**Corrección:** sin reescribir la sesión histórica (bitácora append-only), agregar nueva sesión con referencias por nombre de test/símbolo en lugar de líneas, comandos y salida exacta `Test Files/Tests` (o reportar explícitamente que la evidencia histórica RED no existe). Para los controles nuevos, GREEN sin mutar → RED al mutar de manera reversible en scratch local → GREEN después de revertir; distinguir fallo de la aserción de fallo del mock/build. Nunca inventar salida.

### H08 nuevo — falso verde cuando el campo ni existe
**`e2e/specs/multi-drop.spec.ts:968-982` · [ANÁLISIS].**
Todo el cuerpo útil de la nueva prueba depende de `if (await phoneInput.isVisible())`. Si la UI pierde el campo, cambia su selector o no se renderiza por una regresión, la prueba pasa sin ejecutar **ninguna `expect`**. Es la variante E2E de P04-control tautológico, y deja sin protección el mismo campo que pretende validar.

**Corrección:** eliminar el `if`; usar `await expect(phoneInput).toBeVisible()` antes de escribir y completar el flujo. Para selector dinámico, basarse en etiqueta accesible/índice de drop real y confirmar el valor. **Mutación RED:** romper temporalmente el selector o no renderizar el campo en entorno de test (sin commit) y obtener error de `toBeVisible`; de nuevo GREEN tras restaurar. Para cubrir cada drop, no condicionar aserciones a visibilidad opcional.

## No tocar
- No retroceder la decisión **1B** ni **2A**.
- No tocar `src/domain/**`, RLS, migraciones, `.github/**`, `.agents/**`, dependencias, ni `docs/revision-pr/**` desde el agy.
- No convertir una spec fallida en `test.skip`, `test.fixme`, checks de presencia opcionales ni sleeps; no ajustar mocks/snapshots/timeouts para fabricar verde.

## Evidencia y limitaciones
- Comparación GitHub: `edcc933a` → `5dfb57b` (1 commit de corrección, 15 archivos).
- No se verificaron red/green de Vitest de forma independiente; cinco hallazgos figuran **arreglado-sin-verificar**, no cerrados.
- `db-tests` en curso al consultarlo y ninguna evidencia E2E Preview exact-head documentada.
- No queda decisión de producto pendiente; la próxima ronda revalida implementación exact-head y CI.
- Se corrigió un texto obsoleto del cuerpo de la PR (límite de 10M) mediante edición de metadatos, no commit de código.

Ver [comandos y evidencia](../evidencia/comandos.md).
