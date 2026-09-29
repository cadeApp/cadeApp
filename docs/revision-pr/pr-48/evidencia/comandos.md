# Comandos reproducibles — PR #48

Todo contra `fb7398a`, árbol limpio.

## H01 y H02 · Huecos del guard

El guard se ejerce con **su** formato de payload (`toolCall.args.CommandLine`), no con el de otro agente:

```bash
g() {
  echo "{\"toolCall\":{\"name\":\"run_command\",\"args\":{\"CommandLine\":\"$1\"}}}" \
    | node .agents/scripts/agent-guard.mjs
  echo "   <- $1"
}
g "cat .env.local"      # deny  ✅
g "cat .env"            # deny  ✅
g "cat .env*"           # ask   ❌ H01
g "cat .env.*"          # ask   ❌ H01
g "cp .env* /tmp/x"     # ask   ❌ H01
g "git push origin develop"     # deny ✅
g "git push -u origin develop"  # deny ✅
g "git push origin HEAD:develop" # deny ✅
g "git push"            # ask   ❌ H02
g "git push origin HEAD" # ask  ❌ H02
```

> Si le pasás el payload de Claude Code (`{"tool_name":...,"tool_input":...}`) el guard devuelve `ask` para todo. No es un defecto: este guard es para agy, que usa `toolCall`.

## H03 · Enlaces muertos

```bash
grep -n "agy-kit" docs/implementation-plan.md
```

Devuelve 7 líneas (4, 18, 19, 128, 129, 168, 177) más la fila de la ficha T-001 en la 276, que cita el nombre histórico y es correcta.

Verificador de enlaces markdown (excluye esquemas absolutos y reporta si el archivo ya existía en `develop`): `docs/revision-pr/pr-48/evidencia/links.mjs`. Sobre 96 enlaces relativos encuentra 1 roto, el de la línea 4.

## A01 · Archivos fuera de alcance

```bash
git diff --name-only origin/develop...HEAD \
  | grep -vE "^(AGENTS\.md|\.agents/|\.github/CODEOWNERS|\.github/pull_request_template\.md|docs/|supabase/AGENTS\.md|src/domain/AGENTS\.md|e2e/AGENTS\.md)"
```

Devuelve exactamente `tools/verify-t001.test.ts`.

## CODEOWNERS · lo que sí está bien

```bash
gh api "repos/cadeApp/cadeApp/codeowners/errors?ref=feat/T-001-kit-agy-codeowners"   # {"errors":[]}
gh api repos/cadeApp/cadeApp/collaborators --jq '.[].login'                          # Lautaro073, KiraK72
```

## Fichas vs plan

```bash
ls docs/tasks/*.md | grep -oE "T-[0-9]+" | sort > /tmp/f.txt
awk '/^### Fase 0/,/^### Fase 2/' docs/implementation-plan.md | grep -oE "^\| T-[0-9]+" | grep -oE "T-[0-9]+" | sort -u > /tmp/p.txt
comm -13 /tmp/f.txt /tmp/p.txt   # tareas sin ficha: ninguna
comm -23 /tmp/f.txt /tmp/p.txt   # fichas sin tarea: solo T-999 (el simulacro)
```

## Batería completa

```bash
rm -rf .next
pnpm typecheck && pnpm lint && pnpm test
```

`typecheck` exit 0 · `lint` limpio · `test` 38/38 en 7 archivos.
