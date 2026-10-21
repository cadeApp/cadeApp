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
