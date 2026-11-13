# Ronda 2 — T-436 / PR #738

**Fecha:** 2026-11-12 (Argentina). **Resultado: CON BLOQUEANTES (1 nuevo: PR738-H05)**.  
**SHA de autor revisado:** `865eb34622252153475097c4c05894fa62e971b2`. **Base:** `develop@3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc`.  
**Rama:** `feat/T-436-csp-enforce`. No aprobar ni mergear.

## Cómo se verificó

Leídas nuevamente la ficha en la rama del PR, el plan, la bitácora T-436 y los comentarios, y contrastados contra `src/security/headers.ts`, `next.config.ts`, `e2e/specs/security-headers.spec.ts`, `e2e/AGENTS.md`, `docs/tasks/T-347.md`, `.github/workflows/e2e-mutation.yml`, `.github/workflows/e2e-mutation.mjs` y `e2e/mutations/manifest.json` de develop. Los contratos de T-391 se mantienen. El diff del commit `865eb34622252153475097c4c05894fa62e971b2` modifica solo `docs/tasks/T-436.md`, `docs/tasks/log/T-436.md` (nueva) y fila T-436 del plan; el autor no tocó `docs/revision-pr/pr-738/`.

Al consultar, `develop` sigue en `3c4d26b`; HEAD del PR está en `865eb34622252153475097c4c05894fa62e971b2`, 7 commits por delante y 0 detrás; GitHub informa mergeable. Sin ejecución de `git merge-tree` local, porque el contenedor no resuelve github.com; no convertir ese dato de API en prueba de `merge-tree`.

Se ejecutaron **probes estáticos independientes contra el contenido obtenido en ese SHA**: H01–H04 y D1-C/D2-A/D3-A dieron presentes; igualdad textual del primer DoD con la columna DoD del plan: **sí**. Las cuatro mutaciones sobre los requisitos de H01–H04 cambiaron su control documental de true a false; el detalle y un script completo reproducible, con selftest ejecutado, se conservan en `../evidencia/comandos.md`. Esto **verifica la especificación/documentación, no una implementación ni E2E real**.

## Resolución de los hallazgos de ronda 1

| Hallazgo | Estado al SHA `865eb346` | Evidencia documental |
|---|---|---|
| **PR738-H01** | **arreglado-verificado (documentación)** | `T-436.md:109-121` exige REST `/rest/v1/`, Storage `/storage/v1/object/`, WebSocket con join/confirmación, operaciones del browser, limpieza y cero eventos enforced; aclara pendiente si falta flujo. **Salvedad H05:** la ejecución exigida de mutaciones de `connect-src` aún no es factible como DoD pre-merge. |
| **PR738-H02** | **arreglado-verificado (documentación)** | `T-436.md:88-99` separa violaciones para orígenes añadidos de inventario y prueba candidata para retirados, sin exigir reporte imposible. |
| **PR738-H03** | **arreglado-verificado (documentación)** | `T-436.md:126-139` define `page.route` solo para host reservado, JS/PNG/JSON válidos y CORS, control positivo en estado Report-Only y aserción de `disposition='enforce'`, directiva, `onerror`, fetch y ausencia de ejecución/petición. El RED deriva de la política real, **no fue ejecutado en esta PR documental**. |
| **PR738-H04** | **arreglado-verificado (documentación)** | `T-436.md:83-92,123-124` registra evento `securitypolicyviolation` vía `page.addInitScript` antes de navegar, más consola; sanitiza a directiva/disposition/origen y espera operación terminada. |

