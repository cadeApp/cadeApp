# Evidencia independiente — PR #471, Ronda 1

No se ejecutaron suites pnpm/Playwright ni CI desde el entorno del revisor: no existe checkout local del repositorio. No se usó la batería de mutaciones del autor. La validación propia de PDF fue ejecutada sobre bytes literales extraídos del diff de HEAD `2df0b1b1bf476ab3fa1ad698372b6e8d71ba6d5f`.

## H01: harness completo (copiar a /tmp y ejecutar)
Requisitos para esta verificación local independiente: Python 3 y `pdfinfo` (poppler-utils). El test productivo no necesita `pdfinfo`, solo el control del revisor.

```bash
cat > /tmp/pr471-pdf-review.py <<'PY'
from pathlib import Path
import re, codecs, subprocess, sys
spec=Path('e2e/specs/courier-onboarding.spec.ts')
if spec.exists():
    txt=spec.read_text()
    values=re.findall(r"buffer:\s*Buffer\.from\('((?:\\.|[^'\\])*)'\)", txt)
    fixtures=[codecs.decode(v,'unicode_escape').encode('latin-1') for v in values]
    fixtures=[f for f in fixtures if f.startswith(b'%PDF-1.4\n')]
    if not fixtures:
        raise SystemExit('SIN OBJETIVO: no se encontraron fixtures PDF de T-387')
else:
    print('Sin checkout local: usando bytes exactos extraídos del diff de GitHub')
    fixtures=[b'%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n']
for i,f in enumerate(fixtures,1):
    p=Path('/tmp')/f'pr471-fixture-{i}.pdf'
    p.write_bytes(f)
    r=subprocess.run(['pdfinfo',str(p)],text=True,capture_output=True)
    print('T-387 fixture',i,'bytes',len(f),'exit',r.returncode,'pages?',next((l for l in r.stdout.splitlines() if l.startswith('Pages:')), 'NO'))
    print('\n'.join(r.stderr.splitlines()[:3]))
    if r.returncode == 0 and re.search(r'^Pages:\s+1$',r.stdout,re.M):
        raise SystemExit('Fixture real encontrada; re-evaluar el hallazgo')
# Control positivo (estructura PDF de una página con xref).
objs=[
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    b'<< /Length 42 >>\nstream\nBT /F1 12 Tf 20 240 Td (PDF E2E) Tj ET\nendstream',
    b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
]
out=bytearray(b'%PDF-1.4\n'); off=[0]
for idx,obj in enumerate(objs,1):
    off.append(len(out))
    out+=f'{idx} 0 obj\n'.encode()+obj+b'\nendobj\n'
xref_at=len(out)
out+=f'xref\n0 {len(off)}\n0000000000 65535 f \n'.encode()
for n in off[1:]: out+=f'{n:010d} 00000 n \n'.encode()
out+=f'trailer\n<< /Size {len(off)} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n'.encode()
p=Path('/tmp/pr471-control-valid.pdf');p.write_bytes(out)
r=subprocess.run(['pdfinfo',str(p)],text=True,capture_output=True)
print('Control positivo','exit',r.returncode,next((l for l in r.stdout.splitlines() if l.startswith('Pages:')),'NO'))
if r.returncode or not re.search(r'^Pages:\s+1$',r.stdout,re.M):
    print(r.stderr);sys.exit(1)
PY
python3 /tmp/pr471-pdf-review.py
```

**Salida observada en el entorno de revisión (sin checkout local):**
```text
Sin checkout local: usando bytes exactos extraídos del diff de GitHub
T-387 fixture 1 bytes 77 exit 99 pages? NO
Syntax Warning: No valid XRef size in trailer
Syntax Error: Catalog dictionary does not contain a valid "Pages" entry
Command Line Error: Wrong page range given: the first page (1) can not be after the last page (0).
Control positivo exit 0 Pages:           1
```

Con checkout, el mismo harness enumera los buffers originales del spec (no una copia manual); el control **debe fallar si el archivo pasa a ser válido**, pues este es un test de defecto. No convierte por sí mismo a GREEN la suite E2E.

## H02: mutaciones independientes propuestas — no ejecutadas
1. Crear en `components.test.tsx` prueba con `FileReader.readAsArrayBuffer` diferido, sin alterar `validateDocumentFile`. Elegir PDF y someter `VehicleForm` con consentimiento y placa válidos antes del `onload`. La acción `courierOnboardingAction` no debe ejecutarse. Resolver lectura, esperar `uploadCourierDocument`, someter nuevamente y verificar `documents.license` o `documents.insurance` con `.pdf`.
2. Control independiente **M-H02a**: con prueba anterior verde, mover de forma efímera `setOptionalStatuses(...'uploading')` debajo de `await validateDocumentFile`. Debería quedar RED por acción prematura. Restaurar en memoria y confirmar GREEN, registrando líneas resumen.
3. Para `DocumentReplacementCard` inyectar demora en `FileReader`, afirmar `disabled` durante validación y que un segundo intento no genere dos uploads/RPC. Control **M-H02b**: retrasar `setUploadStatus('uploading')` hasta después del await; el test debe quedar rojo.

