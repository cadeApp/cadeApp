# Revisión independiente — PR #697 / T-432 / CC-049

- **PR:** https://github.com/cadeApp/cadeApp/pull/697
- **Rama:** `feat/T-432-sec07-push-hardening`
- **Head del contenido revisado:** `b9f0bb12f480ce2c95afa42fee6031021611be2b`
- **Base:** `develop@9dafedab103cdfdd7eca0fa88cc38f2e319dc831`
- **Fecha:** 2026-11-12
- **Tipo:** PR documental; todavía no contiene migración ni implementación.
- **Ronda independiente:** [ronda-1](revisiones/ronda-1.md).
- **Estado:** **CON BLOQUEANTES (4)** — H01 a H04 abiertos. No aprobar ni mergear por esta revisión.
- **Decisiones:** D1-A, D2-A y D3=5000 ms ratificadas; **D4-B (deadline absoluto + cancelación real) y D5-C (limpieza escalonada)** confirmadas por Lautaro073 en el chat, 2026-11-12. Sin decisiones pendientes.
- **Evidencia:** [comandos y contraejemplos](evidencia/comandos.md). Son verificaciones limitadas; no equivalen a pgTAP, CI ni a pruebas de la futura implementación.
- **Datos estructurados:** [hallazgos.jsonl](hallazgos.jsonl).
- **Lecciones:** [lecciones.md](lecciones.md).

## Alcance de la ronda

Se comprobó que el commit solo añade `docs/contracts/CC-049.md`, `docs/tasks/T-432.md` y `docs/tasks/log/T-432.md` y agrega la fila T-432 en `docs/implementation-plan.md`. La ficha no existe en `develop`: es una creación, no una ampliación de ficha anterior. El issue es #665 (SEC-07).

Los bloqueantes detectados se corrigen **en los documentos** antes de mergear esta PR. La implementación sigue en una PR posterior a la aprobación del CC, siguiendo T-409/T-430. El autor debe registrar los arreglos en su bitácora y solicitar ronda 2.

## Estado de controles

- Rama y base verificadas por GitHub: `b9f0bb12` / `9dafedab`; GitHub informa `mergeable: true`. No se pudo ejecutar `git merge-tree` por falta de un clon de red.
- La bitácora y el cuerpo de PR **declaran** `pnpm exec vitest run tools`: 123/123. **No reproducido** por el revisor: no había clon ni instalación de dependencias disponible.
- Se ejecutó únicamente el arnés aislado de contraejemplos de `evidencia/comandos.md` con Node v22.16.0 (sin Supabase, Docker ni red remota).
- Typecheck/lint/test/test:db/CI: **no ejecutados ni certificados** por esta ronda documental. No hay pruebas de la implementación todavía.
- No hay material previo dentro de `docs/revision-pr/pr-697/` que preservar; se crea esta carpeta de revisión.

**Para agy:** el prompt cerrado, con rutas permitidas, cambios concretos y mutaciones RED→GREEN, está en el comentario único de cierre de la PR. Debe hacer `git pull` primero y **no tocar esta carpeta**.
