# Ronda 1 — PR #612 / T-422

**Fecha:** 2026-11-05  
**PR:** https://github.com/cadeApp/cadeApp/pull/612  
**Autor:** Lautaro073 · **Rama:** `fix/T-422-runner-env`  
**Head revisado:** `aa2357d3646e3e963941c979d8ddb452489d313c`  
**Base develop:** `1105eaf42ae457b68cfd004ae182acebae68f3c7`

**Resultado: SIN BLOQUEANTES.** Dos mejoras técnicas/documentales no bloqueantes (H01, H02) y una decisión aceptada por P1 (H03/D01). El resultado de los E2E reales de esta corrección sigue sin verificar: el workflow `workflow_run` usa el archivo de `develop`, no el de la rama, hasta que llegue a `develop`.

## Qué se revisó

Archivos del PR: `.github/workflows/e2e-preview.yml`, `.github/workflows/verify-workflows.test.mjs`, `docs/runbooks/e2e-preview.md` y `docs/tasks/log/T-422.md`. **Los cuatro figuran en «Archivos permitidos» de `docs/tasks/T-422.md` leído desde develop.** Comparación base...head: exactamente estos cuatro archivos; sin cambios en ficha ni contratos ni dependencias. No hay threads de revisión ni comentarios técnicos previos visibles al cierre de la inspección.

Se contrastó el workflow con `src/lib/env.public.ts`, `src/server/env.ts`, `src/server/push/sender.ts`, `src/features/notifications/push/subscription.ts`, `src/features/trips/components/trip-route-map.tsx`, `src/ui/map.tsx` y los E2E afectados. `web-push` ya está en `dependencies` (versión 3.6.7); no se incorpora dependencia nueva. El Map ID condiciona los `AdvancedMarker`, que contienen los `data-testid`; sin él la app usa `Marker` clásico sin esos atributos. Las variables VAPID tienen nombres y destinos coherentes con el consumo del cliente y del servidor.

## H01 · MEJORA (medio) — validar Maps antes del build

**Archivo:** `.github/workflows/e2e-preview.yml:110-111`. **Estado:** abierto · **Detección:** inspección, sin fallo runtime inducido.

El build recibe `vars.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `vars.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`, pero no hay fail-fast si alguna vale cadena vacía. Ambas son opcionales en `src/lib/env.public.ts`; por eso `pnpm build` puede dar GREEN aun sin Maps y el fallo aparecer mucho después en los E2E. El test `T-422: Maps and push...` comprueba que existe la expresión del Environment, no que las variables estén pobladas ni que un step de validación corte el job.

**Arreglo acotado:** antes de `Build PR without privileged secrets`, añadir un step `Validate Maps public configuration`, con `env` de las dos expresiones `vars.*`, que ejecute `[ -n "$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY" ]` y `[ -n "$NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID" ]`; si faltan, emitir `::error::` específico y `exit 1`, sin imprimir valores. En `verify-workflows.test.mjs`, añadir una prueba que verifica secuencia + ambas guardas + salida no-cero y una mutación temporal que quite **cada** guarda por separado para obtener RED. No inventar resultados de esas pruebas: se ejecutan después de aplicar el arreglo.

**Por qué no bloquea hoy:** Lautaro073 confirmó que las variables ya están cargadas en el Environment `develop`; la guarda protege futuras roturas de configuración. No confirma que la clave esté autorizada desde localhost.

## H02 · MEJORA (bajo) — ficha desactualizada y decisión sin registrar en rama

**Archivo:** `docs/tasks/T-422.md`, sección «Diseño / Google Maps» (en `develop` afirma que el build usa clave falsa); correlato en `docs/runbooks/e2e-preview.md` y `docs/tasks/log/T-422.md`. **Estado:** abierto · **Detección:** lectura comparada.

La ficha canónica aún describe clave falsa e interceptación integral, incompatibles con el cambio de esta PR. El runbook ya describe clave real, pero no explica la decisión A→B ni deja claro que las variables fueron cargadas; la bitácora las presenta como tarea manual pendiente.

**Arreglo acotado:** actualizar únicamente la sección Google Maps del Diseño de la ficha con la estrategia autorizada: **A ahora** = `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` del Environment `develop` con los mismos valores del Preview; **B después** = clave exclusiva de CI **solo** si Google devuelve `RefererNotAllowedMapError` o si el consumo compartido resulta inconveniente. Explicar que los specs de Maps que usan mock siguen interceptando Google, pero otros validan integración real. Repetir este criterio en el runbook y anotar en la bitácora `2026-11-05` la decisión de Lautaro073 y que las variables **ya existen**. Sin cambios en specs, contratos, secretos o restricciones reales de Google Cloud.

## H03 · 🔵 D01 aceptada — estrategia y condición de cambio

**Severidad:** decisión · **Estado:** aceptado por Lautaro073 el 2026-11-05.

- **A (ahora):** reutilizar la clave y Map ID del Preview, ya configurados en Environment `develop`, para la **primera corrida real**.
- **B (contingencia):** clave exclusiva de CI si se reproduce `RefererNotAllowedMapError` en la corrida real o si el consumo compartido se vuelve problemático.
- **Sin autorización para activar B todavía.** No expandir por suposición restricciones de referer, cuotas ni permisos externos. El error de referer es un riesgo de configuración condicionado, **no un fallo verificado**.
- El agy registra D01; no debe improvisar otra estrategia ni cambiar el criterio. Cualquier ampliación funcional requiere autorización.

## Evidencia CI y límites

| Check | Resultado | Alcance |
|---|---|---|
| CI #41982718298, `head_sha=aa2357d` | `success`, 7/7 jobs | Compilación, typecheck, lint, unit, audit, bundle y DB; exacto SHA inspeccionado |
| `verify-workflows` dentro de job unit | `# tests 83; # pass 83` | Estructura y orquestación de workflows; no hace E2E de Maps real |
| `db-tests` | `Files=42, Tests=3396, Result: PASS` | Incluye mutaciones negativas esperadas antes de PASS final y chequeo de tipos |
| E2E anterior #41977303708 | `108 passed; 8 failed` | Confirma el problema previo, **no** la efectividad de #612 |
| Inspección + 7 mutaciones in-memory independientes | GREEN basal; 7/7 mutaciones detectadas | Comprobaciones estructurales sobre los bytes del YAML; **no** prueba runtime de Playwright |

