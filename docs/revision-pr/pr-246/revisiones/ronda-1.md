# Ronda 1 — PR #246 / T-335

**SHA revisado:** `7f6cf8b81b8e9fa7e35a82de47d5456fa40556a5`  
**Resultado:** **CON BLOQUEANTES (1)**

## Implementación

La migración y el DB test cumplen el objetivo técnico principal:
- RED real antes de la migración;
- GREEN real después;
- membresía de `offers` y `delivery_requests` verificada en `pg_publication_tables`;
- sin cambios de RLS;
- sin cambios a T-307;
- sin `REPLICA IDENTITY FULL`;
- alcance correcto.

CI exact-head `37175300008`: typecheck, lint, unit, build, audit, bundle-budget y db-tests GREEN.

## BLOQUEANTE

### PR246-H01 — DoD post-merge eliminado / cierre prematuro

#244 exige que después del merge y `migrate-develop`, PR #180 ejecute los tres tests de notifications y obtenga 3/3 GREEN.

La ficha de la rama eliminó ese ítem y el PR usa `Closes #244`.

Corrección:
1. restaurar el DoD en `docs/tasks/T-335.md` como `[ ]`;
2. cambiar `Closes #244` → `Refs #244`;
3. reflejarlo en el body y bitácora;
4. no declarar T-335 completa antes de la validación post-merge;
5. después del merge, esperar `migrate-develop`, sincronizar #180 y exigir 3/3 GREEN;
6. recién entonces cerrar #244.

## MEJORA

### PR246-H02 — explicación incorrecta de REPLICA IDENTITY

El body dice que los consumidores solo usan INSERT. En realidad varios canales usan `event='*'`.

No cambiar el SQL por esto. Corregir la prosa: `DEFAULT` alcanza porque la aplicación usa UPDATE/DELETE/INSERT como **señales de invalidación** y no depende de un `OLD` completo.

## No revisado / residual

El efecto remoto sobre T-307 solo es verificable después del merge porque Supabase Develop se migra desde `develop`. Esa validación permanece obligatoria y no se infiere del DB test local/CI.
