# Revisión independiente — PR #470 / T-387 — ronda 3

**Fecha Argentina:** 2026-10-20 · **Revisor:** ChatGPT (independiente del autor) · **Autor del arreglo:** Lautaro073.
**SHA inspeccionado:** `5f4187c8b8267b93e289b4cd732e8ad67d947c92`.
**HEAD de la rama antes de registrar la ronda:** `7eab0a5b4713ef39cb72f1e98a8d5eb3e661ce2b` (commit de revisión, sin alterar la ficha).
**Base:** `c702271f5291aeca62d87d18b4d7f582132765c2`.
**Resultado: SIN BLOQUEANTES · 5/5 hallazgos corregidos y comprobados para el alcance documental · 0 mejoras nuevas obligatorias.**

## Ronda 3: PR470-H05 — arreglado-verificado

**Archivo:** `docs/tasks/T-387.md:102-110`.

La ronda 2 había detectado que la ficha enumeraba tres flujos de carga PDF pero su E2E solo recorría de verdad el perfil; en el registro inicial exigía únicamente `accept` y no se probaba el reemplazo de una licencia rechazada. El commit del autor `5f4187c8` añade exactamente estos criterios sin modificar otros archivos:

1. **Registro inicial en `VehicleForm`**: selector de licencia/seguro ofrece PDF, pero además la licencia **se sube como PDF real a Storage, sin compresión**, se envía con nombre `license_<ts>.pdf` y queda **documento vigente en revisión**.
2. **Reemplazo de licencia rechazada por UI**: un repartidor con licencia rechazada elige un PDF, lo sube a Storage **sin compresión**; nuevo documento `.pdf` **vigente y en revisión**, anterior rechazado deja de ser el vigente.
3. Se conserva E2E de **alta desde perfil** por repartidor aprobado sin seguro, y el recorrido admin **MFA → visor embebido → `audit_log` → validación → insignia**.

Los dos casos nuevos ejercen la operación real y el efecto persistido en Storage/DB; no se reducen a una propiedad del input. En la implementación deberán usar Preview y comprobar esos efectos con sus pruebas reales y RED→GREEN, no mocks que salten Storage/RPC.

### Oráculo independiente y mutaciones

Con los ficheros reales recuperados del SHA inspeccionado se ejecutó JavaScript de comprobación de los tres escenarios y la persistencia. **H05 inicial = GREEN; H05 reemplazo = GREEN; H05 perfil = GREEN; MFA/auditoría = GREEN.** Además los controles H01–H04 (DoD=plan, 18 permisos literales, `vehicle-form.tsx` autorizado y 10 MiB exactos) siguen GREEN. La sección de decisiones D01=C y D02=C permanece.

Se ejecutaron seis **mutaciones propias en memoria** sobre las viñetas E2E, y las seis cambiaron el resultado a **RED**: quitar carga real inicial, quitar «sin compresión» inicial, quitar estado vigente inicial, quitar carga real en reemplazo, quitar la invalidación del anterior y quitar «desde la UI». El código íntegro y las salidas/resumen están en `evidencia/comandos.md`; las mutaciones no tocaron ni commitearon la ficha.

**Alcance de este GREEN:** se comprobó la especificación documental y la sensibilidad del oráculo. **NO** se ejecutaron Playwright/E2E de PDFs futuros, porque T-387 todavía es una ficha sin implementación; tampoco se ejecutaron comandos pnpm locales ni git merge-tree, por falta de checkout local. No se presentan mutaciones de tests de aplicación inexistentes.

## Integridad del cambio y decisiones

- La comparación de `f638abb4` con el commit `5f4187c8` muestra únicamente 4 líneas añadidas y una eliminada en `docs/tasks/T-387.md` (sin cambios en la fila del plan ni código de producción); el resto de la diferencia entre esos SHA incluye el commit de **ronda 1** de la revisión.
- Las versiones de las rondas 1 y 2 no se editan. H01–H04 permanecen cerrados con `verificado_en_sha=f638abb4`; H05 queda cerrado con `verificado_en_sha=5f4187c8`.
- Decisión 1=C: registro, perfil y reemplazo PDF con preparación compartida. Decisión 2=C: DNI/selfie/avatar siguen foto en UI, pero el visor admin muestra cualquier PDF admitido por backend. No se altera contrato, RPC, RLS, migración ni dependencias.
- `tools/verify-fichas.test.ts` valida igualdad exacta del primer DoD y la sexta celda del plan; la verificación JS la reprodujo con resultado true.

## Estado de CI y condiciones de merge

**CI del HEAD anterior a esta publicación `7eab0a5b`:** `unit`, `typecheck`, `lint`, `build`, `audit`, `db-tests`, `bundle-budget` completed/success. En el log de `unit` constan **154 archivos y 3110 pruebas Vitest PASS**; en `db-tests` el cierre final dice **34 archivos, 3019 pruebas PASS**. Se observaron mensajes RED en el log de `db-tests` porque el propio job ejecuta mutaciones intencionales y luego restaura GREEN; su **resultado final es PASS**. `bundle-budget` devuelve success pero **warning** por rutas de >180 kB: existente y ajeno a esta PR documental.

`approval-policy` estaba en failure: el log dice literalmente «Falta el informe completo de revisar-pr sin bloqueantes». Se inspeccionó el script oficial `.github/workflows/approval-policy.mjs:23-37`: requiere informe con secciones completas **en el body del PR bajo `### Informe de revisión de agy`**, no meramente en un comentario. El cierre de esta ronda debe publicar también dicho apartado en el body, sin afirmar que el check ya pasó; observar el próximo resultado del workflow.

La PR #470 queda **SIN BLOQUEANTES de especificación** a efectos de revisión independiente; la preparación del merge debe conservar protección de rama y verificar el control `approval-policy` con el informe publicado en el body. El documento de la PR no implementa todavía PDF; la futura PR de T-387 deberá ejecutar sus E2E completos.

**No se aprobó ni mergeó.** Solo la revisión escribe `docs/revision-pr/pr-470/**`.
