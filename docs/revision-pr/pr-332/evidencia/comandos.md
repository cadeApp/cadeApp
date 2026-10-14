# Evidencia y verificación de ronda 1 — PR332

Github MCP: get_pr_info, fetch_pr_patch, fetch_file, fetch_issue_comments, REST check-runs para SHA `80e0edbf637a662d7b03a33dab8c6fc3bda23dd6`.
Origen: CC-024 líneas 1-253, docs/tasks/T-340.md de develop, CC-022, AGENTS.md, .agents/skills/contract-change/SKILL.md, docs/contracts/_plantilla.md.
Migración existente supabase/migrations/20261009200000_t340_multi_drop.sql:38-48 permite NULL en campos legacy; limpia/valida con app_private.request_cycle en 20261013140000_t340_clean_legacy.sql.
Sin archivos SQL ni función create_and_publish_multi_drop en PR332; no se pueden atribuir tests SQL de la función a los jobs verdes.

COMANDOS PROPUESTOS AL AUTOR (no ejecutados por revisor):
git fetch origin
git switch cc/CC-024-atomic-multi-drop-publish
git pull --ff-only origin cc/CC-024-atomic-multi-drop-publish
git diff --check
git diff --name-only origin/develop...HEAD
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin cc/CC-024-atomic-multi-drop-publish

Pruebas futuras (NO ejecutadas): cero duplicación en parent/contact legacy; retry mismo UUID mismo payload; retry cambiado rechazado; retry posterior al match/entrega devuelve estado actual sin nueva publicación; rollback por fase, concurrencia, RLS y cliente legacy.
