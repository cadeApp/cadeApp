# Evidencia reproducible — PR470 ronda 1

**Origen:** inspección estática de GitHub en SHA `dbdc4b322e614adeb4115f35f44678ea9c29989f`. El contenedor no resolvió `github.com` y no tiene un checkout; no se atribuyen resultados de ejecución.

Evidencia por código: `verify-fichas.test.ts:149-165` compara primer DoD con sexta columna del plan; `vehicle-form.tsx:135-145` llama `compressImage(file)` para licencia/seguro; `vehicle-form.tsx:412-423` utiliza `DocumentUploadCard`; el parser `verify-fichas.test.ts:25-30` no expande llaves; el bucket `courier-docs` define 10485760 bytes.

## Harness completo (se copia a /tmp/pr470-r1-check.cjs)

```javascript
const fs = require("node:fs");
const text = p => fs.readFileSync(p,"utf8");
const source = {
 task: text("docs/tasks/T-387.md"),
 plan: text("docs/implementation-plan.md"),
 vehicle: text("src/features/courier-onboarding/components/vehicle-form.tsx")
};
const section = (s,h) => s.match(new RegExp("## "+h+"\\n([\\s\\S]*?)(?=\\n## |$)"))?.[1] || "";
const planRow = s => s.split("\n").find(x => /^\|\s*T-387\s*\|/.test(x)) || "";
const entries = s => [...section(s,"Archivos permitidos").matchAll(/`([^`]+)`/g)].map(x=>x[1]);
const checks = {
 H01(s) {
  const first=section(s.task,"DoD").match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim();
  const expected=planRow(s.plan).split("|")[6]?.trim();
  return Boolean(first && expected && first===expected);
 },
 H02(s) {
  return entries(s.task).includes("src/features/courier-onboarding/components/vehicle-form.tsx")
   && /registro inicial|alta inicial|onboarding inicial/i.test(section(s.task,"DoD"))
   && /handleOptionalUpload/.test(s.vehicle);
 },
 H03(s) {
  const es=entries(s.task);
  return es.length>0 && es.every(x=>!/[{}]/.test(x))
   && es.includes("src/features/courier-onboarding/components/document-upload-card.tsx")
   && es.includes("src/features/courier-onboarding/components/document-replacement-card.tsx");
 },
 H04(s) {
  const unit="10 MiB (10.485.760 bytes)";
  return s.task.includes("10 MiB") && s.task.includes("10.485.760 bytes") && planRow(s.plan).includes("10 MiB");
 }
};
const values=Object.entries(checks).map(([id,fn])=>[id,fn(source)]);
for (const [id,pass] of values) process.stdout.write(id+" "+(pass?"GREEN":"RED")+"\n");
const green=values.every(([,pass])=>pass);
if (process.argv.includes("--mutation-check")) {
 if (!green) {
  console.error("Baseline no está GREEN; no declarar RED de mutaciones");
  process.exitCode=1;
 } else {
  const changed=[
   ["H01",{...source,task:source.task.replace(/^- \[[ x]\] (.*)$/m,x=>x+" MUTACION")}],
   ["H02",{...source,task:source.task.replace("`src/features/courier-onboarding/components/vehicle-form.tsx`","")}],
   ["H03",{...source,task:source.task.replace("`src/features/courier-onboarding/components/document-upload-card.tsx`","`src/features/courier-onboarding/components/{document-upload-card,document-replacement-card}.tsx`")}],
   ["H04",{...source,plan:source.plan.replace("10 MiB (10.485.760 bytes)","10 MB")}]
  ];
  for(const [id,s] of changed) {
   const red=!checks[id](s);
   console.log("MUTACION "+id+": "+(red?"RED esperado":"CIEGA"));
   if(!red) process.exitCode=1;
  }
 }
} else if(!green) process.exitCode=1;
```

El script no altera el repositorio. En SHA original se esperan H01-H04 **RED** por propiedades inspeccionadas, **no es una salida observada**. Tras corregir ficha y plan se esperan GREEN. Solo después ejecutar `--mutation-check` para forzar RED independientes en memoria; si una queda CIEGA no cerrar.

## Comandos cuando haya checkout y SHA nuevo

```bash
git fetch origin
git ls-remote origin refs/heads/docs/T-387-ficha
git diff origin/develop...origin/docs/T-387-ficha --stat
git diff origin/develop...origin/docs/T-387-ficha -- docs/tasks/T-387.md docs/implementation-plan.md
git merge-tree --write-tree origin/develop origin/docs/T-387-ficha
pnpm exec vitest run tools/verify-fichas.test.ts
node /tmp/pr470-r1-check.cjs
node /tmp/pr470-r1-check.cjs --mutation-check
node docs/revision-pr/analizar.mjs verificacion
```

Para instalar el harness: copiar el bloque JavaScript íntegro a `/tmp/pr470-r1-check.cjs`. No declarar estos comandos ejecutados hasta obtener su salida real. No levantar Docker/Supabase local, no modificar CI ni adulterar pruebas. La implementación funcional y E2E de PDF pertenecen a otra PR después de mergear esta ficha.


---

## Ronda 2 — verificación de `f638abb48775f92293d01d5d15804ab84e46dbde` (ejecutada)

Se leyeron por **conector GitHub** los blobs de `docs/tasks/T-387.md` y `docs/implementation-plan.md` del SHA exacto de autor, más `vehicle-form.tsx` del mismo ref. En la sesión del revisor se evaluaron con JavaScript estos controles estáticos:

```javascript
const sec = (txt, title) => txt.match(new RegExp("## "+title+"\\n([\\s\\S]*?)(?=\\n## |$)"))?.[1] || "";
const row = plan.split("\n").find(l => /^\|\s*T-387\s*\|/.test(l));
const first = sec(task,"DoD").match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim();
const allowed = [...sec(task,"Archivos permitidos").matchAll(/`([^`]+)`/g)].map(m => m[1]);
const H01 = first === row.split("|")[6].trim();
const H02 = allowed.includes("src/features/courier-onboarding/components/vehicle-form.tsx")
  && /registro inicial|alta inicial/i.test(sec(task,"DoD")) && /handleOptionalUpload/.test(vehicle);
const H03 = allowed.length === 18 && allowed.every(x => !/[{}]/.test(x))
  && allowed.includes("src/features/courier-onboarding/components/document-upload-card.tsx")
  && allowed.includes("src/features/courier-onboarding/components/document-replacement-card.tsx");
const H04 = task.includes("10.485.760 bytes") && row.includes("10 MiB");
```