**Decisiones:** `T-436.md:26-27,37-55,68-74`, bitácora `docs/tasks/log/T-436.md:8-13` y cuerpo de PR: D1-C (enforce con `'unsafe-inline'` temporal; XSS inline pendiente en #739, urgencia alta), D2-A (sin endpoint) y D3-A (solo enforce; revertir commit de implementación). La procedencia se anota literalmente como selección automática del agente con recomendación, **no como aprobación explícita personal de Lautaro073**. El plan puso D1-C/#739 en la columna de título; la columna DoD coincide literalmente con el primer ítem del DoD de la ficha, conforme al contrato del verificador de fichas. No se exige un cambio en ese punto.

## PR738-H05 · 🔴 NUEVO BLOQUEANTE · ALTO · P15 — mutación obligatoria imposible en PR

**Ubicación:** `docs/tasks/T-436.md:57-66,120-122`; fila T-436 de `docs/implementation-plan.md`.  
**Origen:** ficha. **Estado:** abierto. **Detección:** análisis documental cruzado con implementación real del workflow.

### Diagnóstico

El nuevo DoD exige `RED_CONFIRMED` **con el workflow `e2e-mutation`** para dos mutaciones de `connect-src` (quitar origen HTTPS de Supabase y quitar WSS). Sin embargo:

1. `e2e/AGENTS.md:15-21`, `docs/tasks/T-347.md:29-38,48-62` y el propio `e2e-mutation.yml:3-10,47-65` exigen **`target=develop`, siempre código YA MERGEADO**. Ni el SHA de una PR abierta ni una rama de feature son targets válidos; no basta correr `e2e-preview`.
2. El workflow lee **el catálogo TRUSTED de develop**, no de la PR: `e2e/mutations/manifest.json` y dos archivos `<id>.patch` revisados. El catálogo observado no tiene entradas `t436-*`.
3. Los **Archivos permitidos** de T-436 y su fila del plan **no incluyen** `e2e/mutations/manifest.json` ni los patches. Así el agente no puede crearlos sin salir del alcance. El DoD reclama evidencia `RED_CONFIRMED` antes de dar por terminada la implementación, pero la infraestructura solo puede producirla tras un merge seguro y con catálogo incluido.

### Corrección propuesta (sin relajar seguridad)

- **Sin modificar el workflow ni permitir PR/SHA como target.** Es una frontera de seguridad que debe conservarse.
- Actualizar en la ficha y fila del plan los archivos permitidos de la **futura PR de implementación**: `e2e/mutations/manifest.json` (solo nuevas entradas T-436) y `e2e/mutations/t436-csp-connect-https.patch`, `e2e/mutations/t436-csp-connect-wss.patch`. Los patches solo modifican `src/security/headers.ts`, nunca tests, secretos ni configuración del runner, y declaran `spec`, `grep` y `expectedFailure` de aserciones REST/Storage y Realtime respectivamente. Los nombres son propuesta explícita: la autorización de ampliación del alcance corresponde a Lautaro.
- Separar **gates antes de mergear** la implementación (unidad, E2E real en `e2e-preview` sobre SHA final, RED real del bypass contra Report-Only anterior, y control de catálogo/patches sin disparar trusted) de **validación posterior al merge** (solicitar `e2e-mutation` sobre `develop`, controlar que baseline sea GREEN y mutante `RED_CONFIRMED`). No dar por cerrado el issue CSP #669 hasta registrar la evidencia post-merge. Dejar el seguimiento explícito si se decide mergear con ese pendiente.
- Si no se autoriza ampliar archivos, alternativa: quitar del DoD **de esta tarea** el requisito de `RED_CONFIRMED` y crear otro seguimiento documental independiente para catálogo y mutaciones post-merge; nunca afirmar que se ejecutaron ni bajar la exigencia de pruebas reales de la CSP.

### Cómo comprobar la corrección (mutación documental independiente)

Control GREEN: una ficha corregida lista los tres paths de mutaciones en Archivos permitidos y la columna del plan; el DoD separa pre-merge/post-merge, remite a `target=develop` **solo post-merge**, y declara el follow-up de cierre del issue. Mutaciones RED en memoria: quitar del alcance el manifest o el patch WSS, o volver a exigir `RED_CONFIRMED` como gate de PR sin etapa posterior; el verificador debe fallar. **No crear ni disparar workflows, no tocar código de producción ni debilitar expectativas** en esta PR documental.

## Checks y límites

- **Inspección/guardas estáticas documentales:** positivas para H01-H04 y sincronía plan, negativas para factibilidad de H05. Selftest del script (fixture sintética) pasó; guardas contra fuentes del SHA ejecutadas en la conexión GitHub.
- **`pnpm exec vitest run tools`:** el autor informa **10 archivos / 123 tests**, y `git diff --check` limpio. **No reproducidos por el revisor**: no hay checkout; `git ls-remote` falla por DNS. No afirmar GREEN propio.
- **CI oficial:** no se inspecciona hasta que desaparezca H05; PR solo documental, sin E2E de implementación. Tampoco se exige CI nuevo por actualizar bitácora o carpeta de revisión.
- **No se requieren CC, cambios en `supabase/**`, código `src/**`, `.github/**` ni nuevas dependencias** para cerrar esta PR documental.

## NO TOCAR / falsos positivos descartados

- La igualdad textual DoD–plan se mantiene; D1-C/#739 en título es correcta, no un desvío.
- No exigir nonces/Trusted Types ahora: la deuda estricta está en #739.
- H01–H04 se consideran **corregidos documentalmente**; no exigir que el autor ejecute los E2E futuros en esta PR.
- No marcar un futuro `RED_CONFIRMED` sin ejecutar el trusted job sobre `develop`.

**Resultado: CON BLOQUEANTES (1 nuevo, H05).** La propuesta de ampliación de alcance es una decisión para Lautaro, no una autorización asumida. El comentario de cierre incluye prompt acotado, con `git pull` obligatorio. El commit de revisión mueve el HEAD; `verificado_en_sha` de H01–H04 apunta exclusivamente a `865eb34622252153475097c4c05894fa62e971b2`, no al commit de revisión.
