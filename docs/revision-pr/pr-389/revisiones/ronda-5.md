# Revisión independiente — PR #389 / T-362 — ronda 5

Fecha: 2026-10-17.
HEAD revisado: `37c7e8a53fcba957a1ccd1b32b10b68654a9ffac`.
SHA funcional probado por E2E: `ae05b35cf46b5217f37932c76fdff9cad2fe996a`.
Estado: **T-362 funcionalmente VERIFICADA por E2E real; PR aún CON BLOQUEANTE DE GATE GLOBAL (T-306) y aprobación humana pendiente**. No hay hallazgos nuevos de código.

## Integridad de la comparación

- Desde el commit de revisión R4 `deaa6a8` hasta HEAD hay dos commits del autor que únicamente modifican `docs/tasks/log/T-362.md`. Desde el SHA probado `ae05b35` hasta el HEAD actual también hay SOLO un archivo cambiado: la misma bitácora, 25 líneas. No cambia ninguna prueba ni implementación T-362.
- GitHub compare develop...HEAD: ahead=12, behind=0, mergeable=true. PR sigue Draft.
- Releí el conjunto de reglas del proyecto y la ficha desde develop, comentarios, bitácora, fuente relevante y salida de jobs de Actions. No ejecuté Vitest ni Playwright en un clon propio. El E2E fue ejecutado por CI confiable, y verifiqué su log independiente.
- No se tocaron los archivos de revisión por el autor. La bitácora registra el resultado E2E pero no adulteró tests.

## Evidencia exacta del gate

Run `39064324483` (https://github.com/cadeApp/cadeApp/actions/runs/39064324483), job `117488688553`: checkout del SHA `ae05b35`; Vercel Preview y Supabase Develop; health check y targeting aprobados.

- **Chromium: `87 passed (21.9m)`**, todos los casos. El caso T-362 aparece como #76, `e2e/specs/request-states.spec.ts:1149:7`, **PASS (44.9 s)**. La bitácora del autor decía 77 tests Chromium; el log real dice 87, así que se prioriza la cifra observada.
- El test T-362 real cubre cancelación de courier matched → published y razones/actor/acceptedOfferId en Postgres; cancelación merchant matched → cancelled en dos pasos y razón/actor; actor ajeno rechazado mientras matched; ambos actores en in_transit con Reportar un problema visible y sin cancelación simple. Estos oráculos están en el spec que CI corrió sin modificaciones posteriores.
- El job E2E global **NO quedó verde**: `global-settings` / T-306 / `subscription.global-settings.spec.ts:107` DoD 1 falló tres veces por la aserción de la línea 136: `getByRole('alert').filter({ hasText: /suscripción está vencida|SUBSCRIPTION_INACTIVE/i })` no halló el mensaje en 10 s. El resto de los tests `global-settings` quedó sin ejecutar. No hay prueba en ese run de si se publicó una solicitud erróneamente: el oráculo SQL estaba después de la aserción fallida.
- GitHub Actions run concluyó **failure**, por lo que el commit status `e2e-preview` no puede considerarse success. Es un bloqueo global real de la PR, **no un fallo de T-362**.
- Se creó el issue independiente [#405](https://github.com/cadeApp/cadeApp/issues/405) para diagnosticar T-306. Es distinto del ya cerrado #249, que trataba un timeout de login en el DoD 2. No tocar los contratos o test T-306 dentro de T-362.
- La última corrida automática para el HEAD exclusivamente documental, run `39066467970`, estaba **in_progress** durante el chequeo. No inventar su resultado. El CI del HEAD también estaba en progreso; por regla de oro 10 no se requiere CI GREEN nuevo solo por bitácora.

## Estado de hallazgos anteriores

| Hallazgo | Estado ronda 5 | Justificación |
|---|---|---|
| H01 | **arreglado-verificado** | Flujo E2E merchant + courier, SQL y autorización; T-362 PASS en run #39064324483 |
| H02 | **arreglado-verificado** | Negativos in_transit de ambos roles ejecutados en el mismo caso E2E aprobado |
| H03 | arreglado-sin-verificar | Oráculos literales independientes y unit green en CI, sin mutaciones nuevas propias del revisor |
| H04 | arreglado-sin-verificar | Cableado actor desde contenedores y Otro probado por unit; sin reproducción independiente de mutaciones |
| H05 | **parcial** | E2E específico T-362 PASS, pero gate completo E2E red por T-306; DoD formal [ ] |
| R01 | **arreglado-verificado** | Copy del paso 2 de merchant comprobado en Playwright |
| R02 | **arreglado-verificado** | Actor ajeno probado en matched, antes de cancelar, en Playwright |
| R03 | arreglado-sin-verificar | Harness corregido; autor declaró ejecución RED/GREEN, revisor no corrió mutantes |

El campo verificado_en_sha se usa solo para los hallazgos comprobados contra `ae05b35` por E2E real, no contra el HEAD documental de la revisión. El código funcional se confirmó sin cambios desde ese SHA.

## Checks y acciones

- Último CI completo verde consultado en ronda 4: run `39061791920` sobre `dfe467a`: unit 142 archivos, 2685 tests; db-tests 29 archivos, 2735 tests PASS; typecheck/lint/build/audit/bundle-budget PASS. Para commit documental de R5 no se exige otro CI green.
- `approval-policy` de la PR P2 sigue fallando porque falta aprobación vigente de Lautaro073. La PR continúa Draft.
- **Gate pendiente:** arreglar la causa del fallo T-306 en su propio issue/PR (#405) y obtener un run `e2e-preview` global GREEN, sin editar workflow, contratos ni falsificar/saltear pruebas en T-362. Un run E2E existente que falló fuera de la tarea no pasa por completo el gate.
- No se aprueba, no se mergea. Tras verde global: Ready for review y aprobación humana vigente de Lautaro073.

## Mejora documental — no bloqueante

La bitácora/PR describe 77 Chromium, pero el job real dice 87. Corregir la cifra únicamente si se vuelve a editar bitácora; no generar un commit exclusivamente para ello ni exigir otra CI.

Resultado final: **Sin hallazgos nuevos de T-362; E2E específico verificado; PR sigue bloqueada por gate global ajeno y aprobación humana**.