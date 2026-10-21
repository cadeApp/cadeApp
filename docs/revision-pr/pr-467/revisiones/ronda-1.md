# Informe de revisión independiente — PR #467 / SEC-466 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/467
**SHA revisado:** `567a4858539c99a485a0c53f790cf1a557455f91`
**Base `develop`:** `127a900bf489dabf319a4f02046c959689487774`
**Fecha local:** 2026-10-20
**Resultado del diff:** SIN BLOQUEANTES DE CÓDIGO.
**Resultado de integración:** NO APTO PARA MERGE mientras falten o fallen checks obligatorios.

## Fuente de alcance

Issue [SEC-466 / #466](https://github.com/cadeApp/cadeApp/issues/466). Es un hotfix de dependencias como la PR #312; no afirmar que existe una ficha `docs/tasks/T-466.md` ni una bitácora de esa tarea. Se contrastó con el issue y el texto de la PR.

## Cambio examinado

- `package.json`: `pnpm.overrides.vite` de `6.4.3` a `6.4.4`; audit ignore `GHSA-vfj7-8cjw-p6xm` **sin cambios**.
- `pnpm-lock.yaml`: override, nodo `packages.vite@6.4.4` con integrity `sha512-xGjU/SyjeNyb0E4KxXBvYz/1C+3JXuujvf2hXNOtnlcE+58o5ajd9N2/n2VhkiJvpCP2qQasnUpx5PXNeI+p1Q==` y referencias de pares `vitest`/`@vitest/mocker`. Sin resolución residual de `vite@6.4.3`.
- El diff completo consta únicamente de esos dos archivos (+14/-14); sin cambios de tests, app, workflows o lista de GHSA ignoradas.
- GitHub compare: rama 1 commit por delante, 0 por detrás de `develop`; `mergeable=true` en la consulta. Esto no sustituye `git merge-tree`, no ejecutado en clon local.

El aviso GHSA-587h-7wmj-h5pm confirma que Vite `<=6.4.3` está afectado y `6.4.4` está parcheado: https://github.com/advisories/GHSA-587h-7wmj-h5pm.

## Evidencia RED → GREEN

| Verificación | Base / RED | HEAD `567a485` / GREEN |
|---|---|---|
| `pnpm audit --audit-level=high` en GitHub CI | Run 39503957919: exit 1, GHSA-587h, `5 moderate / 2 high (1 ignored)` | Run 39520368768: exit 0, `3 moderate / 1 high (1 ignored)`, sin el GHSA corregido |
| Instalación congelada | No se comparó localmente | `pnpm install --frozen-lockfile` completado correctamente en jobs CI |
| Unit | — | 154/154 archivos y 3078/3078 tests; workflow y ADR tests exitosos |
| Typecheck / lint | — | Pass |
| Invariantes de lockfile (revisión independiente) | Cinco mutantes puntuales fallaron en el control en memoria | Control original pass leyendo contenido real del SHA por conector GitHub |

**Límite de evidencia:** las cinco mutaciones fueron inspección estática en memoria, no una ejecución alternativa de `pnpm audit`. El rojo y verde de audit son logs reales, en SHAs diferentes. No se modificaron ni adulteraron tests ni archivos.

## Bloqueos de integración ajenos al diff

**G1 — `build` fallido.** En el job 118962472887, `src/app/layout.tsx` utiliza `next/font/google`. El loader de Next 15.5.26 falló con `TypeError: Cannot read properties of null (reading '1')` durante la obtención/parseo de fuentes (Montserrat). `src/app/layout.tsx` y Next no son parte del diff. No hay prueba de que Vite lo haya causado; tampoco se puede declarar transitorio sin un segundo build exitoso. La salida no corresponde a un error de compilación de código modificado. No cambiar fuentes ni workflows dentro de SEC-466 solo para poner verde el CI. La nueva ejecución automática de CI tras este commit documental dará otra observación; si vuelve a fallar, investigar separadamente y revalidar antes del merge.

**G2 — `bundle-budget` skipped.** Depende de `build`; no debe interpretarse como aprobado.

**G3 — `e2e-preview` no acreditado.** El status `e2e-preview` no figuraba entre statuses del commit; el workflow escucha eventos de deploy de Vercel y publica el resultado como commit status. La existencia del deployment de Vercel **no equivale** a una ejecución de E2E.

**G4 — `approval-policy` fail.** Job 118962474133: «Falta el informe completo de revisar-pr sin bloqueantes». Se agregará informe al cuerpo de la PR, sin tocar ni debilitar el validador. El formato de policy exige `T-\d{3}`, por lo que el alias `T-466` puede usarse solo como etiqueta de formato, explicitando que la tarea real es SEC-466 y que no se afirma una ficha existente.

**G5 — `db-tests` in_progress** a la consulta; aún no hay cifras para atribuirle.

## NO TOCAR — falsos positivos descartados

- El `high (1 ignored)` residual ya estaba en `auditConfig.ignoreGhsas` antes del parche; SEC-466 no amplió la lista.
- Cambiar las referencias de pares de Vitest en el lockfile es consistente con cambiar la versión resuelta; no equivale a actualizar Vitest.
- No atribuir a Vite el fallo `next/font` sin reproducción diferencial.
- No ampliar el hotfix a `src/app/layout.tsx`, `.github/**` ni otras dependencias sin un issue separado y evidencia causal.

## Checklist de salida

- [x] Diff y alcance verificados sobre SHA publicado.
- [x] Advisory contrastado con versión parcheada.
- [x] RED de `develop` y GREEN del `audit` de PR contrastados con logs CI.
- [x] Cinco mutaciones en memoria RED, control estático GREEN.
- [x] Frozen install, unit, lint y typecheck CI GREEN en `567a485`.
- [ ] Build GREEN en nuevo HEAD.
- [ ] Bundle-budget ejecutado en nuevo HEAD.
- [ ] DB tests terminado y log inspeccionado (Files/Tests/Result, tipos).
- [ ] `e2e-preview` GREEN del SHA de la PR.
- [ ] `approval-policy` GREEN con informe verdadero en body.
- [ ] Todos los checks pertenecen al HEAD final antes del merge.

## Limitaciones de la revisión

No hubo clon local accesible (DNS para github.com indisponible), no se ejecutaron `pnpm`, `git merge-tree` ni `node docs/revision-pr/analizar.mjs verificacion` localmente, ni se iniciaron Docker/Supabase. Se leyeron archivos y logs mediante GitHub conectado. No se presenta una ejecución inexistente como verificada. Reproducibilidad y comandos completos: [evidencia/comandos.md](../evidencia/comandos.md).

