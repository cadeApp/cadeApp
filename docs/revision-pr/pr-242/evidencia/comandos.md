# Evidencia y comandos reproducibles — PR #242

## SHA de Ronda 1

`ddf7f5991257f98b2371f8f51659ea9d6e6d1c87`

Base: `b4119ef3e16170decda0a1649fc35db207faa8b0`.

GitHub compare informó:

    status: ahead
    ahead_by: 1
    behind_by: 0

## Limitación del entorno

Intento real del revisor:

    git ls-remote https://github.com/cadeApp/cadeApp.git       refs/heads/fix/T-325-feed-real-documents refs/heads/develop

Resultado:

    fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
    Could not resolve host: github.com

Por eso no se registra ningún RED/GREEN como ejecutado por la revisión en R1.

## Batería independiente para reproducir en R2

El siguiente arnés se corre en un worktree limpio del SHA a revisar. Las mutaciones se hacen solo dentro del worktree temporal y se restauran copiando el archivo original guardado en `/tmp`, nunca con rebase/amend.

### H01 — cortar el cableado página → CourierFeed

Baseline esperado:

    pnpm vitest run       "src/app/(courier)/courier/feed/page.test.tsx"       src/features/offers/courier-panel.test.tsx

Mutación:

```bash
set -euo pipefail
FILE='src/app/(courier)/courier/feed/page.tsx'
TMP="$(mktemp -d)"
cp "$FILE" "$TMP/page.tsx"

python - <<'PY'
from pathlib import Path
p=Path("src/app/(courier)/courier/feed/page.tsx")
s=p.read_text()
old="      documents={documents}\n"
if old not in s:
    raise SystemExit("objetivo H01 no encontrado")
p.write_text(s.replace(old, "      documents={undefined}\n", 1))
PY

pnpm vitest run "src/app/(courier)/courier/feed/page.test.tsx"
cp "$TMP/page.tsx" "$FILE"
pnpm vitest run "src/app/(courier)/courier/feed/page.test.tsx"
```

Criterio: mutado RED por pérdida de los documentos; restaurado GREEN.

### H02 — reintroducir el CTA circular

Tras el arreglo esperado `showFeedButton={false}`:

```bash
set -euo pipefail
FILE='src/features/offers/components/courier-feed.tsx'
TMP="$(mktemp -d)"
cp "$FILE" "$TMP/courier-feed.tsx"

python - <<'PY'
from pathlib import Path
p=Path("src/features/offers/components/courier-feed.tsx")
s=p.read_text()
old='<StatusView documents={documents} showFeedButton={false} />'
if old not in s:
    raise SystemExit("objetivo H02 no encontrado")
p.write_text(s.replace(old, '<StatusView documents={documents} />', 1))
PY

pnpm vitest run src/features/offers/courier-panel.test.tsx
cp "$TMP/courier-feed.tsx" "$FILE"
pnpm vitest run src/features/offers/courier-panel.test.tsx
```

Criterio: mutado RED porque reaparece «Ir al panel de repartidor» en el feed pending; restaurado GREEN.

### H03 — volver a ignorar authError

Tras agregar el guard:

```bash
set -euo pipefail
FILE='src/app/(courier)/courier/feed/page.tsx'
TMP="$(mktemp -d)"
cp "$FILE" "$TMP/page.tsx"

python - <<'PY'
from pathlib import Path
p=Path("src/app/(courier)/courier/feed/page.tsx")
s=p.read_text()
needle="""  if (authError) {
    throw new Error('Error al verificar sesión del repartidor');
  }

"""
if needle not in s:
    raise SystemExit("objetivo H03 no encontrado")
p.write_text(s.replace(needle, "", 1))
PY

pnpm vitest run "src/app/(courier)/courier/feed/page.test.tsx"
cp "$TMP/page.tsx" "$FILE"
pnpm vitest run "src/app/(courier)/courier/feed/page.test.tsx"
```

Criterio: mutado RED en el caso authError; restaurado GREEN.

## Checks de cierre de la próxima ronda

    pnpm vitest run       "src/app/(courier)/courier/feed/page.test.tsx"       src/features/offers/courier-panel.test.tsx       src/features/courier-onboarding/components.test.tsx
    pnpm typecheck
    pnpm lint
    pnpm test
    pnpm build
    git diff --check
    pnpm vitest run tools/verify-fichas.test.ts
    node .github/workflows/verify-workflows.test.mjs
    node docs/adr/verify-adr.test.mjs

En `pnpm build`, leer el número de `/courier/feed`: debe ser <= 180 kB; no alcanza con que el job sea verde.

CI detallado se audita solo cuando los bloqueantes estén resueltos.
