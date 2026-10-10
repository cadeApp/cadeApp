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

## Ronda 5 — HEAD funcional `64c0dfb012eeabd7b98686b37bd571433cd04817` (2026-10-09)

[Informe R5](revisiones/ronda-5.md) · [Evidencia R5](evidencia/ronda-5.md).

**Resultado:** CON BLOQUEANTES (3): R02 (test E2E inyecta CSS), H11 (E2E de gesto nativo aún no existe), H07 (gate E2E pendiente al corte). R01 y H08 verificados por CI remoto en SHA exacto, H09 corregido por inspección pero sin prueba end-to-end del reload; H10 parcial.

**Decisión P1 R5 A:** aceptada; autoriza `e2e/specs/push-user-activation.spec.ts` y actualización documental de ficha por Kira. Sin autorización de otras rutas o workflows. Decisión B R3 continúa vigente.

**Prueba Android humano:** P1 la hará después de revisión técnica cerrada sin bloqueantes; pendiente deliberadamente.

## Ronda 6 — HEAD `8c27939578d4e57eb8678382ba9828d389393cde`

[Informe R6](revisiones/ronda-6.md) · [Evidencia R6](evidencia/ronda-6.md).

**CON BLOQUEANTES (4)**: R03 (CDP display-mode=false en Chromium), H12 (copy E2E erróneo), H13 (supuesto RED desconectado y sleep prohibido), H07 (gate E2E Preview real rojo: 45 pass / 2 fail). R02 ya sin CSS inyectado, pendiente de validar en standalone nativo; H06/H10/H11 parciales. R01 verificado, CI general verde. A03=A autorizada y asentada.

Android físico a cargo de P1 **tras** resolver todos los bloqueantes técnicos.

## Ronda 7 — HEAD funcional `a157fe48599600ccd65a5e52aa8a06ca1d692f8e`

[Informe R7](revisiones/ronda-7.md) · [Evidencia R7](evidencia/ronda-7.md).

**CON BLOQUEANTE:** R03 (Chromium shell no emula standalone), H07 (E2E Preview 45 passed / 1 failed). H11 y H12 ahora **arreglado-verificado** por E2E real; H13 eliminó prueba artificial, pendiente mutación RED propia; R01 y H08 conservan CI verde. Antes de pedir autorización para editar workflow o DoD, investigar `channel:'chromium'`, `headless:true` en el propio spec permitido. Android físico P1 solo al cerrar revisión técnica.

## Ronda 8 — HEAD funcional `74fd2150c629b396ff9843cd285e70b93cbd42cb`

[Informe R8](revisiones/ronda-8.md) · [Evidencia R8](evidencia/ronda-8.md).

**SIN BLOQUEANTES TÉCNICOS en HEAD inspeccionado.** CI general success; trusted E2E Preview 46 Chromium + 3 global-settings passed; R03/H07 resueltos mediante Chromium completo `channel:'chromium'` con `--app`, native display-mode true, CSS anti-flash real, redirección `/login`. First Load JS 138/138/169/169 kB <=180. **Siguiente gate: Android físico P1**, sobre mismo origen en actualización; no merge todavía.

Matiz: el test automatizado instrumenta una segunda navegación a `/`, no el primer auto-launch de `--app`. El arranque frío/actualización se comprueba humanamente. Mutación RED local del autor no reproducida independientemente. Sin modificaciones de código por revisor.

## Ronda 9 — Informe Android físico (2026-10-09), mismo SHA R8

[Informe R9](revisiones/ronda-9.md) · [Evidencia R9](evidencia/ronda-9.md).

**CON BLOQUEANTES para merge y QA:** prueba Android A/B/D/E bloqueada; Chrome recibe HTML en /manifest.webmanifest (QA reportada). Inspección independiente: middleware no excluye /manifest.webmanifest **ni /sw.js**, ambos pasan a guarda anónima que redirige a login. HTTP sin redirects y /sw.js aún pendientes de confirmación. CI/E2E R8 GREEN es verdadero pero insuficiente para instalar/actualizar WebAPK real. **P1 debe autorizar alcance** a middleware.ts y middleware.test.ts antes de cambios de Kira. No mergear.
 
