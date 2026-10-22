# Ronda 3 — PR #120 / T-202

**HEAD:** `1884b43b72e5978f96c9d2ae4d7ff895cd9c1fde`  
**Resultado:** **SIN BLOQUEANTES**  
**CI:** ✅ unit · typecheck · lint · build · db-tests · audit · bundle-budget

## D04 — evidencia visual diferida

**Decisión de Lautaro073: 4-C.**

La verificación real de T02 a 390×844 y 360×640, en estados granted/denied, no puede realizarse todavía porque el entorno staging se habilitará en T-300, después de cerrar T-202 y la otra tarea pendiente de Fase 2.

Por lo tanto:
- PR120-H10 pasa a **`aceptado`**, no a `arreglado-verificado`;
- los unit tests actuales siguen siendo cobertura, pero **no sustituyen capturas reales**;
- T-202 puede cerrarse sin bloquear Fase 2;
- T-300/staging debe ejecutar la comprobación visual pendiente sobre `/courier/profile/notifications`.

## Revalidación técnica

### H03/H04/H05
Los casos 500, rechazo de red, permiso ya granted y retry de baja están implementados y cubiertos. GitHub Actions `unit` pasa en el SHA exacto.

### H06/H11
Se ejecutó de forma independiente el contenido real de `public/sw.js`:
- 1 listener `push`;
- 1 listener `notificationclick`;
- evento válido `offer_accepted` con `offerId` abre `/trips/:requestId`;
- sin `offerId`, UUID inválido o campos extra/PII => fallback seguro.

El handler TS paralelo fue eliminado.

### H08/H09
No quedan tamaños arbitrarios `max-w-[...]` en T02 ni `animate-pulse`.

### H15
La ruta `/courier/profile/notifications` es Server Component y monta `<PushPermissionPrompt embedded />`; el prompt embebido no agrega otro header ni otro landmark main.

### H16
El endpoint pendiente de localStorage pasa por `PendingUnsubEndpointSchema` (HTTPS); valores corruptos se purgan y no llegan a fetch.

### H12/H13/H14
Copy centralizado, body del PR corregido y no hubo nuevas escrituras del autor en `docs/revision-pr/pr-120/**` después de la Ronda 2.

## CI remoto

Workflow CI `36507514360` — **success**:
- unit ✅
- typecheck ✅
- lint ✅
- build ✅
- db-tests ✅
- audit ✅
- bundle-budget ✅

La falla local documentada por el autor en seis tests de subprocesos no se reproduce en CI; el control remoto oficial del SHA exacto está verde.

## Conclusión

**SIN BLOQUEANTES.**  
H10 queda pendiente por D04 y debe retomarse en T-300/staging. Esta revisión no aprueba ni mergea la PR.
