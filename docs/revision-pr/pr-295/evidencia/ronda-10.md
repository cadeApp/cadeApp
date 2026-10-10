# Evidencia independiente R10 — PR #295 / T-338

HEAD funcional exacto `3b7484e4b310f41d78eb6de06d21a6cedee10686`. Diff contra R9 anterior `74fd2150`: cuatro archivos, `src/middleware.ts`, `src/middleware.test.ts`, `docs/tasks/T-338.md`, `docs/tasks/log/T-338.md`, todos dentro de autorización P1 R9-A/PR295-A04.

**CI:** https://github.com/cadeApp/cadeApp/actions/runs/38014720340
- unit 114102343527: success; 127 test files Vitest passed; suites Node 79/79 y 6/6 pass.
- db-tests 114102343461: Result PASS, Files=1 Tests=10; Result PASS, Files=20 Tests=1903.
- build 114102343466: success, manifest route generada, JS `/ 138`, `/legal 138`, `/login 169`, `/register 169` kB.
- typecheck 114102343341, lint 114102343531, audit 114102343454, bundle-budget 114102525811: all success.
- Vercel Ready + approval-policy success.

**E2E trusted:** https://github.com/cadeApp/cadeApp/actions/runs/38014801228, e2e-preview job 114102622287 success: 46/46 Chromium passed, 3/3 global-settings passed. Browser common + app standalone anti-flash + native userActivation push passed.

**Deployment Vercel:** `dpl_AwU93x4jXG1CLgTSBdtGA5WSnD2x`, ready, git commit `3b7484e4b310f41d78eb6de06d21a6cedee10686`; immutable hostname `cadeapp-develop-11lk7ydks-lautaroj073.vercel.app`.

**Evidencia autor (no reproduje HTTP desde aquí):** bitácora declara pre-fix Preview viejo /manifest.webmanifest y /sw.js 307→login; 2 tests RED/22 green; 24 green post matcher; servidor local prod 200 manifest+SW y redirect privado. HTTP de Preview nuevo y QA Android aún ausentes.

**Prueba independiente:** script de 14 casos + 4 mutaciones con RED en archivo [comandos-ronda-10.md](comandos-ronda-10.md), solo sobre RegExp JS (no Next, no HTTP).

**HTTP remoto no comprobado**: intenté consultar alias de Vercel y URL real desde herramientas de acceso, no alcanzable aquí por restricción/resolución del entorno. No inferir 200 remoto solo por CI. Sin Android físico ejecutado en esta ronda.
