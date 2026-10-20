# Revisión independiente — PR #389 / T-362 — ronda 3

Fecha: 2026-10-17
SHA funcional revisado: 059270f612fcfd00fdefab24e5aea3ebf57f81ef
Resultado: CON BLOQUEANTES DE GATE (2), sin nuevos bloqueantes de código: E2E Preview no ejecutado y rama no sincronizada con develop. Además requiere aprobación humana vigente de Lautaro073.

## Método

Releí instrucciones y reglas, ficha T-362 desde develop, comentarios, bitácora, diff íntegro desde ronda 2, el diálogo y SQL de autorización. Inspeccioné la CI sobre el SHA funcional y sus logs reales. No pude clonar GitHub en el runtime (DNS), así que no ejecuté Git merge-tree ni mutaciones locales. No se inventa verificación runtime.

La corrección del autor desde el commit de revisión c0ec193 modificó únicamente e2e/specs/request-states.spec.ts y docs/tasks/log/T-362.md. No tocó docs/revision-pr/. Los archivos siguen autorizados por la ficha.

## Revalidación de rondas previas

| Hallazgo | Estado | Evidencia |
|---|---|---|
| H01 | Arreglado sin verificar | E2E merchant matched + courier matched, motivo, actor y estado por SQL; aún sin E2E ejecutado |
| H02 | Arreglado sin verificar | Negativos in_transit precedidos de vista válida y Reportar un problema por ambos roles |
| H03 | Arreglado sin verificar | Arrays esperados literales independientes de producción |
| H04 | Arreglado sin verificar | Tests reales de integración de containers y actions por actor |
| H05 | Parcial | Casilla E2E [ ] correcta, sigue faltando run Preview |
| R01 | Arreglado sin verificar | E2E líneas 1293–1302 compara copy real del componente: ¿Confirmás la cancelación definitiva? y Las ofertas se van a cerrar. No se puede deshacer. |
| R02 | Arreglado sin verificar | E2E líneas 1238–1271 verifica matched/acceptedOfferId, actor propietario positivo y segundo courier no asignado ANTES de cancelar |
| R03 | Arreglado sin verificar | El autor documentó harness Windows shell:true y GREEN 17/17 antes/después de cinco mutaciones RED; no fue ejecutado por el revisor |

La prueba R02 ya no usa un viaje cancelado para probar permisos. Una vez creado matched, verifica la solicitud viva y accesible al comercio, luego niega al courier ajeno y recién después permite cancelar. No hay causa para modificar RPC ni para abrir CC.

## CI comprobado, no solo color

El run CI #39053655012 corresponde exactamente a SHA 059270f; conclusión success.
- unit: Test Files 140 passed (140); Tests 2593 passed (2593). Además workflows 79/79 y ADR 6/6.
- typecheck, lint, audit, build, bundle-budget: PASS.
- db-tests: job #117457127855 termina Files=27, Tests=2420, Result: PASS; comparación de tipos PASS. Los fallos temporales que constan en el log son mutantes intencionales restaurados.
- Vercel: deployment success.
- e2e-preview: estado ERROR porque el run #39053732705, evento repository_dispatch, acabó CANCELLED. resolve-preview fue success, job e2e-preview quedó cancelled, report-preview-status success. No hubo resultado de Playwright. El log del job cancelado no está disponible; no inferir motivo de cancelación.
- approval-policy: FAIL. Log del job #117457124262: El PR requiere aprobación vigente de Lautaro073.

## Gates aún bloqueantes

G1 — E2E Preview cancelado. No equivale a test fallido ni a verde. Debe ejecutarse el caso de T-362 en Preview real y registrar SHA, run, estado y oráculos DB. El revisor no dispara manualmente workflows. Preferible ejecutar tras sincronizar develop para verificar la integración final.

G2 — Rama atrasada frente a develop. En la última comparación vista había más de 160 commits nuevos en develop; varios cambian request-states.spec.ts y componentes merchant. El API de GitHub mostró mergeability fluctuante (true/false/null durante la actualización de develop), por lo que NO se afirma conflicto demostrado. La rama debe incorporar origin/develop por merge, no rebase, resolver colisiones si existen y volver a comprobar suites. Una integración de código sí exige nuevo CI; nuestra documentación NO.

G3 — Aprobación humana posterior. La PR de P2 exige aprobación vigente de Lautaro073. No aprobar automáticamente ni debilitar approval-policy.

## No pedir CI por documentación

El commit de esta ronda solo agrega/modifica docs/revision-pr/pr-389. Conserva como evidencia válida el CI verde del SHA funcional 059270f. NO exigir otro CI verde solo por escribir esta revisión o bitácora. Sí revalidar luego de fusionar develop y comprobar el E2E que nunca completó.

## Conclusión

No aparecen bloqueantes de código nuevos. Los hallazgos anteriores fueron corregidos por inspección; ninguno pasa a arreglado-verificado porque no pude ejecutar los mutantes ni el E2E. Todavía NO está listo para merge por G1/G2 y approval-policy. No aprobar, no mergear, no tocar contratos, fixtures, migraciones, .agents, .github ni producción.
