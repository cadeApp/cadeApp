# PR #180 — [T-307] E2E de notificaciones y resiliencia

- **Tarea:** T-307
- **Issue:** #39
- **Rama:** `feat/T-307-notificaciones-resiliencia`
- **Autor:** asako669 (P2)
- **Revisión independiente — ronda 1:** SHA funcional `a62abb26d5fbde522f7cf41a2363e0b2e0b30126` — CON BLOQUEANTES (3)
- **Revisión independiente — ronda 2:** SHA funcional `0a70b6819e67a8c83c6b8ddb8a5f160ff5096240` — CON BLOQUEANTES (2 + dependencia T-327)
- **Revisión independiente — ronda 3:** SHA funcional `ae0758b7c8f8fc88dd2a4201f738835faf200f48` — CÓDIGO CORREGIDO / VERIFICACIÓN E2E T-307 PENDIENTE
- **Revisión independiente — ronda 4:** base `bb2fe2a05a8fb8020b24f1eed581dc8f901e62a3` — fix mínimo H07 + merge de `develop`; VERIFICACIÓN E2E T-307 PENDIENTE
- **Proceso:** la autorrevisión previa del agy se preservó como `revisiones/autorrevision-agy-r1.md`; no cuenta como verificación independiente.
- **Decisión P1 D01:** 1-A aplicada — T-206 figura como dependencia de T-307.
- **Infra E2E:** el gate trusted ejecuta `notifications.spec.ts`; T-333/#229 cerró reconnect. El bloqueo actual es **T-335 / #244**: publicación versionada de Supabase Realtime para `offers`/`delivery_requests`.
- **Revisión independiente — ronda 5:** SHA `d967b7820a43155b076fc0cd501d4a2953054132` — runner trusted ejecutó T-307; 1/3 GREEN y 2/3 RED por producto.
- **Revisión independiente — ronda 6:** SHA `cfea63d76850692c3bf99c832cf4044b3859f792` — RED reproducido con autodiscovery; colisión T-331 corregida renombrando/reabriendo #229 como T-333.

- **Revisión independiente — ronda 7:** SHA `47152d69d1de0a6b32db21f0ab98a8f36e27e8d9` — reconnect GREEN, offline/form GREEN, Realtime RED 3/3 en dos trusted runs; nuevo bloqueo T-335/#244.
