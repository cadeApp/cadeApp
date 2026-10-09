# PR #295 — Revisión independiente (P3 / T-338)

**PR:** https://github.com/cadeApp/cadeApp/pull/295  
**Titular:** @KiraK72  
**Rama funcional:** `feat/T-338-pwa-standalone` (no se modificó por esta revisión).  
**Carpeta oficial del revisor:** `docs/revisiones:docs/revision-pr/pr-295/`, por `COMO-ENTREGAR.md` para PR de P3.

## Rondas y trazabilidad

- R1, funcional `6a35d87`: informe histórico en [rama de PR, ronda 1](https://github.com/cadeApp/cadeApp/blob/3152af793d9bd42498e6b6a8600842979fd3aaaa/docs/revision-pr/pr-295/revisiones/ronda-1.md).
- R2, funcional `43e5945`: [rama de PR, ronda 2](https://github.com/cadeApp/cadeApp/blob/3152af793d9bd42498e6b6a8600842979fd3aaaa/docs/revision-pr/pr-295/revisiones/ronda-2.md).
- R3, funcional `0ffb370`: revisión externa del 2026-10-08 entregada como archivo al usuario, sin commit/comentario de informe R3; [decisión P1 B](https://github.com/cadeApp/cadeApp/pull/295#issuecomment-6071177991).
- **R4, funcional `3152af793d9bd42498e6b6a8600842979fd3aaaa`: CON BLOQUEANTES (5 incluyendo gate E2E previo aún pendiente).** [Informe](revisiones/ronda-4.md).

## Estados relevantes

- H01–H05: correcciones inspeccionadas en R2, mutaciones de autor no reejecutadas por revisor.
- H06: anti-flash necesita gate E2E independiente; previo RED.
- R01: optimización cumplía 180 kB en build de `0ffb370`, no medible en `3152af7` por build fallido; no extrapolar GREEN.
- H07: E2E previo falló; para nuevo HEAD no hay E2E porque Vercel falló.
- A01 (entrypoint) y A02 (push): excepciones de alcance decididas y aceptadas.
- H08–H11: hallazgos nuevos R4 con causa y solución en informe.

## Gate humano

Android físico con PWA anterior/actualizada y navegador normal: **pendiente**. No suplantarlo con mocks ni E2E.