No se atribuyen resultados RED/GREEN a M-H02a/b porque no se pudieron ejecutar.

## Comprobaciones pendientes en nueva ronda
- Clonar/actualizar un worktree limpio del HEAD remoto exacto (no copiar un SHA de la bitácora).
- Validar el alcance contra la ficha de `develop`.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` tras corrección.
- E2E Preview real del SHA corregido; verificar logs/run/resultado y `audit_log`, sin fabricar evidencia.
- `node docs/revision-pr/analizar.mjs verificacion`; verificar solo la carpeta que pertenece a la revisión.

---

# Ronda 2 — Evidencia independiente — 2026-10-21

## Identidad
- Commit de **código** evaluado: `59e7a36cf14943ba9ad7db945907f420fea1d0a9`.
- Commit **bitácora/HEAD** evaluado: `fceddca2ac5c77c3236dc29266ae25be0be65514`.
- Comparación GitHub con la ronda 1: cinco archivos modificados, todos dentro de T-387. HEAD sincronizado con develop, sin modificaciones por el autor en `docs/revision-pr/pr-471/**`.
- Limitación: no fue posible clonar GitHub desde el contenedor de revisión (`Could not resolve host: github.com`). Los tests pnpm y Playwright **no** se ejecutaron en el contenedor del revisor. Se leyó el código directamente desde GitHub en el SHA indicado.

## H01 — PDF válido, control independiente
El cuerpo de `buildOnePagePdf(label)` fue transcrito de manera literal desde `e2e/specs/courier-onboarding.spec.ts@59e7a36cf14943ba9ad7db945907f420fea1d0a9` a un harness Node temporal en `/tmp/pr471_r2_pdf.js` y ejecutado (sin package manager y sin tocar rama). `pdfinfo` del archivo resultante devolvió **exit 0, Pages: 1**, 598 bytes con el rótulo `T-387 licencia registro`. El control roto del catálogo `/Pages` → `/Paxes` devolvió **exit 99, Catalog dictionary does not contain a valid "Pages" entry**. Así se prueba una propiedad real del PDF con un parser independiente; NO se atribuye ejecución de E2E al revisor.

### Harness completo portable
Copiar a `/tmp/pr471-r2-pdf.js` y ejecutar `node /tmp/pr471-r2-pdf.js`, luego `pdfinfo /tmp/pr471-r2-valid.pdf`, `pdfinfo /tmp/pr471-r2-corrupt.pdf`. No genera artefactos en el repositorio. Se conserva el helper exacto de `59e7a36cf14943ba9ad7db945907f420fea1d0a9`.

```js
const fs = require('fs');
function buildOnePagePdf(label) {
  const stream = `BT /F1 18 Tf 72 720 Td (${label}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
const pdf = buildOnePagePdf('T-387 licencia registro');
fs.writeFileSync('/tmp/pr471-r2-valid.pdf', pdf);
const broken = Buffer.from(pdf);
const old = Buffer.from('/Pages 2 0 R');
const idx = broken.indexOf(old);
if (idx < 0) throw new Error('SIN OBJETIVO: no se encontró el catálogo');
broken.write('/Paxes 2 0 R', idx, 'latin1');
fs.writeFileSync('/tmp/pr471-r2-corrupt.pdf', broken);
console.log('valid bytes:', pdf.length);
```

**Registro real del revisor**: `pdfinfo /tmp/pr471_r2_valid.pdf` -> `Pages: 1`, exit 0; `pdfinfo /tmp/pr471mut0.pdf` con el mismo cambio de catálogo -> exit 99.

La implementación E2E incluye exactamente 3 llamadas a `await expectStoredPdf(...)`, que descargan el objeto desde Storage, comprueban igualdad byte a byte con el archivo enviado y ejecutan `expectOnePagePdf`. Esto se confirmó por inspección del SHA, no ejecutando Playwright.

## H02 — controles estáticos independientes con mutaciones en memoria
Se leyeron los dos módulos desde GitHub `@59e7a36cf14943ba9ad7db945907f420fea1d0a9` y se ejecutó un harness JS sobre el contenido inmutable; las mutaciones son copias de string en memoria, no edits de archivos y no commits. Predicados de la guarda:
1. En VehicleForm, `setOptionalStatuses(... 'uploading')` está antes de `await validateDocumentFile` y `if (!isCurrent()) return` queda después de la lectura y antes de la subida.
2. En DocumentReplacementCard, `if (inFlightRef.current) return`, `inFlightRef.current = true` y `setUploadStatus('uploading')` anteceden a `await processSelectedFile(file)`.

Resultados observados:

| Control | Código sano | Mutación independiente | Resultado |
| --- | --- | --- | --- |
| Orden busy VehicleForm | GREEN | borrar busy previo al await | RED |
| Orden busy VehicleForm | GREEN | mover busy después del await | RED |
| Guard intento ReplacementCard | GREEN | borrar guarda de `inFlightRef` | RED |
| Busy ReplacementCard | GREEN | borrar busy previo al await | RED |

Este control comprueba la **posición y existencia** de guardas, pero no ejecuta React/DOM. La evidencia de M7 y M8 de tests runtime RED/GREEN la aporta el autor en la bitácora y **no se presenta como reproducida por este revisor**. El job oficial unit del SHA `fceddca2ac5c77c3236dc29266ae25be0be65514` contiene `Test Files 155 passed (155)` y `Tests 3153 passed (3153)` (job 119025518455), incluyendo los nuevos tests de la feature.

Harness resumido reproducible en cualquier checkout, script completo con las expresiones que se verificaron:

```js
const fs = require('fs');
const v = fs.readFileSync('src/features/courier-onboarding/components/vehicle-form.tsx', 'utf8');
const r = fs.readFileSync('src/features/courier-onboarding/components/document-replacement-card.tsx', 'utf8');
const slice = (t, a, b) => t.slice(t.indexOf(a), t.indexOf(b, t.indexOf(a) + a.length));
const vb = slice(v, 'const handleOptionalUpload =', 'const handleSubmit =');
const rb = slice(r, 'const handleFileSelected =', 'const processSelectedFile =');
const busyV = "setOptionalStatuses((prev) => ({ ...prev, [kind]: 'uploading' }));";
const checkV = x => x.indexOf(busyV) >= 0 && x.indexOf(busyV) < x.indexOf('const check = await validateDocumentFile(kind, file);') && x.indexOf('if (!isCurrent()) return;') > x.indexOf('const check = await validateDocumentFile(kind, file);');
const checkR = x => {
  const a = x.indexOf('if (inFlightRef.current) return;');
  const b = x.indexOf('inFlightRef.current = true;');
  const c = x.indexOf("setUploadStatus('uploading');");
  const d = x.indexOf('await processSelectedFile(file)');
  return a >= 0 && a < b && b < c && c < d;
};
const cases = [
 ['Vehicle original', checkV(vb), true],
 ['Vehicle sin busy', checkV(vb.replace(busyV, '')), false],
 ['Vehicle busy tardío', checkV(vb.replace(busyV, '').replace('const check = await validateDocumentFile(kind, file);', 'const check = await validateDocumentFile(kind, file);' + busyV)), false],
 ['Replacement original', checkR(rb), true],
 ['Replacement sin guard', checkR(rb.replace('if (inFlightRef.current) return;', '')), false],
 ['Replacement sin busy', checkR(rb.replace("setUploadStatus('uploading');", '')), false],
];
for (const [name, actual, expected] of cases) {
  if (actual !== expected) throw new Error(`Control roto: ${name} expected ${expected}, observed ${actual}`);
  process.stdout.write(`${name}: ${actual === true ? 'GREEN' : 'RED'}\n`);
}
```

Advertencia: el comentario de los nuevos tests declara que no mockea la subida ni las acciones, pero los tests sí usan `mockUploadCourierDocument.mockResolvedValue` y `vi.spyOn(...).mockResolvedValue`; esto es normal en pruebas unitarias, y **no** constituye por sí mismo un test falso. Hay E2E de Storage real que cubren el flujo. Mejora documental no bloqueante: describir esos mocks con precisión al tocar esos tests en el futuro.

## H03 — bitácora y trazabilidad
`compare_commits` entre commit de revisión anterior `02d7180a` y `fceddca2ac5c77c3236dc29266ae25be0be65514`: 5 archivos de la tarea y 0 en `docs/revision-pr/**`. `docs/tasks/log/T-387.md@fceddca2ac5c77c3236dc29266ae25be0be65514` tiene una NUEVA entrada fechada 2026-10-21, conservando íntegra la de 2026-10-20, distinguiendo evidencia propia del autor y dependencias pendientes. La PR #470 está mergeada en develop y #471 abierta.

## CI y E2E — estado al cierre de esta revisión
- Código `59e7a36cf14943ba9ad7db945907f420fea1d0a9`: CI oficial run 39538285344 success; incluye unit, db-tests, typecheck, lint, build, audit y bundle-budget.
- HEAD `fceddca2ac5c77c3236dc29266ae25be0be65514`: unit, typecheck, lint, build, audit y bundle-budget: success; job `unit` 3153/3153; `db-tests` aún in_progress al último chequeo; `approval-policy` failure a falta del nuevo informe en HEAD; status `e2e-preview` pending.
- E2E local de la bitácora, no replicado por el revisor: 12/12 courier-onboarding, total 100 pass + 2 flaky + 1 fallo ajeno de subscription y 2 sin ejecutar; reintento de esa spec solo 3 passed. No se presenta toda la suite local como GREEN.
- Bundle warning `/courier/onboarding/vehicle` y `/courier/profile` 259 kB en primer SHA vs 258 kB en este HEAD; no hay regresión atribuible a esta corrección. Sigue siendo advertencia, no un check que bloquee.
- **No mergear hasta que `e2e-preview` y los checks obligatorios del HEAD aplicable estén en verde y la política de informe quede satisfecha**; no pedir una repetición del CI solo por el commit documental de esta revisión.
