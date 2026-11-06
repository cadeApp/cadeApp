# PR #617 — Ronda 2 (2026-11-05)

**SHA revisado:** `f4a5a1fca3b836e9ee39077e26a63a92f4da900b`. **Resultado:** SIN BLOQUEANTES FUNCIONALES; mejora H03 no bloqueante; CI y `e2e-preview` no verificados como GREEN. Sin aprobación ni merge.

## Comparación y procedencia

- HEAD de PR #617 confirmado por GitHub. El código de corrección entró en `47699d69` y `57061b40`; `f4a5a1fc` solo agrega la bitácora. Los cinco archivos de `docs/revision-pr/pr-617/` de ronda 1 permanecían intactos.
- Se volvió a leer la ficha **desde develop**; la decisión D01=B está autorizada por Lautaro073 y se conserva aunque la ficha base todavía exija la nota. No solicitar de nuevo la decisión.
- La PR toca archivos de la lista permitida. `develop` avanzó un commit a `7809c399` (T-423/CC-045/docs), por lo que la rama no incluye ese último commit. GitHub reporta `mergeable=true`; no se ejecutó `git merge-tree` (la máquina no pudo resolver github.com).

## H01 — corregido y verificado de forma acotada

En `audit-format.ts`, `admin_resolve_incident` ya no aparece en `ACTION_TONES` como positiva incondicional: integra `STATUS_DRIVEN_ACTIONS`. El mapa pone `resolved: positive`, `dismissed: neutral` y la rama sin estado vuelve a `neutral`.

**Batería independiente realmente ejecutada:** extracción del cuerpo literal de `auditActionTone` y de los mapas/set desde el SHA mediante conector GitHub y ejecución en V8; 6/6 casos correctos, incluyendo postulaciones y documentos. Controles negativos propios en memoria: sustituir `STATUS_TONES.resolved` por `neutral`, y eliminar la acción de `STATUS_DRIVEN_ACTIONS`; ambos destruyen el resultado positivo esperado. No es un Vitest completo.

**Autor declara:** RED inicial `expected 'positive' to be 'neutral'` (1 failed | 8 passed), GREEN; mutación propia del autor RED 1 failed | 29 passed desde baseline 30, restaurada GREEN 30. El revisor no ejecutó esa batería de Vitest; se distinguen explícitamente ambas evidencias.

## H02 — corregido y verificado de forma acotada

El componente calcula una única condición `emptyAfterCursor = filters.cursor !== undefined && result.items.length === 0`, la incluye en el guard de `nav` y monta `Volver al inicio` con `href={buildAuditHref(filters)}`. La función común mantiene los filtros y no agrega cursor/dir si no se pasan.

**Batería independiente realmente ejecutada:** expresión y cuerpo literales recuperados del SHA y ejecutados en V8; 3 casos de la guarda, 7 filtros preservados (`actor`, `action`, `entity`, `courier`, `target`, `from`, `to`), exclusión de `cursor` y `dir`. Dos controles negativos propios en memoria: quitar exigencia de cursor; reintroducir cursor en href. Se inspeccionó el JSX de navegación; no se montó React ni Playwright.

**Autor declara:** RED inicial 1 failed | 20 passed y GREEN; mutación original de guarda a false RED 1 failed | 29 passed y restauración GREEN 30. También informa 462 tests admin y typecheck/lint OK, pero sin ejecución del revisor.

## H03 — mejora menor NO BLOQUEANTE: estados de incidentes sin traducir

**Archivos:** `src/features/admin/copy.ts` (mapa `ADMIN_COPY.audit.values`) y `src/features/admin/audit-format.ts` (`formatAuditValue`). Detectado ahora, aunque **ya existía en R1**; la omisión en la primera ronda corresponde al revisor.

`formatAuditValue` devuelve la clave sin transformar si falta una entrada en el mapa. El map de A06 carece de `open`, `reviewing`, `resolved`, `dismissed`. Con el cuerpo real extraído y ejecutado en V8 se obtiene `dismissed` y `resolved` en inglés. En A05, `INCIDENTS_COPY.statuses` define `Abierto`, `En revisión`, `Resuelto`, `Cerrado sin sanción`.

**Matiz:** el texto de acción `Resolvió un incidente` **no se considera un defecto comprobado**: el mismo panel A05 llama al caso `no_action` «Resolver sin sanción». El punto confirmado es la localización del estado, no la validez del verbo.

**Arreglo opcional y acotado:** añadir en `ADMIN_COPY.audit.values` `open:'Abierto'`, `reviewing:'En revisión'`, `resolved:'Resuelto'`, `dismissed:'Cerrado sin sanción'`; testear con `describeAuditChange` el paso `open→dismissed` y `open→resolved`, más una mutación temporal de traducción incorrecta que cause RED. No tocar la RPC ni el nombre de la acción. No hace falta nueva ronda por H03 antes del merge si se decide diferir esta mejora.

## Gates y límites

- El contenedor local no puede hacer `git ls-remote` por fallo de DNS. Los comportamientos H01/H02 se probaron mediante extracción de funciones reales en Code Mode, no en checkout Next/React. Los informes RED de Vitest del autor no se falsificaron ni se dieron por reproducidos.
- GitHub mostraba `CI` en progreso para `f4a5a1fca3b836e9ee39077e26a63a92f4da900b`. El contexto Vercel success se refería a un deploy ignorado, **no** al E2E. No se dispone de `e2e-preview` GREEN confirmado para este SHA. No se levantó Supabase ni Docker.
- No existe motivo para exigir un nuevo CI GREEN solo porque esta ronda agregue documentación. Antes del merge, corroborar el gate para el último SHA con cambios de aplicación y que ningún cambio posterior invalide esos checks.

**Cierre:** H01/H02 superaron la verificación independiente acotada; H03 es no bloqueante; permanece pendiente el gate oficial. No se aprueba ni mergea. El nuevo commit de revisión mueve HEAD: hacer `git pull` antes de trabajar.
