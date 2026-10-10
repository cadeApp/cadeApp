# Evidencia — PR #295 Ronda 11

**HEAD funcional:** `3b7484e4b310f41d78eb6de06d21a6cedee10686` sin cambios desde R10. **Revisión docs solamente.**

**Fuente QA proporcionada por P1:** Samsung SM-G780G Android 13 Chrome 154, WebAPK `org.chromium.webapk.ab06ec2e1e63b5a67_v2`; manifest y SW GET 200 MIME correcto, 3 arranques llegan a /login, Chrome común muestra landing, offline muestra «Sin conexión». B / standalone BLOCKED, D registro/legal BLOCKED, primer arranque no tiene video temporal. F y G NOT TESTED.

**Nueva reproducción P1:** register funciona; términos desde login se queda en login; términos desde register redirige a login.

**Inspección repositorio SHA:** `src/features/auth/components/login-form.tsx` y `register-form.tsx` enlazan `/legal/terms` y `/legal/privacy`. `src/app/(public)/legal` contiene index, terms, privacy, courier y pilot. `src/features/auth/guards.ts` no incluye /legal en `isPublicRoute`; la ruta sin sesión cae en `evaluateRouteGuard` default-deny a login. `src/middleware.ts` sí corre sobre /legal. Esta es la causa probable fuerte fundada por código, no headers de GET observados por revisor.

**Estado:** PR295-H14 y PR295-H15 arreglado-verificado atribuidos a QA P1/Codex; PR295-H16 abierto BLOQUEANTE. Alcance para guards fuera de T-338 y de R9-A; pendiente decisión P1, no editar auth por inercia.

**Sin ejecuciones inventadas:** revisión no ejecutó GET, ADB, DevTools, mutaciones ni tests del nuevo hallazgo. No se tocaron ramas funcionales.
