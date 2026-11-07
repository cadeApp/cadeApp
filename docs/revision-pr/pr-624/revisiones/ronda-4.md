# PR #624 — revisión independiente, ronda 4

**T-419 / CC-042 · 2026-11-06 · SHA inspeccionado: 6e4525b5805100c831e0201e7a6451ba399d5daf.**
**Resultado: SIN BLOQUEANTES — RONDA ACEPTADA (cierre de revisión estática/CI).**
**Excepción de validación aún abierta:** E2E T-419 y RED/GREEN funcional de H06/R01/R03: BLOCKED / REQUIRES DEVELOP MIGRATION. La aceptación **no equivale a aprobación ni permiso de merge**; tras migrate-develop hay que ejecutar los E2E y comprobar su resultado antes de tomar la decisión de merge. Decisión D01=A vigente; no hay decisiones 🔵 nuevas.

## Alcance y Git

La comparación con el commit de revisión anterior 1d834351da547b1eb97e9c149c1cc09ba6488e18 contiene **un solo commit de corrección**, head 6e4525b5, y **dos archivos modificados**: e2e/specs/courier-vehicles.spec.ts y docs/tasks/log/T-419.md. Ambos están permitidos por la ficha T-419 leída desde develop. Nadie tocó los archivos de docs/revision-pr/pr-624/ desde la ronda 3. No se crean dependencias ni archivos nuevos de producción.

GitHub: PR abierta, Draft, mergeable=true, sin reviews ni threads pendientes en la API. La base del PR sigue en b5ceef11; develop está en 5a8f6dc5 (un commit por delante, CC-046, docs/pr-631 y src/ui/sheet). Sin superposición de rutas con las modificadas por este PR, pero **no se ejecutó merge-tree en un clon**; mergeable de GitHub no equivale a ejecución del comando.

## R03 — revisión detallada

En e2e/specs/courier-vehicles.spec.ts, líneas 188–289, el test anterior fue reemplazado por dos casos: **corte después de activar bici** y **corte después de ofertar**. La prueba determina motoId y los IDs de bici anteriores a cualquier escritura. Dentro del try externo, siembra una bici archivada, conserva su ID en un Set previo y ejecuta el alta y la oferta en un try interno. El error controlado "corte simulado" obliga a ejecutar restoreSeedVehicle en el finally interno; las aserciones verifican que:
- el error fue el corte esperado y no un error de operación distinto;
- cleanupErrors queda vacío; el ID de la bici nueva existe; la moto original queda activa;
- la bici nueva desapareció mientras la archivada sigue;
- para el escenario de oferta, su estado final es withdrawn.

El finally externo se ejecuta incluso si falla el setup o las aserciones y vuelve a llamar restoreSeedVehicle con el conjunto que preserva históricos; solo cuando no hay errores de restore borra por ID la bici histórica sembrada y comprueba deleteError. reportCleanup comunica errores adicionales sin ocultar el error principal. Esta separación corrige el defecto R03: el test de limpieza ahora también se limpia al fallar a mitad de camino. **No se encontró un nuevo bloqueante por inspección.**

No se declara que esa lógica haya sido probada en staging: hay que correr ambos casos E2E después de que migrate-develop aplique la migración. La bitácora declara playwright test --list = 16 tests, solo comprobación de descubrimiento, no ejecución.

## Pruebas y evidencia independiente

**CI:** https://github.com/cadeApp/cadeApp/actions/runs/42269949572, mismo head 6e4525b5805100c831e0201e7a6451ba399d5daf, success; siete jobs exitosos: typecheck, unit, lint, db-tests, build, audit y bundle-budget. Del log del job 128071753287: cc042_courier_vehicles.sql OK; **Files=43, Tests=3582, Result: PASS**; comparación git diff --exit-code -- src/types/database.types.ts sin diferencias (job success). Del log de unit 128071753185: **Test Files=196 passed; Tests=3680 passed**.

**Prueba independiente del revisor:** 13 sondas estructurales sobre los textos exactos del SHA actual, todas confirmadas: dos puntos de corte; escrituras protegidas por try; Set histórico previo; doble cleanup por finally; eliminación únicamente por IDs; control de errores del delete; moto restaurada, bici nueva ausente y oferta withdrawn; error controlado. Mutación **estructural en memoria**, quitando el llamado a restoreSeedVehicle del finally interno, cambia la sonda de GREEN a RED. Este ejercicio **NO es** el RED funcional del E2E y no se registra como verificado-runtime.

**No ejecutado:** Playwright E2E, mutación RED E2E en rama REVIEW ONLY, Supabase/Docker local, comandos de pnpm en clon ni git merge-tree. El verde de CI no suple E2E, porque los E2E no están incluidos en ese run. Las mutaciones anteriores del autor #641–#646 y H07 constan en los informes previos; no se atribuyen al revisor como si él las hubiera ejecutado.

## Seguimiento y criterio de cierre

- **H01–H05, H07, R01 y R02:** arreglado-sin-verificar, como en R3. Los RED/GREEN y el CI del autor están documentados, pero sin reproducción semántica independiente; sus campos verificado_en_sha siguen null.
- **H06:** pasa de parcial a **arreglado-sin-verificar** según inspección: los helpers restauran el activo sin borrar históricos y los nuevos E2E cubren ambos cortes; queda ejecución real pendiente.
- **R03:** pasa de abierto a **arreglado-sin-verificar**: los dos escenarios ahora tienen su propio finally, recuperación idempotente, restauración de estado y teardown con comprobación de errores. No afirmar verificado porque falta ejecutar E2E.

**Resultado de esta ronda: SIN BLOQUEANTES — ACEPTADA para cierre de revisión del código.** La aceptación es **condicionada operacionalmente** a la validación manual de E2E tras migrate-develop y a verificar su RED/GREEN, sin sustituirla por CI. No dar aprobación formal de GitHub, no cambiar Draft ni mergear. Lautaro073 conserva la decisión de merge.

## Tarea manual obligatoria pendiente antes de merge

1. Ejecutar migrate-develop sobre el ambiente develop/staging separado que corresponde a los E2E y verificar que la migración de CC-042 quedó aplicada. Esta operación es externa y **no se realizó** en esta revisión.
2. Ejecutar ambos casos PR624-R03 y el resto de E2E T-419, validar restauración y ausencia de residuos al interrumpir flujo, y registrar los resultados. Hacer RED funcional quitando o inutilizando *solo en una rama de mutación aislada REVIEW ONLY / NEVER MERGE* la limpieza del finally interno; ambos casos deben detectar el fallo. Restaurar y obtener GREEN. Cerrar rama de mutación sin mergear.
3. Antes de fusionar, volver a revisar que los checks correspondan al SHA operativo de código y que la rama se integre con develop sin conflictos. No ejecutar workflows manualmente solo para documental.

La revisión deja constancia inequívoca de que estos pasos siguen pendientes; no hay decisiones 🔵 nuevas.
