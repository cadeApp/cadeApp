# Lecciones — PR #368 / T-354

**Ronda 1:** dos bloqueantes **de estado de implementación en Draft**, no dos defectos de código ejecutado.

- La dependencia entre una vista reutilizada (`StatusView`) y un test en otra feature obliga a una **autorización puntual**, no habilitar `src/features/offers/**` entero.
- Una ficha con nota heredada que dice «esta PR solo publica fichas» no debe condicionar una PR nueva de implementación. Se dejó coherente y acotada por decisión explícita de Lautaro073.
- En las próximas rondas debe revisarse *toda* la clase de textos visibles: onboarding, estado, perfil, admin detalle y badge de cola, incluyendo pruebas que sigan ejercitando «Pendiente/Observado/Verificado». Cambiar solo un string no es demostrar el flujo.

No se numera lección AG nueva en esta ronda preparatoria: primero se necesitan defectos reales reproducidos contra código implementado. No cambiar `AGENTS.md` a partir de una sola PR Draft.

## Ronda 2

- **P08, regla no automatizada:** `pnpm lint` y `pnpm typecheck` quedaron verdes aun cuando entraron `as any` y `!` en tests. No asumir que «verde» equivale a cumplir todas las reglas del repositorio. Candidato a comprobación sobre todos los tests cuando este patrón se repita en otra PR.
- **P15, evidencia del DoD:** Preview Ready/CI unit verde y una afirmación de viewport no demuestran el E2E ni una validación visual. Requerir SHA, workflow run, resultado y evidencia real; no inventarlos.
- **Buenas prácticas observadas:** copy compartido entre `StatusView` y perfil, tests del DOM y preservación de controles de estado al actualizar nombres. La autorización para tocar un test de otra feature quedó limitada a una línea.

No se asignan números AG nuevos sin enumerar el máximo global remoto y sin evidencia reproducida del patrón estructural. El mismo hallazgo de proceso ya se conoce como P08 y P15.

## Ronda 3

- Corrección del revisor: para PR de KiraK72, approval-policy exige APPROVED de Lautaro073, no un informe pegado. Ambas rondas anteriores diagnosticaron esto incorrectamente.
- El E2E de la SHA anterior cancelado no invalida automáticamente un nuevo run de otra SHA: comprobar commit status del SHA exacto y su run target; en 0acb5a7 estaba pending.
- El arreglo de React resuelve la dependencia del componente directamente en lugar de agregar estado global a un test; mejora verificable con CI en mismo SHA y controles propios.
- El harness y las capturas en scratch no son evidencia recuperable por otra revisión. Evitar afirmar GREEN de Playwright si solo hay un run cancelado o pending.

No modificar AGENTS.md ni crear número de lección AG sin contrastar otras PRs.

## Ronda 4

- **P04, harness que se autoaprueba (H05):** capturar de manera indiscriminada una excepción lanzada deliberadamente después de un `execSync` exitoso permite llamar RED a un test siempre verde. Un control de mutación debe fallar explícitamente cuando el mutante sobrevive y separar errores de test de infraestructura.
- **E2E por commit:** el nuevo SHA 20392c26 tiene run SUCCESS con 76 pruebas Chromium y 3 global-settings; no heredar un run de una SHA anterior. La aprobación formal de Lautaro073 llegó después de esos checks.
- **Evidencia móvil recuperable:** el nombre de archivo `mobile-verification.md` en la bitácora no sustituye el enlace a PNGs/artefactos. Respetar la diferencia entre la validación declarada por autor y la verificación independiente.

El hallazgo nuevo se clasifica como P04 ya existente. No modificar AGENTS.md por una sola aparición nueva.

## Ronda 5

- H05: no basta con corregir el `catch`; el revisor debe mostrar que el control rechazó un mutante superviviente con salida GREEN, un error de infraestructura y aceptó un RED verdadero. Reproducción hermética realizada. Distinguimos prueba del algoritmo del harness y reproducción del runtime real de Vitest.
- Las salidas de controles negativos declaradas por el autor no encajan con el script publicado al sustituir el comando completo (el GREEN inicial falla antes); pedir comandos/lógica exactos, no asumir intención fraudulenta ni declarar verificadas las nueve mutaciones que no corrimos.
- Los nombres de componentes como DocumentUploadCard son apropiados para un informe técnico, pero no para demostrar texto dirigido al cliente. Fuente UI revisada usa selfieTitle correcto; PR body corregido para explicar distinción y rotular capturas en lenguaje público. No alterar evidencias gráficas.
- E2E sobre nuevo HEAD: el run exitoso previo no cubre automáticamente un merge posterior; status `e2e-preview=error` del SHA `e97323fe` por cancelación debe quedar explícito.
