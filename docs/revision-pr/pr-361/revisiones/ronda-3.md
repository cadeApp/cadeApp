# Revisión independiente — PR #361 / T-364 — Ronda 3

**Fecha:** 2026-10-15. **Autor:** @asako669 (P2). **HEAD inspeccionado:** `25a787adfe2aaeeed7b9013231582a5c3dddce14`. **Base:** `develop` @ `14c28ed3c41cb2bde92705fc018c7dd0df73245b`. **Resultado:** **CON BLOQUEANTES (3)**, no mergear.

## Alcance de la revisión y grado de certeza
- Inspeccioné cambios desde la ronda 2 (`316e2c5...ddce14`), todos los archivos involucrados, test E2E, bitácora y ficha T-364 leída desde `develop`. El autor **no modificó** `docs/revision-pr/pr-361/**` desde mi último commit: el compare reporta dos commits y cambios solamente en bitácora, `e2e/specs/request-states.spec.ts`, diálogo, lista y test.
- GitHub informa PR mergeable, sin conflicto en su metadato. **No se ejecutó `git merge-tree` en clon propio**: `git ls-remote` devuelve `Could not resolve host: github.com` desde este contenedor.
- CI del HEAD revisado: run [38681382821](https://github.com/cadeApp/cadeApp/actions/runs/38681382821), **success** con lint, typecheck, build, unit, audit, bundle-budget, db-tests. `unit` reporta **2180 tests PASS**; `db-tests` reporta **2205 pruebas pgTAP PASS**, Files=22, Result: PASS. Vercel Preview status success. Esto NO acredita ejecución Playwright del escenario T-364.
- El autor declara mutaciones RED→GREEN para H06–H10. **No las reproduje**, por lo que estos hallazgos quedan `arreglado-sin-verificar`, nunca `arreglado-verificado`. Las observaciones nuevas H11–H13 son **[ANÁLISIS]**, no hallazgos runtime certificados.
- **🔵 DECISIONES:** ninguna. Las correcciones son técnicas dentro de los archivos ya autorizados por la ficha.

## Revisión de arreglos de ronda 2

| Hallazgo | Estado de revisión | Qué cambió |
|---|---|---|
| **H05** | **Parcial** | Ya hay login Playwright, pantalla, dos pasos, oráculo SQL y segundo merchant real; faltan el contador, un historial ligado a `requestId` y prueba fail-closed/ejecución E2E (H11–H12) |
| H06 | Arreglado por inspección, **sin verificar independientemente** | Diálogo: `useEffect` cuando `open=false` + `key` por solicitud, y test de reapertura |
| H07 | Arreglado por inspección, **sin verificar independientemente** | Exclusión con `inFlightRef.current` antes de `startTransition`; test con promesa diferida |
| H08 | Arreglado por inspección, **sin verificar independientemente** | `try/catch/finally`, error y refresh en excepción, sin éxito falso |
| H09 | Arreglado por inspección, **sin verificar independientemente** | Mock de Server Action real, errores literales, `RpcOutput<'cancel_request'>`; permanece `as any` en test nuevo (H13) |
| H10 | Arreglado por inspección, **sin verificar independientemente** | Targets 48px por `min-h-12`, test presente |

H01 aún es **parcial** por el DoD E2E no demostrado. H02–H04 siguen corregidos por inspección, sin mutaciones independientes.

## Bloqueantes de esta ronda

### PR361-H11 — ALTO · Historia y contadores quedan sin probar
**Archivo:** `e2e/specs/request-states.spec.ts:905` · **[ANÁLISIS]**

**Diagnóstico.** El E2E navega a `/merchant/history` y ejecuta `expect(page.getByText(/cancelad[ao]/i).first()).toBeVisible()`. Este texto **ya existe siempre** en el tab `Canceladas` de `src/features/requests/components/merchant-history-view.tsx`, aun sin una sola solicitud cancelada. Es un oráculo tautológico para el historial. Asimismo, el test nunca lee ni compara la tarjeta `Solicitudes activas` antes/después, aunque el DoD lo exige.

**Evidencia.** En `merchant-history-view.tsx` se renderiza el texto permanente `Canceladas`. Ejecución local de alcance limitado: `node -e 'console.log(/cancelad[ao]/i.test("Canceladas"))'` devolvió `true`. Esto **demuestra el falso positivo léxico**, no que un E2E real pasara con el historial averiado.

**Arreglo concreto.** En el test UI T-364, obtener el contador real antes de confirmar con un locator relativo al rótulo `Solicitudes activas` y luego esperar su disminución por 1 tras cancelar. Confirmar que el enlace `a[href="/merchant/requests/${requestId}"]` está en el dashboard antes del click y desaparece de activas tras refresh. En `/merchant/history`, encontrar **ese mismo enlace por ID** y comprobar `Cancelada` **dentro de la tarjeta** en lugar de tab global; verificar que los oráculos de estado, razón y oferta sigan independientes. Mutación RED sugerida: ocultar solo la fila cancelada del historial manteniendo las pestañas; el E2E corregido debe fallar, el actual podría seguir verde. No desplegar un mutante inseguro ni fingir que fue ejecutado.

### PR361-H12 — ALTO · No hay prueba fail-closed ni evidencia de E2E Preview real
**Archivo:** `e2e/specs/request-states.spec.ts:876` · **[ANÁLISIS]**

**Diagnóstico.** El test incluye `if(page && loginAsMerchant) { interacción de UI } else { merchantClient.rpc('cancel_request') }`. Ante ausencia de fixture de navegador, hace **cancelación directa**, permitiendo un supuesto E2E verde sin pantalla. Además usa `.first()` para el botón Cancelar, sin identificar la solicitud sembrada. Aunque Playwright normalmente siempre provee `page`, conservar la ruta alternativa contradice la finalidad del control. El autor **no adjuntó SHA/run/resultado** de la ejecución del caso Playwright en Preview+Supabase Develop, exigidos por T-364. El run CI verificado es de unit/db/build, no de este flujo.

**Arreglo concreto.** Eliminar por completo `if/else`: exigir `page`/`loginAsMerchant` y que toda ruta de éxito pase por `page.goto`, paso 1, paso 2 y click UI. Ubicar la tarjeta por `a[href="/merchant/requests/${requestId}"]` y su botón hermano dentro del mismo contenedor de acciones, nunca `first()` global; admitir múltiples solicitudes activas. Ejecutar `pnpm exec playwright test e2e/specs/request-states.spec.ts --project=chromium -g 'T-364'` contra la Preview del **SHA exacto** conectada a Supabase Develop, guardando identificador de run, logs, SQL y cleanup. Si el entorno carece de acceso, dejar **PENDIENTE/BLOQUEADO**, no `verificado`. La carrera concurrente y el caso `matched` que la prueba nombra deben tener escenarios demostrables o documentar cobertura real independiente. Mutación segura RED: saltar solo el click UI de la spec (no mutar RPC ni desplegar código inseguro), y observar que ya no llega a `cancelled`.

### PR361-H13 — MEDIO, BLOQUEANTE SEGÚN SKILL · `as any` en test de exclusión
**Archivo:** `src/features/requests/components/merchant-requests-list.test.tsx:663` · **[ANÁLISIS]**

**Diagnóstico.** La prueba de doble click dispone de `mockReturnValue(deferredPromise as any)`. El cast suprime precisamente el chequeo de `Promise<ActionResult<RpcOutput<'cancel_request'>,...>>` que H09 pretendía reforzar; la skill `revisar-pr` prohíbe `any`.

**Arreglo concreto.** Usar
```ts
type CancelResult = Awaited<ReturnType<typeof cancelMerchantRequestAction>>;
let resolveAction!: (value: CancelResult) => void;
const deferredPromise = new Promise<CancelResult>((resolve) => {
  resolveAction = resolve;
});
vi.mocked(cancelMerchantRequestAction).mockReturnValueOnce(deferredPromise);
```
Mantener promesa pendiente y dos clicks. Resolver con resultado canónico completo y requestId de UUID válido, sin `as any` ni `@ts-ignore`. Prueba: `pnpm typecheck` y el test específico. Mutación RED: retornar desde el doble una forma `{ok:false,error:'INVALID_STATE_TRANSITION'}` incompatible y verificar que TypeScript la rechace.

## Falsos positivos descartados / NO TOCAR
- No considerar vulnerable la duplicación de `cancelMerchantRequestAction` solo por nombre: sigue delegando a `callRequestRpc` y valida rol. Refactor de consolidación no es requisito de este DoD.
- No cuestionar `matched` como cancelable para merchant: SQL existente lo permite.
- No volver a pedir reset modal, guarda de doble clic, catch, mapeo de mensajes o 48px: esos cambios ya están presentes; requieren verificación independiente, no implementación redundante.
- No tocar `.github/**`, migraciones, `src/domain/**`, `src/ui/**` ni la ficha por estos hallazgos.

## Checklist de cierre
- [ ] Resolver H11–H13 y actualizar bitácora sin adjudicarse verificación independiente.
- [ ] Aportar **ejecución E2E real en Preview/Develop**, con SHA, run, resultado e inspecciones SQL de la solicitud sembrada; test de dashboard+historial fail-closed.
- [ ] Aportar controles RED→GREEN específicos para H11/H12/H13 sin fabricar artefactos ni debilitar fixtures.
- [ ] Repetir CI para HEAD de arreglo y lectura logs, más controles propios de revisión sobre SHA resultante.
- [ ] Solo entonces reconsiderar merge. **No aprobé ni mergeé la PR.**
