# Revisión independiente — PR #697 / T-432 / CC-049

**PR:** https://github.com/cadeApp/cadeApp/pull/697  
**Rama:** `feat/T-432-sec07-push-hardening`  
**Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`  
**Fecha:** 2026-11-12

## Estado actual — ronda 2

**CON BLOQUEANTES (2):** H02 parcial y H05 nuevo. **H01, H03 y H04 corregidos y verificados documentalmente.** Se preserva la distinción entre revisión del contrato y pruebas de la implementación futura, que no está en esta PR. No aprobar ni mergear todavía.

- [Ronda 2](revisiones/ronda-2.md): SHA `3406672db6e88c04c6603d8815b8ec81556dcbd8`.
- [Ronda 1 histórica](revisiones/ronda-1.md): SHA `b9f0bb12f480ce2c95afa42fee6031021611be2b`, sin modificaciones.
- [Hallazgos estructurados](hallazgos.jsonl), [evidencia y comandos](evidencia/comandos.md), [lecciones](lecciones.md).

**Decisiones:** D1-A (cuatro servicios), D2-A (descartar sin borrar), D3 (5000 ms), D4-B (límite absoluto y aborto real) y D5-C (limpieza escalonada), todas conservadas. **Decisiones pendientes: 0.**

El autor declara `pnpm exec vitest run tools` 123/123; el revisor no lo pudo reproducir por falta de clon. Sí ejecutó un contraejemplo lógico independiente de H02 en Node; NO ejecutó PostgreSQL ni el transporte. Con dos bloqueantes, no se usó CI para aprobar. `mergeable:true` es dato de GitHub, no garantía de corrección.

La ronda 2 fue commiteada únicamente en esta carpeta de revisión. Agy debe hacer `git pull` del SHA de ese commit y no editar `docs/revision-pr/**`. El comentario único de cierre de ronda 2 contiene el informe breve y el prompt acotado.
