# Informe de revisión — PR #370 / T-366 (ronda 1)

**Fecha:** 2026-10-15  
**HEAD revisado:** `7fbf3cedf40e09dd6a5f9046ef8cf6373651622b`  
**Base:** `develop` @ `e1c3074b575ea7db17b661abac687f1c6e292c63`  
**Resultado:** **BLOQUEADA POR CC-026**. Cero defectos imputables al diff documental; sin cambios funcionales, NO apta para merge.

## Lecturas y alcance

Se leyeron desde `develop`: `AGENTS.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `docs/tasks/T-366.md`, `.agents/rules/30-supabase.md`, skill `contract-change` y fuentes pertinentes del ciclo SQL/cron/queries; se contrastaron lecciones anteriores y el diff/bitácora/comentarios de la PR.

- La PR añade únicamente `docs/tasks/log/T-366.md` (21 líneas). Está en «Archivos permitidos» y registra correctamente la detención prevista por la ficha. No hay archivos de código cambiados.
- Comparación de GitHub: rama 2 commits adelante, 0 detrás de `develop`, y PR metadata mergeable. No se ejecutó localmente `git merge-tree` por no disponer de clon con acceso de red. Estado mergeable no significa que cumpla DoD.
- Antes de crear esta carpeta no existía `pr-370` en la rama.
- El autor declaró 142 tests de requests/sweep y 7 de verify-fichas como baseline, pero esta revisión NO ejecutó esas suites ni verificó sus logs; son declaraciones del autor, no prueba independiente.

## Diagnóstico por inspección (no es un hallazgo contra el autor)

1. `src/features/requests/queries.ts` filtra el historial por `['delivered','cancelled','expired']` y activas por `['published','matched','in_transit']`. Una solicitud `published` temporalmente vencida no se vuelve terminal sin mutación.
2. `src/server/cron/sweep.ts` separa `delivery_requests.update`, `audit_log.insert` y `offers.update` en llamadas independientes. Reutilizarla directamente desde lectura no garantiza atomicidad entre las tres; tampoco tiene alcance autenticado por comercio.
3. `accept_offer`, `submit_offer` y `take_request` contienen guardas SQL de vencimiento. No afirmar que aceptan ofertas fuera de plazo sin caso reproducido; el problema de esta tarea es materializar y proyectar coherentemente el estado.
4. `vercel.json` agenda el sweep con `0 6 * * *`; no es una fuente de frescura inmediata.
5. La ficha establece abrir contract-change si no hay reconciliación transaccional adecuada. El autor respetó esa detención.

## Decisión resuelta y gate

**D01: opción C**, seleccionada expresamente por @Lautaro073 el 2026-10-15. Crear **CC-026** ([issue #371](https://github.com/cadeApp/cadeApp/issues/371)), asignado a Lautaro073, para construir núcleo SQL transaccional compartido + API RPC con permisos mínimos, refactor de etapa expiraciones del cron y pruebas de carrera/auditoría. No modificar código funcional de T-366 hasta que CC-026 esté aprobado, mergeado, con ficha T-366 reconciliada en `develop` y despliegue requerido disponible en Develop.

T-366 (#355) y PR #370 permanecen **asignadas a @KiraK72**, issue bloqueada y PR Draft. Luego Kira implementa consultas/UI/tests/E2E, sin tomar el rol de autora de CC-026.

## Pruebas y verificaciones

| Control | Resultado real de esta revisión |
|---|---|
| Lectura del diff, ficha desde develop, comentarios y bitácora | ✅ Inspección |
| Alcance vs «Archivos permitidos» | ✅ 1 archivo autorizado |
| Comparación base/HEAD remoto | ✅ GitHub: 0 commits detrás |
| `git merge-tree` local | No ejecutado (sin clon de red) |
| `pnpm typecheck`, `pnpm lint`, `pnpm test` | No ejecutados por esta revisión |
| `pnpm test:db`, pgTAP | No ejecutados; no hay SQL nuevo en PR |
| RED→GREEN, batería de mutaciones propia | No aplica: 0 arreglos funcionales en el diff |
| E2E Preview | No verificado; la PR sigue en Draft |

**CI:** no se certifican jobs al estar la ronda bloqueada; el color de checks preexistentes no demuestra DoD ni compatibilidad del CC futuro.

## NO TOCAR / falsas soluciones

- No resolver con `Date.now()` del navegador como fuente de verdad, ni filtrar `published` vencidas después del `LIMIT`.
- No llamar el sweep completo desde una consulta: incluiría purga de documentos, suscripciones y privilegios administrativos sin relación.
- No reutilizar una secuencia de tres REST writes desde server-side llamándola «transacción».
- No afirmar RED/GREEN ni auditoría sin evidencia reproducible; no falsificar mocks ni expectativas.
- No tocar `docs/revision-pr/pr-370/**` desde el agy implementador; la revisión es independiente.

## Seguimiento

La siguiente ronda se abrirá con el nuevo HEAD publicado de PR #370 **tras CC-026**, verificará cambios SQL ya mergeados, su uso real en consultas, páginas activas/historial, cursor >50, seguridad, condiciones de carrera, evidencia RED→GREEN, pgTAP y E2E Preview. Se agregará `ronda-2.md` sin editar esta ronda. El prompt técnico acotado va en el comentario de la PR.