Donde `task`, `plan` y `vehicle` son los textos reales devueltos por GitHub para ese SHA, no fixtures inventados. **Resultados observados:** `H01=true`, `H02=true`, `H03=true`, `H04=true`, y `allowed.length=18`.

Mutaciones independientes en memoria con el **mismo oráculo** (sin tocar repo):
- H01: agregar «MUTACION» al primer DoD → `false / RED`.
- H02: quitar de `task` la entrada permitida `vehicle-form.tsx` → `false / RED`.
- H03: sustituir permiso literal por `components/{document-upload-card,document-replacement-card}.tsx` → `false / RED`.
- H04: cambiar `10 MiB` a `10 MB` en fila de plan → `false / RED`.

Estos resultados verifican **texto de especificación**, no conducta de aplicación. **No se ejecutó Vitest, Playwright ni CI en el entorno de la revisión** por falta de checkout y DNS. El arnés anterior en esta misma evidencia conserva la receta completa para reproducir la comprobación en un clon.

### H05 — comprobación adicional por enumeración de E2E

En `T-387.md:102-107` el listado E2E de registro inicial solo requiere que el selector ofrezca PDF. El E2E de perfil sí solicita subir PDF, auditoría y verificación. No hay un criterio E2E que haga el reemplazo PDF desde `DocumentReplacementCard mode=replace`, ni que envíe archivo inicial por `VehicleForm` y verifique Storage + DB. **H05 abierto por inspección**; no se presenta como falla ejecutada de un test. Su cierre exige especificar ambos recorridos y, en la futura implementación, mutaciones RED que ataquen realmente el tratamiento PDF.

Si se autoriza la nueva ronda, confirmar `git ls-remote origin refs/heads/docs/T-387-ficha`, no evaluar solo el SHA del commit del revisor, y ejecutar `node docs/revision-pr/analizar.mjs verificacion` con el checkout correcto.


---

## Ronda 3 — evidencia sobre el SHA del autor `5f4187c8b8267b93e289b4cd732e8ad67d947c92`

**Cambios frente a ronda 2:** solo la ficha agregando dos recorridos reales de PDF en la sección E2E. Se ejecutó independientemente un control JavaScript sobre texto de los blobs originales proporcionados por el conector GitHub: primer DoD = aceptación del plan, 18 permisos sin llaves (incluyendo VehicleForm), 10 MiB binarios, D01/D02 y los tres recorridos E2E. **Todos los booleanos de baseline observados fueron true.**

Se aplicaron seis mutaciones **en memoria** sobre el contenido de las viñetas E2E con el **mismo oráculo**, sin cambiar archivos ni debilitar tests: las seis fueron detectadas RED (quitar subida inicial, no-compresión inicial, estado final inicial, subida real de reemplazo, revocación de vigencia anterior, y camino de UI). La ejecución fue JavaScript en la sesión del revisor, no Vitest ni Playwright. No se corrieron E2E de funcionalidades que aún no existen en esta PR de documentación.

### Harness independiente completo, reproducible desde la raíz de un checkout

Guardar **fuera del repo** como `/tmp/pr470-r3-check.cjs`, sin tocar ningún archivo de trabajo. Ejecutar `node /tmp/pr470-r3-check.cjs` y después `node /tmp/pr470-r3-check.cjs --mutation-check`. El harness comprueba texto de especificación, nunca simula ser una prueba de runtime.

