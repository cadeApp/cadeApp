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

## Ronda 3 — 19439be7962e8f1b8cde4b02c910f7bbfd717577 (2026-10-15)

**Observado por el revisor sin ejecutar:** compare con ronda 2: sólo 4 archivos de implementación/test/bitácora modificados, todos dentro de ficha. Unit CI PASS (130/130, 2180 Vitest, 79 workflow, 6 ADR), db-tests PASS (Files=22 Tests=2205), lint/typecheck/build/audit/bundle PASS. approval-policy FAIL porque requiere aprobación vigente de Lautaro073. NO existe e2e-preview en check runs de este SHA. No se descargaron secretos ni se lanzó ningún workflow.

### Control independiente propuesto — producción mutada en memoria (NO ejecutado)

Se mantiene el harness de ronda 2 y se agrega este caso específico H02. La mutación debe partir de control GREEN y restaurar bytes en finally; el RED válido debe ser AssertionError de test real, NO falta de import ni SIN OBJETIVO.

```bash
cat >/tmp/pr360-r3-latch.py <<'PY'
from pathlib import Path
import subprocess, sys, re
root=Path(subprocess.check_output(['git','rev-parse','--show-toplevel'],text=True).strip())
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('ABORT: árbol sucio')
file=root/'src/features/requests/components/request-offers-list.tsx'
testfile='src/features/requests/components/request-offers.test.tsx'
def run():
    p=subprocess.run(['pnpm','exec','vitest','run',testfile],cwd=root,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    lines=[x.strip() for x in p.stdout.splitlines() if 'Test Files' in x or re.search(r'\bTests\s+',x)]
    return p.returncode,'; '.join(lines[-3:]),p.stdout
code,summary,_=run(); print('BASELINE',code,summary)
if code: sys.exit('SIN GREEN inicial')
before=file.read_bytes()
codeText=before.decode('utf-8')
old="request.status === 'published' && !isExpired && !isReconciling"
new="request.status === 'published' && !isExpired"
if codeText.count(old)!=1: sys.exit('SIN OBJETIVO: el código cambió, ajustar el control antes de evaluar')
try:
    file.write_bytes(codeText.replace(old,new,1).encode('utf-8'))
    code,summary,log=run()
    red=code!=0 and ('AssertionError' in log or re.search(r'\bexpected\b',log,re.I))
    print('MUTACION',code,'ASSERT_RED',bool(red),summary)
    if not red: sys.exit('No detectada: no contar como mutación roja')
finally:
    file.write_bytes(before)
code,summary,_=run(); print('RESTORED',code,summary)
if code: sys.exit('No regresó a GREEN')
if subprocess.check_output(['git','status','--porcelain'],cwd=root,text=True).strip(): sys.exit('Árbol sucio tras restauración')
print('CONTROL H02 DETECTADO')
PY
python3 /tmp/pr360-r3-latch.py | tee /tmp/pr360-r3-latch.log
```

### E2E — casos a verificar en Preview

Usar fixture existente de dos sesiones y `getRequestInspectionData`: acceptedOfferId único, correo de comercio en contextos separados, aceptación/concurrencia, loser determinado por error ALREADY_MATCHED o IDs aceptados, contacto/name del courier y monto/medio de pago. En la página viaje hacer **reload antes de goBack**, luego Back puede llevar a dashboard/login anterior (válido) pero nunca al selector activo. Tras Back navegar directo a `/merchant/requests/{id}` y exigir redirección a `/trips/{id}`. Registrar run/commit exactos del E2E de Preview. No hacer mutation E2E sin `e2e-mutation` aprobada.

### Comandos reproducibles finales para worktree limpio

```bash
git fetch origin
git merge-tree --write-tree origin/develop HEAD > /tmp/pr360-r3-merge-tree.txt
pnpm exec vitest run 'src/features/requests/components/request-offers.test.tsx' > /tmp/pr360-r3-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr360-r3-unit.log | tail -3
node docs/revision-pr/analizar.mjs verificacion
git diff --check
```

Estos comandos no fueron ejecutados en la sesión del revisor; el entorno carece de clone/pnpm. No se declaran mutaciones verificadas.

## Ronda 5 — inspección del SHA e1e7e53ee1c50bdfa89468132ff5194d6b781860 (2026-10-15)

