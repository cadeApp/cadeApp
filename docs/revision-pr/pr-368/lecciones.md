# Lecciones — PR #368 / T-354

**Ronda 1:** dos bloqueantes **de estado de implementación en Draft**, no dos defectos de código ejecutado.

- La dependencia entre una vista reutilizada (`StatusView`) y un test en otra feature obliga a una **autorización puntual**, no habilitar `src/features/offers/**` entero.
- Una ficha con nota heredada que dice «esta PR solo publica fichas» no debe condicionar una PR nueva de implementación. Se dejó coherente y acotada por decisión explícita de Lautaro073.
- En las próximas rondas debe revisarse *toda* la clase de textos visibles: onboarding, estado, perfil, admin detalle y badge de cola, incluyendo pruebas que sigan ejercitando «Pendiente/Observado/Verificado». Cambiar solo un string no es demostrar el flujo.

No se numera lección AG nueva en esta ronda preparatoria: primero se necesitan defectos reales reproducidos contra código implementado. No cambiar `AGENTS.md` a partir de una sola PR Draft.
