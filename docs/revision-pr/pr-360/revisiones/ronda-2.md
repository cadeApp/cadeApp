# Ronda 2 — PR #360 · T-359

**Fecha:** 2026-10-15 · **HEAD de autor revisado:** aacf8291fdb331da53b94fa7471679b2792f5ecf · **develop:** 14c28ed3c41cb2bde92705fc018c7dd0df73245b.

**Resultado: CON BLOQUEANTES (H02, H05, H07 y R01).** Clasificación por análisis del código y lectura de CI, no por pruebas locales ejecutadas. No aprobar ni mergear.

## Sincronización, alcance y limitaciones

- Leídas la ficha desde develop, comentarios de la PR, bitácora y diff de 14 archivos; todos pertenecen a Archivos permitidos. Base develop sin divergencia (ahead 7, behind 0), mergeable=true informado por GitHub.
- Desde el commit propio 48177b0 el autor no editó la carpeta pr-360. La autorrevisión `SIN BLOQUEANTES` de asako669 no es revisión independiente.
- El contenedor actual no dispone del repositorio ni pnpm y git falla al resolver github.com. Sin `git merge-tree` ni tests locales. Se comprobó la información de CI sobre el SHA mediante GitHub, sin ejecutar mutaciones.

## Correcciones observadas por inspección (sin verificación independiente)

- **H01:** página server `page.tsx` renderiza Card/Badge y vínculo a historial en cancelled/expired, sin RequestOffersList ni contactos. Decisión B respetada.
- **H03:** `isExpired` contempla expiresAt y timer, bloqueo en apertura y confirmación del modal.
- **H04:** la aceptación exitosa llama `router.replace` en vez de push. El uso de Back real sigue pendiente de E2E.
- **H06:** tests `page.test.tsx` comprueban cancelled, expired, draft, published y redirecciones; no son sólo `toBeDefined()`.

## BLOQUEANTE H02 — ALTO — Reconciliación parcial tras carrera

**Archivo:** `src/features/requests/components/request-offers-list.tsx`, `handleConfirmAccept` (líneas 178–189) y render `Aceptar` (líneas 438–445). Ante `ALREADY_MATCHED` o `REQUEST_EXPIRED`, se cierra modal y se llama `router.refresh()`. Mientras no llegue el nuevo render, la prop request.status sigue published y los demás botones Aceptar siguen visibles/activos. El backend puede impedir segundo match, pero la UI aún permite otro intento desde estado obsoleto.

**Arreglo:** latch de reconciliación cliente que bloquee botones y los handlers al rechazar, hasta revalidación confiable o mecanismo de recuperación que no rehabilite el snapshot viejo. Test con `mockRefresh` sin completar que intente un segundo click y exija sólo una action, con casos ALREADY_MATCHED y REQUEST_EXPIRED. GREEN normal → mutación del latch RED → GREEN restaurado.

## BLOQUEANTE H05 — ALTO — E2E post-match incompleto

**Archivo:** `e2e/specs/main-flow.spec.ts` (flujo de dos sesiones). Los dos contextos aislados y el oráculo DB (exactamente una accepted y request matched) son una mejora real. Pero el E2E no comprueba `goBack`, nombre del courier elegido, importe, medio de pago ni contacto autorizado post-match, y sólo verifica URL y badge Asignado. La sesión perdedora navega manualmente a la URL sin afirmar ausencia inmediata del botón tras error.

**Arreglo:** usar identidad/monto/pago auténticos de fixtures/DB en la vista Trip; verificar revelación post-match y no exposición de teléfono prematch; Back, Refresh, URL directa y dashboard sin selector. Falta ejecutar el caso en Preview: no hay `e2e-preview` en los check runs del SHA. Vercel Ready no es ejecución de la suite.

## BLOQUEANTE H07 — MEDIO — Evidencia RED declarada, no reproducible

**Archivo:** `docs/tasks/log/T-359.md`. El autor informa '3 RED' y '6 RED' seguidos de GREEN, pero no adjunta comandos completos y líneas Tests originales que permitan corroborar la falla. CI posterior demuestra GREEN, no los RED históricos. Insuficiencia de evidencia no es prueba de falsificación.

**Arreglo:** adjuntar comandos y resúmenes auténticos de cada prueba; si no se guardó la evidencia anterior, declararlo y ejecutar mutaciones nuevas, en memoria, sobre código productivo. Nunca cambiar fixtures/aserciones solo para lograr verde.

## BLOQUEANTE R01 — MEDIO — Posible carrera en el propio E2E

**Archivo:** `e2e/specs/main-flow.spec.ts`, expresión `winnerPage = page1.url().includes('/trips/') ? page1 : page2` (~190). El test decide ganador justo después de consultar DB, sin esperar que la navegación SPA haya alcanzado /trips. Si la ganadora aún no terminó de navegar, toma la otra como ganadora y puede fallar una implementación válida. **Riesgo por inspección, no fallo observado**.

**Arreglo:** esperar explícitamente una URL de viaje mediante `expect.poll` antes de clasificar páginas, idealmente asociar la oferta aceptada real de DB al contexto. Probar que una navegación retardada controlada no hace falso rojo; sin sleeps fijos.

## CI del HEAD inspeccionado

| Check | Resultado | Evidencia |
|---|---|---|
| unit | PASS | Logs: 130 test files, 2179 Vitest; 79 workflow; 6 ADR |
| typecheck, lint, build, audit, bundle-budget | PASS | GitHub check-runs del mismo SHA |
| db-tests | PASS | Job: Files=22, Tests=2205, Result: PASS |
| Vercel | Ready | No acredita Playwright |
| e2e-preview | SIN RESULTADO | No figura en la lista de checks del SHA |
| approval-policy | FAIL | Necesita informe independiente conforme al flujo |
| Reproducción de RED/Mutaciones independientes | NO EJECUTADO | No hay clone/pnpm en el entorno |

## No tocar

Contracts, RPC, RLS, SQL, src/server, src/domain, src/ui, migraciones, secretos, AGENTS, .github, .agents, dependencias, ni docs/revision-pr/** desde el agy.

**Cierre:** se publica un único comentario que incluye esta ronda y prompt específico; el autor debe hacer git pull del commit de revisión. No mergear.
