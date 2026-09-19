# Kit de reglas de agy para cadeApp

Archivos listos para copiar a la raíz del repositorio en la tarea **T-001**. Están en `docs/agy-kit/` porque
`create-next-app` no acepta una carpeta con `AGENTS.md` o `.agents/` antes del scaffold (T-000).

| Archivo en el kit | Destino en el repo |
|---|---|
| `AGENTS.md` | `/AGENTS.md` |
| `.agents/rules/*.md` | `/.agents/rules/` |
| `.agents/skills/*/SKILL.md` | `/.agents/skills/` |
| `.agents/hooks.json`, `.agents/scripts/agent-guard.mjs` | `/.agents/` |
| `supabase/AGENTS.md`, `src/domain/AGENTS.md`, `e2e/AGENTS.md` | mismas rutas |
| `.github/CODEOWNERS`, `.github/pull_request_template.md` | `/.github/` |
| `docs/tasks/_plantilla.md`, `docs/tasks/log/_plantilla.md`, `docs/contracts/_plantilla.md`, `docs/onboarding.md` | mismas rutas |

Después de copiar:
1. Reemplazar `@persona2` y `@persona3` en `CODEOWNERS` por los usuarios reales (Lautaro073 ya figura).
2. Probar el guard con agy: leer `.env.local`, `pnpm supabase db push` y `git push origin develop` deben quedar bloqueados;
   `pnpm test` debe seguir pidiendo permiso normal.
3. Borrar `docs/agy-kit/` en el mismo PR.

Origen de las rutas: documentación integrada de agy 1.2.4 (`agy-customizations`): reglas en `AGENTS.md` por carpeta
y `.agents/rules/*.md`; skills en `.agents/skills/<nombre>/SKILL.md`; hooks en `.agents/hooks.json`
(se ejecutan con `cmd /c` en Windows desde la carpeta de `hooks.json`; `PreToolUse` admite `deny`, `ask`, `force_ask`).
