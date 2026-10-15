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