### Decisión P1 R9-A aceptada (2026-10-09)

P1 **autoriza exclusivamente** que Kira modifique `src/middleware.ts` y `src/middleware.test.ts` (además de ficha y bitácora) para corregir el acceso anónimo **exacto** a `/manifest.webmanifest` y `/sw.js`, **después** de diagnosticar HTTP sin redirecciones. Excepción identificada como **PR295-A04** y documentada en [R9](revisiones/ronda-9.md). No autoriza auth, guards, workflows, ni bypass amplio de assets o rutas privadas. **PR bloqueada para merge** hasta nuevo SHA, CI/E2E, HTTP real, nueva QA Android A-E y ronda independiente.

## Ronda 10 — commit funcional `3b7484e4b310f41d78eb6de06d21a6cedee10686`

[Informe R10](revisiones/ronda-10.md) · [Evidencia R10](evidencia/ronda-10.md) · [Mutaciones independientes](evidencia/comandos-ronda-10.md).

**Sin nuevos bloqueantes de código**: P1 R9-A implementada únicamente en `src/middleware.ts`, `src/middleware.test.ts` y ficha/bitácora. CI GREEN (127 Vitest files, 10+1903 db tests, presupuestos <=180), Preview E2E GREEN (46 Chromium + 3 global-settings), Vercel READY para el HEAD. Matcher protege sufijos y privados en tests; 14 casos y cuatro mutaciones RED independientes de regexp. **H14/H15 corregidos por código, estado conservador `arreglado-sin-verificar`** hasta GET anónimo 200 real de manifest+SW en *Preview nuevo* y repetición QA Android A–E. **No merge todavía, no modificar código sin nueva incidencia**.

## Ronda 11 — QA Android y nuevo H16 legal (SHA `3b7484e4b310f41d78eb6de06d21a6cedee10686`)

[Informe R11](revisiones/ronda-11.md) · [Evidencia R11](evidencia/ronda-11.md).

**CON BLOQUEANTE nuevo H16:** las páginas de términos y privacidad no están en `isPublicRoute`, por lo que el guard anónimo redirige los enlaces correctos de login/registro a /login. P1 lo reprodujo manualmente en el WebAPK. **R9 H14/H15 verificados** por reportes QA P1/Codex: manifest/SW 200 sin redirect, WebAPK instalado, primer arranque final /login, offline PASS. Pendiente elegir ampliación acotada de alcance a `src/features/auth/guards.ts` + tests o tarea separada. **No mergear**. B navegación a / dentro de WebAPK y evidencia de no-flash inicial aún pendientes.

## Ronda 12 — QA final H16 sobre `4e26d24feba002b8247ba7feb2c20b052418f9fa`

[Informe R12](revisiones/ronda-12.md) · [Evidencia R12](evidencia/ronda-12.md) · [Mutación estática R12](evidencia/comandos-ronda-12.md).

**H16 arreglado-verificado:** auth guard allowlist exacta 5 legales, 103 tests guards green, HTTP y navegación real CDP en WebAPK Android PASS aportada por P1/Codex. H14/H15 permanecen cerrados. CI 38017790121 success (127 Vitest files; db 10+1903; bundle <=180 kB) y Vercel READY. **PENDIENTE: status `e2e-preview` del SHA final aún pending** al revisar run 38017862788. **NO MERGEAR hasta E2E success en el HEAD vigente y autorización P1**. Sin video pre-launch, no afirmar destello absolutamente imposible; offline reutilizado sobre host anterior, SW nuevo registrado. La corrección mínima H16 la aplicó el propio revisor a petición P1; QA física es de P1/Codex, no prueba independiente propia.
