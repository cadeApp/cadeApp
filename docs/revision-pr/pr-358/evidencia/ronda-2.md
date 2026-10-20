# Evidencia Ronda 2 — PR358
SHA: 78b2e79bcaeff540604f23951c9f4331fa2fa95b; funcional: affe835b8ea075519159ea888cc1e30e3c184d52.
Revisión por GitHub API: PR files/commits, fuente, ficha T-356 desde develop, CC-025, Ronda 1 y logs CI. No se ejecutó git local, node analizar.mjs, DB, Vitest ni mutaciones propias.
CI: https://github.com/cadeApp/cadeApp/actions/runs/39019886169; pgTAP Files=27, Tests=2420, Result: PASS.
approval-policy: https://github.com/cadeApp/cadeApp/actions/runs/39019933041 PASS.
E2E: https://github.com/cadeApp/cadeApp/actions/runs/39019961766; e2e-preview cancelled y status error.
R01: component/document-replacement-card.tsx:49-102, upload-manager.ts:95-103,168-186, migration CC025:188-243, rls_v1.sql:491-504, sweep.ts:138-157.
R02: status-view.tsx:96-153,205-238 y courier-profile-view.tsx:430-481, componente hijo setCurrentStatus tras Action y callback onReplaced sin consumidor.
R03: e2e/specs/courier-onboarding.spec.ts:831-955: fixture dbAdmin.insert rejected; no RPC admin ni UI admin final.

### Pruebas falsadoras requeridas (NO ejecutadas por revisor)
R01: fake de commit RPC + transporte falla, seleccionar de nuevo mismo archivo; confirmar misma key/path, una sola subida, una sola versión nueva; mutar nueva key/path => RED.
R02: montar StatusView con license rejected, resolver RPC y comprobar resumen sin rejected ni alteración del DNI verificado; mutar quitando callback/refresh => RED.
R03: Playwright sobre Preview Develop prepara submitted, admin autorizado rechaza con código seguro, courier ve motivo, reemplaza, admin ve nueva versión submitted revisable y antigua histórica bloqueada.
Antes de cada mutación control GREEN; RED específico; restaurar y GREEN. Prohibido debilitar test/mock/fixture/snapshot/CI para conseguir pass.
Para verificar JSONL y documentación al disponer de clon: node docs/revision-pr/analizar.mjs verificacion. No se ejecutó aquí.