**Nota de entorno:** no se ejecutó clon local ni un `git merge-tree` real. GitHub informó `mergeable: true` y la comparación con develop era de un commit. No se leyó ningún `.env`, clave ni secret, ni se activó Supabase/Docker/Vercel remoto.

**Formato del cuerpo de la PR:** antes de mergear, completar la sección «Informe de revisión de agy» del template con el informe final. El cuerpo actual del PR es prosa y el `approval-policy` exige literalmente el reporte completo dentro de esa sección; el comentario de esta ronda por sí solo no satisface el check.

## NO TOCAR — comprobaciones que no son defectos

- **VAPID privado en el output del step:** se enmascara antes; solo pasa a `Run preview E2E gate`, no al build ni a job env. Es un par descartable, no el secreto de proyecto.
- **Clave pública de Maps en bundle:** es `NEXT_PUBLIC_*` deliberadamente pública y el mapa de verdad necesita su valor en los specs no interceptados.
- **Map ID:** requisito de `AdvancedMarker`, no una segunda credencial secreta.
- **Sin E2E real previo al merge:** limitación de `workflow_run` de la rama por defecto; no reemplazarla con simulación verde inventada.
- **Advertencia Prettier en 331 archivos:** el check de formato es advisory; `pnpm lint` sí pasó. No mezclar esta deuda general con esta PR.

## Siguiente intervención acotada

Para el agy: `git pull` primero. Solo editar `.github/workflows/e2e-preview.yml`, `.github/workflows/verify-workflows.test.mjs`, `docs/tasks/T-422.md`, `docs/runbooks/e2e-preview.md` y `docs/tasks/log/T-422.md`; también actualizar el **cuerpo** del PR al finalizar. Prohibido tocar `docs/revision-pr/**`, specs o dependencias, fabricar pruebas verdes, relajar checks, cambiar secretos o rebase/amend/force-push. Dejar evidencia RED→GREEN real en bitácora, commit [T-422] y push. No hay decisiones pendientes de P1 en esta ronda.

## Estado de cierre

**SIN BLOQUEANTES** por revisión estática y CI del SHA revisado. Las mejoras H01/H02 se entregan con prompt de implementación preciso. El cierre de la *tarea* T-422 todavía requiere la primera ejecución E2E real GREEN y la intervención posterior en Vercel. La carpeta de revisión se commitea sin aprobar ni mergear la PR.