- `compare efb22c421..e1e7e53ee1c50bdfa89468132ff5194d6b781860`: 1 commit, 1 archivo modificado `docs/tasks/log/T-359.md` (25+ / 1-). Ningún archivo de app, CI o E2E tocado.
- Check-runs GitHub: `unit` job 116253582996 SUCCESS; `db-tests` 116253583040 SUCCESS; typecheck/lint/build/audit/bundle-budget SUCCESS; approval-policy 116253579354 FAILURE; ningún `e2e-preview`.
- Log db-tests job 116253583040: `Files=22, Tests=2205`, `Result: PASS`.
- Log unit job 116253582996: `Test Files 130 passed (130)`; 79 workflows pass; 6 ADR pass. El cuerpo del PR declara 2180 tests Vitest, coherente con el job en verde.
- E2E dispatch `38683340222` (resolve job 116252553470) y `38683340102` (resolve job 116252552770): `resolve-preview success`, `e2e-preview skipped`, `report-preview-status skipped`, texto literal `El deployment no pertenece al proyecto Vercel de develop.`
- Runs adicionales `38683699875`, `38683734389`, `38683748905`, `38683868520`, `38684013129` muestran el mismo descarte, confirmados con logs de resolve; no se atribuye al código de la PR.
- `.github/workflows/e2e-preview-target.mjs` desde develop: `matchPreview` compara `payload.project.id` con `VERCEL_PROJECT_ID` del Environment develop, requiere PR abierta contra develop con SHA exacto y gate de duplicados.
- Vercel lectura: proyectos distintos `cadeapp-staging` y `cadeapp-develop`; ambos tienen deployment READY para `e1e7e53ee1c50bdfa89468132ff5194d6b781860` (ID del proyecto/deploy no se pega porque no es necesario). `get_webhooks` para develop devolvió 403 Forbidden; no se pudo acreditar configuración.
- No se ejecutó E2E/mutación local por el revisor. No se modificaron los workflows/secretos/entornos remotos.
- Reproducir una vez que webhook del proyecto develop esté validado: comprobar que run resolve declara `PR interna #360 contra develop`, que `needs.resolve.outputs.run=true`, que E2E Playwright pasa, y que `report-preview-status` publica `e2e-preview=success` en el SHA exacto.

## Ronda 6 — 2026-10-15 — HEAD ceb1161b07f1419992e764bbe17db9a28ea2fc2e

**Fuente real del RED:** https://github.com/cadeApp/cadeApp/actions/runs/38694202782, job https://github.com/cadeApp/cadeApp/actions/runs/38694202782/job/116286928820, `Run preview E2E gate`, SHA objetivo registrado por commit status `e2e-preview=failure`.

Resumen textual real de Playwright:
```
1 failed
  [chromium] › e2e/specs/main-flow.spec.ts:89:7 › ... › DoD: Aceptación concurrente en dos sesiones independientes navega a /trips/[id] y converge
75 passed (21.1m)
Error: expect.toBeVisible: Error: strict mode violation: getByText('$ 1.500') resolved to 2 elements
1) <span class="shrink-0 font-display text-lg font-bold text-foreground">$ 1.500</span>
2) <div class="rounded-lg border border-border/50 bg-background/80 p-2.5 text-sm italic text-muted-foreground">"Hola! Tu pedido va en camino con ...</div>
e2e/specs/main-flow.spec.ts:248:78
```
Hubo retries que fallaron con el mismo tipo de strict mode (valores $ 1.500 y $ 2.000). El test pudo ejecutar sus asserts previos a línea 248, no los posteriores. No concluir que WhatsApp, Back y reload están validados. La bitácora propia todavía no consigna este RED.

**Comparación de DOM en SHA inspeccionado:** `src/features/trips/components/trip-merchant-view.tsx` tiene `<Card><CardHeader><h2>Repartidor asignado</h2></CardHeader><CardContent>...<span>{formatArs(trip.amountArs)}</span>...</CardContent></Card>` y otra Card de "Avisale a tu cliente" con `dropCustomerMsg` (`src/lib/whatsapp.ts` lo construye incluyendo costo de envío). `getByText` amplio coincide con ambos.

**Causa exacta del RED** es demostrada por Playwright. **No se ejecutó mutación independiente ni Playwright local**: no hay clon/pnpm en este entorno. No inventar un comando verde.

**Alcance del merge previo:** `ceb1161b` tiene dos padres: `235559ec` y `cba78a29`. El E2E T-359 y T-360 coexisten, en tests merchant conviven T-359/T-364, y el source merchant-requests-list de develop ya tiene ruta /trips y acción de cancelar. `develop` volvió a avanzar a `3b9f4090`: esos cambios son otras rutas y schemas, sin conflicto demostrado; requiere revalidar el merge-tree antes del merge final.

**CI del HEAD:** `unit` SUCCESS: 132 suites Vitest, 79 workflow y 6 ADR; `db-tests` SUCCESS: `Files=22 Tests=2205 Result: PASS` (el job ejecutó otros checks de mutación RED/GREEN de CC-024, no confundir con evidencia T-359); `typecheck/lint/build/audit/bundle-budget` SUCCESS. `approval-policy` FAIL por aprobación vigente pendiente. `e2e-preview` commit status `failure`.

**Reproducción pedida al autor**: reemplazar SOLO selector amplio en las DOS aserciones de monto del spec (antes y después de reload). Seleccionar la Card usando el heading h2 `Repartidor asignado` y los dos niveles padre `locator('..').locator('..')`, dentro de ella `getByText(formatArs(acceptedOffer.amountArs), {exact:true})`, con `toHaveCount(1)` y `toBeVisible()`. Sin `first`, `nth`, temporizadores, fake DOM ni cambio de UI. Ejecutar test completo sobre Preview real del nuevo SHA, conservar el RED original y anotar GREEN si sucede.

No se ejecutó `git merge-tree` ni `pnpm` desde clon local; la PR figuraba `mergeable:true` y develop se movió desde la última sincronización, por lo que no se declara rebase completo.
