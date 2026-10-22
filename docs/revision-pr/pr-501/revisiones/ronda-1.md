# Ronda 1 — T-391 / PR #501

**Fecha:** 2026-10-21 (Argentina)  
**Resultado: CON BLOQUEANTES (1, evidencia pendiente)**  
**SHA de código revisado:** `bbc4b4f1423efc3b14795d261d2f018bbce5d59f`. Base: `develop`. No aprobar ni mergear.

## Método

Leídas las instrucciones de `docs/revision-pr/COMO-ENTREGAR.md`, `README.md` y `.agents/skills/revisar-pr/SKILL.md`; ficha T-391 **desde develop**, diff, comentarios y bitácora. Contrastado además con `AGENTS.md`, `src/ui/map.tsx`, `src/features/requests/components/create-request-form.tsx`, `e2e/fixtures/roles.ts`, Page Objects, `src/middleware.ts`, service worker y configuración Vercel.

Todos los archivos del diff están permitidos por la ficha; no se tocan contratos, DB, secrets ni dependencias.

## Mejoras verificadas por inspección de código (sin ejecución independiente)

- `next.config.ts` configura `poweredByHeader: false` y `headers()` para `/(.*)`.
- CSP enforced limitada a directivas seguras y CSP completa Report-Only; Permissions-Policy y HSTS coinciden con el DoD.
- El problema de redirects anterior a `7f21cf6` fue atendido: `request.get(route, { maxRedirects: 0 })`, aserciones de todas las cabeceras y cobertura de admin autenticado con MFA siguiendo patrón existente.
- `supabaseOrigins` restringe esquemas a HTTPS y HTTP de desarrollo, con unitarios negativos.
- **D01=A:** en el HEAD actual el E2E llama `getByRole('button', { name: /fijar en mapa interactivo/i }).first().click()` para abrir el mapa, comprueba respuesta real exitosa de `maps.googleapis.com`, `map-container` y región `Map`. Registra mensajes CSP enforced y adjunta los Report-Only. No se observó sustitución por mock de Google Maps en el control GREEN.

En la revisión se produjeron varios commits concurrentes del autor (`d1636bd`, `7f21cf6`, `bbc4b4`). El hallazgo original del mapa oculto dejó de aplicar al SHA `bbc4b4f1423efc3b14795d261d2f018bbce5d59f`. No se traslada como bloqueante de código ya corregido.

## PR501-H01 · BLOQUEANTE de evidencia · P15 · Medio

**Archivo:** `docs/tasks/log/T-391.md`.

La bitácora sigue atribuyendo `security-headers.spec.ts` «6 passed» y violaciones CSP en `/login` al E2E original, sin registrar **la ejecución y mutación nueva** del E2E que ahora intenta cargar Google Maps de verdad. El DoD exige evidencia de las violaciones reales del Preview y la comprobación independiente de controles críticos. No corresponde dar por probado el flujo de Maps solo porque el test está bien dirigido por inspección.

**Corrección:** correr el nuevo spec contra el Preview correcto (sin retries para establecer baseline), inspeccionar de verdad que hay peticiones de Maps, registrar las violaciones Report-Only de **ese flujo**, y demostrar RED cuando se aborte el JS de Maps en el contexto de Playwright, seguido de GREEN sin interceptación. Actualizar la bitácora con el SHA, comandos exactos y líneas de resumen (sin secretos ni información sensible). No modificar ni relajar assertions para obtener verde. Si falla con Maps real, reparar la causa en `e2e/specs/security-headers.spec.ts` dentro del alcance; no saltar el test.

**Estado:** abierto, solo inspección. No hay salida RED→GREEN independiente ni `verificado_en_sha`.

## Pruebas

- **No ejecutadas en esta revisión:** pnpm/Vitest/Playwright, Docker y mutaciones. El contenedor no puede resolver `github.com` para clonar y carece del checkout. Sin afirmaciones de verde independientes.
- CI del HEAD consultado durante su ejecución, aún sin resultado final confirmado. No usar el éxito de commits anteriores como si fuera del actual; revisar CI y E2E del SHA de código efectivamente revisado.
- En `evidencia/comandos.md` hay harness reproducible de inspección y batería negativa propuesta. Los resultados esperados no se presentan como ejecutados.
- El cuerpo y la bitácora actuales son evidencia declarada por el autor, **no equivalen a verificación del revisor**.

## Decisiones y cierre

**D01=A**, confirmada por Lautaro073. No se requiere nueva decisión. El agy tiene un prompt acotado en **el mismo comentario de PR** que esta ronda. Debe hacer `git pull` antes de comenzar; sin rebase/amend/force push. Carpeta `docs/revision-pr/pr-501/**` exclusiva del revisor. No exigir CI nuevo **solo** por documentación, aunque debe existir evidencia del código nuevo. Sin aprobación ni merge.
