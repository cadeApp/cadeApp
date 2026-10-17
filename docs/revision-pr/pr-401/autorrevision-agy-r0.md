> ARCHIVO DEL AUTOR, NO ES REVISIÓN INDEPENDIENTE. Original de `docs/revision-pr/pr-401/README.md` en SHA `ef990947474cd404c0adda429f852589c5c55732`. Se conserva para contraste; nada de esto certifica los hallazgos del revisor.

# Revisión PR #401 — T-370 / CC-030

```
Informe revisar-pr — T-370 — 2026-10-17 — generado por Lautaro073 (Claude Code, auto-revisión antes de pedir revisión)
Resultado: SIN BLOQUEANTES (pendiente de CI db-tests)
Checks locales: typecheck ✅ · lint ✅ · test ✅ (140 archivos, 2595 tests; node --test 79 + 6) · test:db n.a. local (corre en CI)
BLOQUEANTES:
- ninguno detectado en local.
MEJORAS:
- [supabase/migrations/20261017150000_cc030_courier_docs_orphan_reconciliation.sql] la tabla de reclamos crece sin
  retención propia; es chica (una fila por huérfano) y conservarla es lo que impide re-adoptar una ruta. Si se quiere
  podar, otro CC.
- [supabase/tests/integration/cc030_orphan_concurrency.mjs] corregido en 9ab53ac0: el bloqueo se afirmaba con una
  espera fija de 1 s; ahora se observa en pg_locks (advisory no concedido).
No revisado / dudas para Lautaro073:
- La ficha T-370 no existe en origin/develop: se creó en esta PR por tu decisión (2026-10-17). La revisión de alcance
  se hizo contra la ficha de la rama.
- `.github/workflows/ci.yml` (regla §6) sólo suma el bloque CC-030 en db-tests; necesita tu aprobación explícita.
- `src/types/database.types.ts` se escribió a mano con el formato del generador; lo valida `db:types --local` + diff en CI.
- pgTAP (46 casos), integración y mutaciones SQL no se ejecutaron en local (sin Docker local): evidencia en el run de
  db-tests de la PR.
- Confirmar gracia de 7 días y default `dry-run`.
```

## Alcance verificado
`git diff origin/develop...HEAD --stat` contra «Archivos permitidos» de `docs/tasks/T-370.md`: todos los archivos están
cubiertos. Sin cambios en `src/domain/**`, `src/ui/**`, RLS de tablas existentes ni dependencias.

## Seguridad verificada
- Tabla interna en `app_private` con `revoke all` a `public, anon, authenticated`.
- RPC y helpers `security definer` con `search_path = public, pg_temp`; RPC con chequeo `auth.role() = 'service_role'`
  y `execute` sólo para `service_role`.
- Auditoría y logs sin rutas ni ids; la service role sigue sólo en `src/server/supabase/admin.ts`.
