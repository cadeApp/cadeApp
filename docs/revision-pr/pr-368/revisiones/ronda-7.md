# Informe revisar-pr — PR #368 / T-354 — Ronda 7 (cierre)
 
**Fecha:** 2026-10-16  
**SHA final de implementación revisado:** `6c2a6d2d2f5f71d47ca0ae4837e88a862d416322`  
**Base develop:** `af0cf1d72e9e33524cde5db138d940fee33ce6f6`  
**Resultado:** **APTA PARA MERGE CON OBSERVACIONES NO BLOQUEANTES**. Código de copy sin fallas detectadas; 0 bloqueantes nuevos.

## Alcance y sincronización
- GitHub compara feature vs develop: `behind_by=0`, `mergeable=true`, `mergeable_state=clean`. Los 21 archivos del diff se limitan a fuentes de onboarding/admin y sus tests, `courier-panel.test.tsx` autorizado por decisión 1-A, `docs/tasks/T-354.md`, bitácora y `docs/revision-pr/pr-368/**`.
- Kira sincronizó por **merge** los commits de develop, sin rebase/force. La comparación de los commits posteriores a la revisión R6 refleja incorporación automática de cambios ajenos desde develop, no ampliación propia de T-354.
- La ficha de T-354 leída desde `develop` autoriza las rutas de onboarding/admin; la extensión del test cruzado está documentada específicamente en la ficha de PR (decisión 1-A).

## Implementación y pruebas
- Onboarding, estado, perfil, admin y su badge usan `Selfie con el DNI`; instrucción literal: `Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones`. Input file con nombre accesible; texto multilínea sin truncamiento; identificador interno `selfie` sin modificar.
- El test cruzado `courier-panel.test.tsx` cambia el nombre visible y **conserva la aserción de `Pendiente`**.
- No se introdujeron cambios de RPC, RLS, DB, auth, Storage, contratos, paquetes, fixtures de seguridad ni `e2e/**` en el diff de T-354.
- **Comprobación propia independiente:** lectura de 9 archivos en GitHub sobre el SHA indicado; 14/14 verificaciones estáticas GREEN; 14/14 mutaciones propias sobre copias de contenido en memoria detectadas. **No se ejecutaron estas mutaciones contra Vitest**. El harness de autor ya superó en R5/R6 una prueba hermética de control positivo/negativo.

## CI — no quedarse con el color
| Gate | Resultado sobre `6c2a6d2d` |
|---|---|
| `unit` | **SUCCESS**, 135 files / **2419 Vitest passed**, 79 workflow node:test, 6 ADR (job 117142235252) |
| `typecheck`, `lint`, `audit` | SUCCESS |
| `build` | **SUCCESS**, compilación Next en 28.9 s, 50/50 páginas generadas (job 117142235214); el error previo de next/font no se reprodujo |
| `db-tests` | **SUCCESS**, 26 archivos pgTAP / 2341 tests PASS; los RED transitorios controlados internos pertenecen a CC ajenos (job 117142235118) |
| `bundle-budget` | SUCCESS |
| Vercel Preview + deployment | SUCCESS |
| `approval-policy` | SUCCESS, revisión `APPROVED` vigente de Lautaro073. Este revisor no emitió aprobación adicional |
| `e2e-preview` | **SUCCESS** sobre SHA exacto, [run 38951164081](https://github.com/cadeApp/cadeApp/actions/runs/38951164081), job 117142691597 |

### Observación E2E no bloqueante — *flaky* de otra tarea
El log del **mismo run que terminó SUCCESS** registra en `e2e/specs/map-privacy.spec.ts:498` (T-314) un **HTTP 500** de `/api/live/available-requests` en el primer intento de una aserción que exige 200. Playwright lo marcó `1 flaky` y el test pasó en el reintento. Totales reales: **78 passed, 1 flaky (Chromium)** y **3 passed (global-settings)**; el estado publicado `e2e-preview=success` concuerda con el resultado de Playwright. **Esto no demuestra una fuga de coordenadas**: el punto de fallo fue el código HTTP antes de inspeccionar cuerpos, y no es un cambio implementado por T-354. Se deja seguimiento recomendado a T-314, sin modificar tests ni ocultar el fallo. No se presentan 79 Chromium perfectos.

## Hallazgos acumulados
- **H01 y H03:** `arreglado-verificado`; revisados nuevamente en SHA `6c2a6d2d`.
- **H05:** `arreglado-verificado` para el defecto del harness que aceptaba mutantes supervivientes; el algoritmo fue falsado y corregido en rondas anteriores.
- **H02:** `parcial` para reproducción runtime de las nueve mutaciones del autor. El revisor no pudo clonar/ejecutar Vitest mutado en esta sesión. La comprobación propia (14 mutantes de contenido detectados), el harness reparado y CI GREEN aportan cobertura independiente suficiente **para esta modificación de copy**, sin fingir cierre runtime.
- **H04:** `parcial` exclusivamente en inspección visual independiente de capturas externas. Existen enlaces permanentes 360×800/390×844 aportados por Kira y el JSX correcto se revisó. El **E2E del SHA actual sí está aprobado** en CI. Los enlaces externos no pudieron descargarse desde esta sesión, por lo que no se los certifica como revisados visualmente.

**Decisión de revisión:** 0 bloqueantes de implementación o gate. Las dos limitaciones de evidencia quedan auditadas como `parcial`/observación no bloqueante, nunca se convierten artificialmente en `arreglado-verificado`. La instrucción del usuario autoriza **merge si está lista**, así que esta ronda recomienda merge con `expected_head_sha` del commit de revisión, sujeto a que GitHub no presente nuevos bloqueos.

## Cierre de trabajo de KiraK72
Solo cuando GitHub confirme que la PR #368 quedó efectivamente **MERGED** en develop:
1. Consultar su **lista de tareas asignadas vigente** (board/Issues de cadeApp, carril P2) y escoger la siguiente **habilitada**, no la primera bloqueada ni una tarea ya tomada/mergeada por otro agente.
2. Comprobar dependencias, fase, dueño, CCs y rama base actual. Si falta alguna dependencia, dejar bloqueo preciso y pasar a la siguiente elegible; no implementar tareas no autorizadas.
3. Iniciar el flujo oficial **`tomar-tarea`** y seguir el protocolo de rama feature → PR Draft → ficha/alcance y test RED→GREEN, respetando contratos, decisiones, tests reales y separación de entornos; no saltear revisión independiente.
4. No marcar la tarea siguiente como iniciada ni declarar un nuevo PR antes de haber confirmado merge #368. Si no hay tareas P2 disponibles, informar cuáles están bloqueadas y por qué.

**No se realizaron modificaciones funcionales en esta ronda. No se alteraron tests ni gates.**
