# PR #411 — Evidencia ronda 3

SHA auditado eaf3689b6b2a5f4cde4587309615b3b041d776fd; Playwright auténtico hizo checkout a91263615730f36c817811f0ac92f56058838409. Cambios entre ellos: **solo** docs/tasks/log/T-369.md.

Run 39159260485 https://github.com/cadeApp/cadeApp/actions/runs/39159260485 (job 117768945794): `HEAD is now at a912636`; `88 passed (28.5m)` Chromium; `6 passed (3.2m)` global-settings. Los tres primeros global-settings T-369 pasan en 51.2 s, 28.1 s y 39.3 s. Los tres restantes T-306 también pasan. Chromium incluyó piloto activo y DNI por corrida.

Run CI 39159712911 https://github.com/cadeApp/cadeApp/actions/runs/39159712911: unit 145 archivos/2765 tests PASS, db-tests 30 archivos/2815 pruebas PASS (más mutantes SQL RED reales y GREEN restaurados), runner T-369 concurrencia 8/8; otros checks CI PASS.

**Método propio:** compare develop...HEAD con 0 behind contra 14 behind del HEAD de ronda 2; comparación byte a byte de 4 fuentes recuperadas de GitHub de SHA a912636 y SHA eaf3689; 14 condiciones positivas + 6 negativos en memoria sobre invariantes de igualdad/contadores de log. No se ejecutó Playwright local. Script equivalente en evidencia/comandos.md.

**No mezclar run verde con status posterior:** run 39159774744 para SHA documental dda9cef acabó cancelled, `e2e-preview` contexto error. La revisión acepta la evidencia de código idéntico, pero no inventa estado verde del nuevo run. El approval-policy viejo falla por CON BLOQUEANTES y body se reemplaza al publicar este informe.

**Riesgo documentado:** 39106145856 cancelado dentro de global-settings a ~30m; pilot_active false luego provocó red en otras PR. No asumir que siempre funciona el finally bajo cancelación externa. El run nuevo terminó normal y sus aserciones de restauración pasaron. Mutación T-369 y acta staging NO ejecutadas.