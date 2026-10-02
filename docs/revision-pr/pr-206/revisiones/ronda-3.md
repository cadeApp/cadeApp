# Ronda 3 — PR #206 / T-327

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `9c2e379abdec83180c770ae5307f02e0d471cec4`  
**Resultado:** **SIN BLOQUEANTES PRE-MERGE**

## Sincronización

- develop: `163d4ade24c192e79e713b46ca9de4ec0aa02b7d`
- branch: `9c2e379abdec83180c770ae5307f02e0d471cec4`
- ahead: 5
- behind: 0
- merge-base: develop actual

## Revalidación

### PR206-H04 — ARREGLADO / VERIFICADO

P1 aportó evidencia visual en la sesión de que GitHub Environment `develop` quedó:

- `Selected branches and tags`
- una única regla: `develop`
- 1 branch allowed

Esto cierra el riesgo detectado en R1 de que cualquier rama interna pudiera solicitar directamente un Environment con service role y DB password.

### PR206-H05 — ACEPTADO, SIN BLOQUEO PRE-MERGE

P1 aportó evidencia visual de que:

- existe `SUPABASE_DEVELOP_PROJECT_REF` como Environment variable de `develop`;
- los secrets de Supabase configurados en ese Environment corresponden al proyecto Supabase Develop.

`SUPABASE_ACCESS_TOKEN` se reutiliza desde la configuración existente del repositorio. P1 decidió **no inspeccionar ni reemplazar su valor** y validar su acceso efectivo al nuevo proyecto mediante el primer `migrate-develop`.

La revisión acepta este punto como **residual post-merge**, no como bloqueante pre-merge, porque:
- el agente no debe leer ni probar manualmente credenciales remotas;
- `migrate-develop` corre inmediatamente al merge;
- el workflow falla cerrado: si el token no alcanza, `supabase link` falla antes de `db push`;
- #205 permanece abierta y T-327 no se considera terminada con el merge.

**Gate post-merge obligatorio:** `migrate-develop` debe quedar GREEN. Si falla por permisos, el residual vuelve a bloqueo operativo y #205 sigue abierta.

### PR206-M01 — ARREGLADO / VERIFICADO

El commit `9c2e379` separa correctamente:

- **antes del merge:** H04 + H05;
- **antes del primer `e2e-preview` GREEN:** Vercel Authentication desactivada en Preview.

El runbook y la ficha ya no se contradicen. Vercel Authentication ya está cumplida; la Ronda 2 comprobó `/api/health = 200`.

## Diff de la última corrección

Entre el commit de revisión R2 `5124a795...` y el SHA funcional actual solo cambiaron:

- `docs/runbooks/e2e-preview.md`
- `docs/tasks/T-327.md`
- `docs/tasks/log/T-327.md`

No hubo cambios técnicos en `.github/**`, specs, seed, RLS, migraciones ni producto.

## CI exact-head

Run **36979219018 / CI #870** — GREEN:

```
Vitest:          110/110 archivos · 1627/1627 tests
Workflow tests:  47/47
ADR:             6/6
DB:              13 archivos · 1621 tests · PASS
```

Jobs GREEN:
- unit
- db-tests
- typecheck
- lint
- build
- bundle-budget
- audit

## approval-policy

Antes de esta ronda estaba RED porque el body declaraba `PENDIENTE DE REVISIÓN INDEPENDIENTE`. Con esta Ronda 3 ya no quedan bloqueantes pre-merge; el informe de PR puede pasar a `SIN BLOQUEANTES`.

## Riesgos/residuales que NO cierran con el merge

1. **Primer `migrate-develop`:** confirma realmente el acceso del `SUPABASE_ACCESS_TOKEN` y aplica/drift-check a Supabase Develop.
2. **Primer `repository_dispatch` real de Vercel:** todavía no se observó en este repo con el workflow ya en default branch.
3. **Cierre 3-A:** #205 solo se cierra después de una corrida real `e2e-preview` GREEN sobre una PR posterior.
4. **#200 / Flow 4:** mientras #200 siga abierto, `main-flow` puede seguir rojo por la proyección documental. Eso no invalida la infraestructura T-327 ni permite debilitar el test.
5. **Artifacts Playwright en repo público:** se mantiene el comportamiento existente de CI; no se detectó secreto de infraestructura expuesto en browser y el service role solo se inyecta al step de Playwright.

## Resultado

**SIN BLOQUEANTES PRE-MERGE.**

La PR #206 puede mergearse a `develop` cuando P1 lo decida. El merge **no cierra #205** ni T-327: después se verifica `migrate-develop` y luego una corrida real `e2e-preview` GREEN.
