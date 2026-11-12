# Evidencia reproducible — revisión independiente PR #709 / R1

**Head inspeccionado:** `68ed5ba928b1a62d3470949aafda44bae7539f59`. **Base:** `develop@dba3314f`. **Fecha:** 2026-11-12.

## Qué se comprobó (y qué NO)

- GitHub conector: PR abierta, un commit delante de develop; archivos: CC-050, ficha T-434, plan, log. Carpeta `pr-709` inexistente antes del commit del revisor.
- Base T-434: GitHub devuelve 404 (no existía en develop), por lo que no hay `git diff origin/develop -- docs/tasks/T-434.md` de una ficha anterior: es una ficha NUEVA.
- `src/.../cc044_admin_list_applicants.sql:84` excluye de la cola ordinaria `pending` con `application_submitted=false`; `src/features/admin/queries.ts:677` no permite motivo `courier_dni_released` y en línea 820 lo descarta; formulario `vehicle-form.tsx:1` es client; página `.../vehicle/page.tsx` no inyecta URL de soporte.
- Herramienta del revisor: **6/6 observaciones de contenido originales TRUE y 6/6 mutaciones puramente EN MEMORIA detectadas**. La ejecución fue en el runtime JS del conector con los contenidos recibidos de GitHub. Estos controles son ESTÁTICOS, no tests funcionales de SEC-09; no demuestran RED de la futura implementación.
- No hay clon GitHub accesible por DNS en contenedor (`Could not resolve host: github.com`). **No se ejecutó** pnpm, node analizar, git merge-tree, SQL, CI, ni se copiaron credenciales. Los 123 tests del autor siguen **no reproducidos** por esta revisión.
- Los mutantes NO se guardan ni se pushean. No hay `verificado_en_sha` de arreglos en este head.

## Harness COMPLETO de inspección (copiar a /tmp y ejecutar desde clone exacto)

La batería es **del revisor**; no reutiliza tests del autor. Comprueba hechos sobre la especificación y sobre el código base. Para repetir contra un clon del head original, **sin tocar archivos reales**:

```bash
cat > /tmp/pr709-r1-static.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.argv[2] || process.cwd();
const get = (p) => readFileSync(path.join(root, p), 'utf8');
const files = {
  queue: get('supabase/migrations/20261104200100_cc044_admin_list_applicants.sql'),
  queries: get('src/features/admin/queries.ts'),
  page: get('src/app/(courier)/courier/onboarding/vehicle/page.tsx'),
  form: get('src/features/courier-onboarding/components/vehicle-form.tsx'),
  cc: get('docs/contracts/CC-050.md'),
  task: get('docs/tasks/T-434.md'),
};

const guards = {
  pendingHidden: (f) =>
    f.queue.includes("(p_status <> 'pending' or c.application_submitted)"),
  releaseReasonInvisible: (f) => {
    const section = f.queries.match(/const AUDIT_REASON_ACTIONS:[\s\S]*?new Set\(\[([\s\S]*?)\]\)/)?.[1];
    return !!section && !section.includes("'courier_dni_released'");
  },
  noSupportPropAtServerPage: (f) =>
    f.page.includes('<VehicleForm') && !f.page.includes('supportWhatsAppHref'),
  noSupportHrefInClientForm: (f) =>
    f.form.startsWith("'use client';") && !f.form.includes('supportWhatsAppHref'),
  missingFiveFailedFinalizeDoD: (f) =>
    !f.task.includes('cinco errores DNI_ALREADY_REGISTERED'),
  claimsTwoFilesToCompare: (f) =>
    f.cc.includes('compara las fotos de los dos postulantes'),
};

for (const [name, guard] of Object.entries(guards)) {
  assert.equal(guard(files), true, 'control base falla: ' + name);
}
console.log('BASELINE 6/6 observaciones verdaderas (inspección estática)');

const mutants = [
  ['pendingHidden', (f) => ({...f,
    queue: f.queue.replace("(p_status <> 'pending' or c.application_submitted)",
      "(p_status <> 'pending' or true)")})],
  ['releaseReasonInvisible', (f) => ({...f,
    queries: f.queries.replace("'admin_reinstate_courier',",
      "'admin_reinstate_courier',\n  'courier_dni_released',")})],
  ['noSupportPropAtServerPage', (f) => ({...f,
    page: f.page.replace('<VehicleForm', '<VehicleForm supportWhatsAppHref={supportWhatsAppHref}')})],
  ['noSupportHrefInClientForm', (f) => ({...f,
    form: f.form.replace('const EMPTY_INITIAL_DOCS',
      'const supportWhatsAppHref = null;\nconst EMPTY_INITIAL_DOCS')})],
  ['missingFiveFailedFinalizeDoD', (f) => ({...f,
    task: f.task + '\n- cinco errores DNI_ALREADY_REGISTERED consumen cupo\n'})],
  ['claimsTwoFilesToCompare', (f) => ({...f,
    cc: f.cc.replace('compara las fotos de los dos postulantes', 'compara otra cosa')})],
];
let killed = 0;
for (const [name, mutate] of mutants) {
  const changed = mutate(files); // Solamente strings en memoria; originales intactos.
  const caught = guards[name](files) === true && guards[name](changed) === false;
  assert.equal(caught, true, 'mutación CIEGA: ' + name);
  killed++;
}
console.log('MUTACIONES EN MEMORIA: ' + killed + '/6 detectadas');
console.log('NOTA: no demuestra ningún caso RED funcional; solo sensibilidad de observaciones estáticas.');
NODE
node /tmp/pr709-r1-static.mjs "$PWD"
```

