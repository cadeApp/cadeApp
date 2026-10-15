# Evidencia y comandos PR #360 — ronda 2

**HEAD leído:** aacf8291fdb331da53b94fa7471679b2792f5ecf. Revisor no tiene clone/pnpm ni red git hacia github.com; no se corrieron tests locales ni E2E ni mutaciones. Fuente: conector GitHub y logs de CI, no supabase remoto.

- Unit job 116235162530: `Test Files 130 passed (130)` y `Tests 2179 passed (2179)`; workflow checks 79 passed, ADR 6 passed.
- db-tests job 116235162614: `Files=22, Tests=2205, Result: PASS`; el check incluye `git diff --exit-code -- src/types/database.types.ts`.
- `e2e-preview` ausente entre los 13 check-runs del SHA. `approval-policy` rojo. Vercel Ready no es E2E.

## Comandos baseline para runner con repositorio

```bash
git fetch origin
git status --porcelain
git merge-tree --write-tree origin/develop HEAD > /tmp/pr360-merge-tree.txt
pnpm exec vitest run 'src/features/requests/components/request-offers.test.tsx' 'src/app/(merchant)/merchant/requests/[id]/page.test.tsx' > /tmp/pr360-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-unit.log | tail -4
pnpm typecheck > /tmp/pr360-tsc.log 2>&1
pnpm lint > /tmp/pr360-lint.log 2>&1
pnpm test > /tmp/pr360-full.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-full.log | tail -4
```

## Harness independiente completo: guardar bytes en memoria, nunca checkout

El test normal debe dar GREEN primero; un ancla faltante es SIN OBJETIVO (error del instrumento), no RED. No se ejecutó este script. Reproducir en worktree limpio con dependencias instaladas.

```bash
cat > /tmp/pr360_r2_mutaciones.py <<'PY'
from pathlib import Path
import subprocess, re, sys
root = Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('ABORT: árbol sucio')
def test(file):
    r = subprocess.run(['pnpm','exec','vitest','run',file],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    summ = ' | '.join(s.strip() for s in r.stdout.splitlines() if 'Test Files' in s or re.search(r'\bTests\s+',s))
    return r.returncode,summ,r.stdout
cases=[
 ('terminal','src/app/(merchant)/merchant/requests/[id]/page.tsx',"request.status === 'cancelled' || request.status === 'expired'","request.status === 'cancelled'",'src/app/(merchant)/merchant/requests/[id]/page.test.tsx'),
 ('expiracion','src/features/requests/components/request-offers-list.tsx',"request.status === 'published' && !isExpired","request.status === 'published' && isExpired",'src/features/requests/components/request-offers.test.tsx'),
 ('replace','src/features/requests/components/request-offers-list.tsx','router.replace(`/trips/${request.id}`)','router.refresh()','src/features/requests/components/request-offers.test.tsx'),
 ('refresh-ya-asignada','src/features/requests/components/request-offers-list.tsx',"notify.error('Esta solicitud ya fue asignada a otro repartidor.');\n          setSelectedOffer(null);\n          router.refresh();","notify.error('Esta solicitud ya fue asignada a otro repartidor.');\n          setSelectedOffer(null);",'src/features/requests/components/request-offers.test.tsx'),
]
failed=[]
for name,path,needle,replacement,spec in cases:
    rc,summary,_ = test(spec)
    print(name,'GREEN baseline',rc,summary)
    if rc: failed.append(name+': baseline roja'); continue
    p=root/path
    before=p.read_bytes()
    content=before.decode('utf-8')
    if content.count(needle)!=1: failed.append(name+': SIN OBJETIVO'); continue
    try:
        p.write_bytes(content.replace(needle,replacement,1).encode('utf-8'))
        rc,summary,output=test(spec)
        red = rc!=0 and ('AssertionError' in output or re.search(r'\bexpected\b',output,re.I))
        print(name,'RED mutado',rc,bool(red),summary)
        if not red: failed.append(name+': mutación no detectada')
    finally: p.write_bytes(before)
    rc,summary,_=test(spec)
    print(name,'GREEN restaurado',rc,summary)
    if rc: failed.append(name+': no restauró GREEN')
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): failed.append('árbol sucio')
if failed: sys.exit('FALLOS: '+'; '.join(failed))
print('Mutaciones de producción detectadas')
PY
python3 /tmp/pr360_r2_mutaciones.py | tee /tmp/pr360-r2-mutations.log
```

**Pendiente para arreglo H02:** mutar además el nuevo latch de reconciliación (quitarlo del render y handlers), demostrar RED del test que verifica que Aceptar permanece oculto durante router.refresh, restaurar y GREEN. No atribuir esa mutación a este SHA porque no existe el latch.

## Preview sin producción

Playwright E2E de 2 sesiones, oráculo DB real, contacto prematch/postmatch, monto/pago, retroceso y refresh, sin cambiar fixtures para forzar verde. Capturar SHA, run, job y resultado `e2e-preview`; nunca ejecutar Docker ni Supabase local, ni disparar workflows manualmente.

```bash
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git ls-remote origin feat/T-359-detalle-merchant-post-aceptacion
```

**Nada de lo anterior se presenta como ejecutado por el revisor.**
