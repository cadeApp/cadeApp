# PR #254 — T-302 · E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/254 |
| **Tarea** | T-302 (Fase 3) |
| **Autor** | @asako669 (P3) |
| **Rama** | `feat/T-302-courier-onboarding-e2e` → `develop` |
| **Base vigente R4** | `6e2da8fb02d4797b9add222206342e6055f1d81c` |
| **Head revisado R4** | `2033b931e192b822f4e0b26578d174465f099fbc` |
| **Sincronización R4** | ahead 11 / behind 0 |
| **Estado** | SIN BLOQUEANTES TÉCNICOS · pendiente aprobación humana |

> Canonical desde R4: esta carpeta vive en `docs/revisiones` porque la PR es de P3. Las rondas 1–3 habían sido registradas también en la rama de la tarea por la revisión; no se vuelve a mover esa rama para corregir el histórico.

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `32477a05841ca669ac9ac7a36f929f2261e4c926` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `13caf3f68c5c28613487290a0797852c8a161b7c` | 2 bloqueantes nuevos | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `8a39cab4f7ed740ea7c32e6f8cea14fea3c3760a` | 3 bloqueantes | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `2033b931e192b822f4e0b26578d174465f099fbc` | SIN BLOQUEANTES; H05 aceptado por D01 | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado final por hallazgo

| ID | Título | Estado |
|---|---|---|
| PR254-H01 | La prueba DoD de DNI no ejecuta la deduplicación de producción | arreglado-verificado |
| PR254-H02 | Los flujos UI tienen escapes que permiten verde sin interacción obligatoria | arreglado-verificado |
| PR254-H03 | El courier del fixture ya llega aprobado y con onboarding completo | arreglado-verificado |
| PR254-H04 | El MFA se eleva en otra sesión y la RPC directa oculta el fallo del navegador | arreglado-verificado |
| PR254-H05 | Faltaba GREEN real y mutaciones RED E2E reproducibles | **aceptado por D01 de Lautaro073** |
| PR254-H06 | El spec inventaba un DNI_HMAC_SECRET alternativo | arreglado-verificado |
| PR254-H07 | La ronda se pidió con la rama 48 commits detrás de develop | arreglado-verificado |
| PR254-R01 | Selectores E2E demasiado amplios rompían 3 casos en Preview | arreglado-verificado |

## Resultado R4

- `develop...HEAD`: ahead 11 / behind 0.
- CI principal exact-head: ✅.
- Vercel: ✅.
- `e2e-preview` run `37549090092`: ✅ 42/42 chromium + 3/3 global-settings.
- T-302 dentro del runner: ✅ 5/5, sin retries.
- `approval-policy`: ❌ únicamente porque falta una aprobación vigente de Lautaro073.
- PR continúa en draft; eso es estado de flujo, no hallazgo técnico.

## D01 — decisión de Lautaro073

El 2026-10-06 Lautaro073 eligió **A**: aceptar la excepción de H05. La razón es que el host local de P3 falla cerrado sin credenciales de Supabase Develop y ejecutar las mutaciones contra Preview exigiría, con el mecanismo actual, publicar temporalmente código que elimina protecciones de MFA/deduplicación.

La excepción **no convierte la mutación faltante en verificada**. H05 queda `aceptado` por decisión humana con evidencia compensatoria:

- 5/5 E2E T-302 reales GREEN sobre el SHA exacto;
- flujo MFA real en browser y deduplicación real vía UI/action;
- cobertura unitaria adicional de `AAL2_REQUIRED` y `DNI_ALREADY_REGISTERED`;
- Issue #289 abierto para crear un mecanismo seguro de mutaciones RED remotas.

## Siguiente paso

La revisión técnica está cerrada. Falta la aprobación humana vigente de Lautaro073; después `approval-policy` debe reevaluarse.