Si el archivo es copiado a `/tmp` y ejecutado con el argumento del repo (`"$PWD"`), no modifica el clone. Se debe correr SOBRE `68ed5ba9`: los guards del script detectan los defectos originales, por lo que varios dejarán de ser verdaderos después de que se corrija la ficha. No reutilizarlo como test de aprobación de la futura implementación.

## Comandos de repo pendientes para quien tenga clon

```bash
git fetch origin
git ls-remote origin refs/heads/feat/T-434-sec09-dni-oracle
git diff origin/develop...origin/feat/T-434-sec09-dni-oracle --stat
git log --oneline -- docs/revision-pr/pr-709/
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run tools > /tmp/pr709-tools.log 2>&1
grep -E 'Test Files|Tests|passed|failed' /tmp/pr709-tools.log | tail -10
```

**NO** lanzar Docker/Supabase local, no ejecutar comandos de Supabase/Vercel remotos, no tocar env/secretos. Si la PR mantiene bloqueantes, CI solo se menciona como no revisado; NO afirmar que está verde.

## Tests y mutaciones RED→GREEN para la futura PR de implementación, NO ejecutados en R1

- M01: 5 `DNI_ALREADY_REGISTERED` con documentación válida, consumo confirmado, sexto `RATE_LIMITED` sin finalize. Mutación: omitir consumo cuando finalize falla; el mismo test debe ponerse rojo.
- M02: límite real 5 por cuenta/ventana; mutación umbral 6, 6ª rechazada falla en pgTAP.
- M03: ADMIN aal1 / courier / anon no pueden buscar candidatos ni liberar; mutación quitar `assert_admin_aal2`, pgTAP debe ir rojo.
- M04: búsqueda de disputa recupera `pending/application_submitted=false` con docs, sin exponer `dni_hmac`; mutación quitar filtro o incluir hash en JSON, pgTAP rojo.
- M05: `courier_dni_released` expone etiqueta, cambio y motivo en UI; mutación quitar evento de `AUDIT_REASON_ACTIONS`, Vitest rojo.
- M06: motivo `null`, espacios, 2 y 501 => `VALIDATION_ERROR`, sin update/audit; 3/500 aceptados. Mutación quitar `btrim` y otra ampliar límite; pgTAP rojo.
- M07: reinstate después de liberar no aprueba; mutación eliminar guarda, pgTAP rojo.
- M08: número WhatsApp inválido => href null y texto de indisponibilidad; válido => enlace al soporte sin DNI; mutación omitir prop al formulario, test SSR/UI rojo.
- M09: dos liberaciones dejan un audit; mutación quitar guarda de `dni_hmac is not null`, falla la aserción de contador.
- M10: dos consumos simultáneos conservan conteo sin overflow aceptado. Mutación convertir upsert atómico a `select`/`update` separados, test de concurrencia rojo.

**Condición para certificar:** en la segunda ronda reproducir las salidas de test y CI exact-head, examinar mocks y resultado del caso semántico, no copiar «esperado rojo» de bitácora. Nunca inventar `Tests failed`.