```javascript
const fs = require("node:fs");
const assert = require("node:assert/strict");
const task = fs.readFileSync("docs/tasks/T-387.md","utf8");
const plan = fs.readFileSync("docs/implementation-plan.md","utf8");
const section = (content, name) => content.match(new RegExp("## "+name+"\\n([\\s\\S]*?)(?=\\n## |$)"))?.[1] || "";
const dod = section(task,"DoD");
const planRow = plan.split("\n").find(l => /^\|\s*T-387\s*\|/.test(l));
const firstDoD = dod.match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim();
const allowed = [...section(task,"Archivos permitidos").matchAll(/`([^`]+)`/g)].map(m=>m[1]);
const e2e = dod.split("- [ ] **E2E en `courier-onboarding.spec.ts`:**")[1]?.split("\n- [ ]")[0] || "";
const getBullets = s => s.split(/(?=^  - )/m).map(x=>x.trim()).filter(x=>x.startsWith("- "));
function checkH05(section) {
 const bullets=getBullets(section);
 const initial=bullets.find(x=>x.includes("registro inicial")) || "";
 const replace=bullets.find(x=>x.includes("licencia rechazada")) || "";
 const profile=bullets.find(x=>x.includes("aprobado sin seguro")) || "";
 const initialOK=[
  "registro inicial","selector","licencia se sube como PDF real a Storage",
  "sin compresión","license_<ts>.pdf","documento vigente en revisión"
 ].every(x=>initial.includes(x));
 const replaceOK=[
  "licencia rechazada","reemplaza con un PDF desde la UI",
  "subida llega a Storage","sin compresión","documento nuevo queda `.pdf`, vigente y en revisión",
  "rechazado deja de ser el vigente"
 ].every(x=>replace.includes(x));
 const profileOK = profile.includes("sube un PDF desde el perfil y queda") &&
 section.includes("audit_log") && section.includes("MFA");
 return {initialOK,replaceOK,profileOK,all:initialOK&&replaceOK&&profileOK};
}
assert.equal(firstDoD,planRow.split("|")[6].trim(),"H01 no cumple el plan");
assert.equal(allowed.length,18,"Cantidad de permisos alterada");
assert(allowed.every(x=>!/[{}]/.test(x)),"H03 permisos no literales");
assert(allowed.includes("src/features/courier-onboarding/components/vehicle-form.tsx"),"H02 no habilita vehicle-form");
assert(task.includes("10.485.760 bytes") && planRow.includes("10 MiB"),"H04 límite ambiguo");
assert(task.includes("DNI, selfie y avatar siguen solo con fotos en la UI"),"D02 UI");
assert(task.includes("cualquier documento cuyo path guardado termine en `.pdf`"),"D02 visor");
const baseline=checkH05(e2e);
assert(baseline.all,JSON.stringify(baseline));
console.log("BASELINE H01-H05 GREEN: " + JSON.stringify(baseline));
if(process.argv.includes("--mutation-check")) {
 const mutations=[
  ["M01 quita upload inicial",e2e.replace("licencia se sube como PDF real a Storage","licencia se selecciona")],
  ["M02 quita no-compresión inicial",e2e.replace("sin compresión","")],
  ["M03 quita estado inicial",e2e.replace("documento vigente en revisión","documento sin verificar")],
  ["M04 quita subida reemplazo",e2e.replace("subida llega a Storage","selector ofrece")],
  ["M05 quita desvigencia anterior",e2e.replace("rechazado deja de ser el vigente","rechazado no se comprueba")],
  ["M06 quita uso de UI",e2e.replace("desde la UI","por API simulada")]
 ];
 for(const [name,s] of mutations){
  assert.notEqual(s,e2e, name+" mutación no aplicada");
  const red=!checkH05(s).all;
  console.log(name+" → "+(red?"RED observado":"CIEGA"));
  assert(red,name+" mutación ciega");
 }
}
```

**Salida esperada y observada en el oráculo independiente sobre los blobs del SHA revisado:** baseline H01-H05 GREEN y 6/6 mutaciones RED, sin mutaciones ciegas. **No afirmar que la ejecución de Node con checkout se realizó aquí**; solo el análisis y mutaciones JavaScript sobre texto GitHub se ejecutaron.

### CI oficial observado (HEAD `7eab0a5b`, que incluye `5f4187c8`)

- `unit` success: `Test Files 154 passed (154)`, `Tests 3110 passed (3110)` (del log del job).
- `db-tests` success: resumen final `Files=34, Tests=3019` / `Result: PASS`. El log incluye fases de mutación deliberada y su restauración; no confundir esos rojos esperados con el resultado final.
- `typecheck`, `lint`, `build`, `audit` success; `bundle-budget` success pero avisa que rutas existentes superan 180 kB (no regresión causada por estos docs).
- `approval-policy` failure: `Falta el informe completo de revisar-pr sin bloqueantes`. El workflow (`.github/workflows/approval-policy.mjs`) busca un reporte con todas las secciones bajo `### Informe de revisión de agy` **en el cuerpo del PR**, no solo en un comentario. El comentario de la ronda debe acompañarse de actualización del cuerpo, respetando autoría y sin tocar el código.

**Sin checkout,** no se ejecutaron `pnpm`, `git merge-tree` ni Playwright local. **No exigir otro CI verde completo solo por el commit que escribe esta ronda.**
