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
