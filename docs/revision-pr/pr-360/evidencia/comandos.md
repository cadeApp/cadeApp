# Evidencia — PR #360 — comandos y harness independiente

**SHA inspeccionado:** `325a9a6a09de404efedd40ad1ee5728e5d9f218f`. **Sin ejecución real de pruebas** en terminal del revisor (no existe clon y falla DNS). Ningún RED/GREEN de abajo se atribuye a esta revisión.

## Inspección

```bash
git fetch origin
git diff origin/develop...HEAD --stat
git merge-tree --write-tree origin/develop HEAD >/tmp/pr360-merge-tree.txt
git status --porcelain
```

## Baseline, GREEN normal (sólo después del arreglo)

```bash
pnpm exec vitest run 'src/features/requests/components/request-offers.test.tsx' 'src/features/requests/components/merchant-requests-list.test.tsx' 'src/app/(merchant)/merchant/requests/[id]/page.test.tsx' >/tmp/pr360-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-unit.log | tail -5
pnpm typecheck >/tmp/pr360-typecheck.log 2>&1
pnpm lint >/tmp/pr360-lint.log 2>&1
pnpm test >/tmp/pr360-test.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-test.log | tail -5
```

## Harness completo de mutación de producción — NO EJECUTADO

Crear el script en `/tmp` y correrlo sobre un worktree limpio con dependencias instaladas. El harness guarda bytes originales **en memoria**, cambia exclusivamente el archivo de producción, comprueba RED por aserción y siempre restaura en `finally`. Si el objetivo no coincide con el código del arreglo, sale como **SIN OBJETIVO**, no como RED. No usar `git checkout` para mutaciones.

```bash
cat >/tmp/pr360_mutaciones.py <<'PY'
from pathlib import Path
import subprocess, sys, re
root = Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('ABORT: árbol sucio')
def vitest(test):
    r = subprocess.run(['pnpm','exec','vitest','run',test],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    summary = ' | '.join(x.strip() for x in r.stdout.splitlines() if 'Test Files' in x or re.search(r'\bTests\s+',x))
    return r.returncode, summary, r.stdout
cases = [
('ruta-postmatch','src/app/(merchant)/merchant/requests/[id]/page.tsx',"result.request.status === 'matched'", "result.request.status === 'published'",'src/app/(merchant)/merchant/requests/[id]/page.test.tsx'),
('enlace-dashboard','src/features/requests/components/merchant-requests-list.tsx','`/trips/${req.id}`','`/merchant/requests/${req.id}`','src/features/requests/components/merchant-requests-list.test.tsx'),
('aceptacion-duplicada','src/features/requests/components/request-offers-list.tsx',"request.status === 'published'", "request.status === 'matched'",'src/features/requests/components/request-offers.test.tsx'),
('navegacion-viaje','src/features/requests/components/request-offers-list.tsx','router.replace(`/trips/${request.id}`)','router.refresh()','src/features/requests/components/request-offers.test.tsx'),
('terminal-expired','src/app/(merchant)/merchant/requests/[id]/page.tsx',"result.request.status === 'expired'", "result.request.status === 'published'",'src/app/(merchant)/merchant/requests/[id]/page.test.tsx')
]
fail=[]
for name,path,old,new,test in cases:
    p=root/path; original=p.read_bytes(); text=original.decode('utf-8')
    rc,s,out=vitest(test); print(f'{name} BASE GREEN rc={rc} {s}')
    if rc: fail.append(name+': baseline no verde'); continue
    if text.count(old)!=1: fail.append(name+': SIN OBJETIVO'); continue
    try:
        p.write_bytes(text.replace(old,new,1).encode('utf-8'))
        rc,s,out=vitest(test)
        red=rc!=0 and ('AssertionError' in out or 'expected' in out.lower())
        print(f'{name} MUTACIÓN RED rc={rc}, asercion={red} {s}')
        if not red: fail.append(name+': mutacion no detectada')
    finally: p.write_bytes(original)
    rc,s,out=vitest(test); print(f'{name} RESTAURADO GREEN rc={rc} {s}')
    if rc: fail.append(name+': no vuelve a verde')
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): fail.append('árbol sucio')
if fail: sys.exit('FALLOS: '+'; '.join(fail))
print('Todas las mutaciones efectivamente detectadas')
PY
python3 /tmp/pr360_mutaciones.py | tee /tmp/pr360-mutaciones.log
```

**Importante:** las anclas de `replace` y terminal aún NO existen en el HEAD inspeccionado; son anclas exigidas al arreglo, y deben adaptarse SIN contar como RED si no coinciden. Queda pendiente su ejecución en nueva ronda. No mutar E2E con código inseguro desplegado: usar sólo `e2e-mutation` aprobado.

## E2E Preview

Extender `e2e/specs/main-flow.spec.ts`: contextos de navegador independientes, éxito y carrera, ID de solicitud real con fixtures, DB `acceptedCount=1`, postmatch permitido, contacto prematch no visible para courier no asignado, reload/back/URL directa y dashboard. Registrar **workflow, job, run y SHA** en bitácora; 'Vercel Ready' no prueba DoD.

```bash
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-359-detalle-merchant-post-aceptacion
```

**Sin datos inventados:** ninguno de esos comandos se ejecutó en este entorno; sólo se verificó estructura JSONL en memoria y se inspeccionaron fuentes GitHub.
