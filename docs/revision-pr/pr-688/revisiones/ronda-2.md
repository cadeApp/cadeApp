# Informe revisar-pr — PR #688 / T-431 · Ronda 2

**Fecha:** 2026-11-11. **SHA de código:** `93a08afce1d1f36f78eab6f9828ff969539c0183` (padre `b636fa4093641e97a15193820fcfbc717f28dec1`). Base develop: `af023d3099e9e2ea15e3b78bf0cf5937e699058a`.

**Resultado: SIN BLOQUEANTES de código detectados por inspección.** H03 y H04 corregidos, pero sus mutaciones no están verificadas independientemente (ver evidencia). Sin aprobación ni merge.

## Alcance

Leí la ficha de `develop`, la ampliación autorizada en la rama, la bitácora, comentarios, diff y código completo de los archivos tocados. La PR está 7 commits ahead/0 behind; GitHub informa mergeable=true, sin ejecución local de git merge-tree. Ronda 2 modificó **solo cinco** archivos: dos componentes push, sus dos archivos de test y `docs/tasks/log/T-431.md`. Ningún archivo `docs/revision-pr/**` fue tocado por el autor. La descripción de PR ya refleja `copy` y los nuevos componentes compartidos.

## H03 — Corregido por inspección

`src/features/notifications/push/components/embedded-push-permission-prompt.tsx` importa `PushPromptErrorBoundary` desde `../push-prompt-entry`, reutiliza ese boundary y envuelve el prompt diferido. Restauró la protección de errores local con aviso y botón de recarga sin copiar implementaciones ni diferenciar roles.

En `src/app/(merchant)/merchant/plan/notifications/page.test.tsx`, el mock delega al prompt real salvo cuando un flag provoca una excepción de render. Un test por rol espera `role="alert"`, texto «No se pudo cargar el control de notificaciones» y botón «Recargar la página». El mock se restaura después. El autor declara RED por falta de boundary, GREEN y mutación M1 que lo elimina (2 failed, 2 passed). **La revisión no ejecutó las mutaciones**, por lo que no marca `verificado_en_sha`. El caso ejercita error de render, no red de chunks E2E.

## H04 — Corregido por inspección

`src/features/notifications/push/components/push-permission-prompt.tsx` cambió la firma a `subscribeErrorMessage(code, text)` y todas las ramas ahora leen `text.status*`. Enumero los casos: `push_service_unavailable`, `permission_blocked`, `unauthorized`, `network_error`, `missing_vapid_key`, `missing_keys`, `unsupported`, `subscription_failed` y `default`.

La prueba parametrizada ejercita **nueve filas** (ocho códigos + default) con click real, suscripción fallida, `copy` personalizado y comparación tanto positiva como negativa del mensaje en `role="alert"`. El autor declara RED 11 failed/7 passed, GREEN 18/18, mutación M2 `network_error` 1 failed/10 passed. La corrección cubre la clase completa por lectura; **no** se equipara la salida escrita por el agente a ejecución independiente.

## Otros puntos

- **H01:** páginas merchant/courier montan componente real con sus copias; sigue sin reproducción de R1 original por el revisor.
- **H02:** R1–R3 son evidencia autorreportada conservada en `evidencia/red.md`. R3 conserva el placeholder `<archivo>`, no es comando literal completo.
- **H05:** en R2 el autor respetó la carpeta reservada a la revisión; se conserva red.md histórico como evidencia del autor, sin borrar ni adjudicarla como propia.
- **D01=A:** se mantuvo la condición exacta + subruta con separador; no se introdujo falsopositivo `/merchant/planes`.
- WhatsApp de admin, barra courier, esquema, RPC, contratos, `src/ui` y dependencias no fueron alterados por el commit de arreglo.

## Checks y límites reales

La bitácora y el cuerpo de PR dicen `pnpm test`: 202 archivos/3775 tests, `typecheck` y `lint` verdes. Eso es **declaración del autor**.

CI del SHA `93a08afc`, run `43094486231`: jobs `typecheck`, `lint`, `build`, `audit`, `bundle-budget` y `unit` completaron SUCCESS al consultarlos. `db-tests` todavía estaba en progreso. La lectura del log `unit` expiró por timeout: **no se verificó el conteo 3775 en el log**, solo el estado exact-head y el código. En lint, `format:check` advisory declaró advertencias globales (348 archivos), sin convertir el job en error. `approval-policy` falló por la ausencia del informe formal SIN BLOQUEANTES en el cuerpo; la publicación de esta ronda incluye agregar esa sección. No confundir ese fallo de formato con uno de código.

No existe clon local: `git ls-remote` desde el contenedor falló por DNS, y no se ejecutó pnpm. El revisor preparó cinco mutaciones adicionales propias (texto/botón del fallback y `permission_blocked`/`missing_keys`/`default`); validó la sintaxis de Bash y Node del script completo, **no sus resultados**. Se adjunta en `evidencia/comandos.md`. Por ello H03/H04 permanecen `arreglado-sin-verificar` en el JSONL aunque el código y los tests sean conformes por inspección.

## NO TOCAR y cierre

No volver a `audience` ni duplicar wrappers; no cambiar push sender, SQL/RLS, contratos, bases, `src/ui`, ni dependencias. No exigir CI nuevo solo por archivos de documentación/revisión. No reescribir la Ronda 1 ni borrar evidencia autorreportada.

**Sin bloqueantes nuevos de código**. Queda explícita la limitación de verificación independiente de mutaciones y del resumen del log unit; no se presenta como aprobación formal, no se mergea la PR.