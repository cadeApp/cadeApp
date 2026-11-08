# Evidencia y comandos reproducibles — PR #684 (9c7cb283)

## Control independiente (solo lectura de dos documentos)

Este harness usa la bitácora original de T-312 como fuente para los identificadores, además de una matriz independiente de issues, CC y urgencias aprobada en D1=A. Ejecutarlo desde la raíz del repo con Node.js. No usa Supabase, Docker ni red, no altera tests ni contenido. Copiable como archivo /tmp.

```bash
cat > /tmp/pr684-check.cjs <<'NODE'
#!/usr/bin/env node
// Ejecutar desde la raíz del repo; sin red, sin mutar archivos.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const original = fs.readFileSync('docs/tasks/log/T-312.md','utf8');
const doc = fs.readFileSync('docs/tasks/T-409.md','utf8');
const labels = ['SEC-06','SEC-07','SEC-08','SEC-09','SEC-12','CSP','B-05','B-06','B-09','A-08/B-07','C-07','C-08','A-07','A-09/C-04','C-05','B-08','D-05','D-04','D-06','D-07'];
const withCC = new Set(['SEC-06','SEC-07','SEC-09','SEC-12','B-05','B-06','B-09','A-08/B-07','C-07','C-08','A-07','A-09/C-04','C-05','B-08']);
const high = new Set(labels.slice(0,6));
const medium = new Set(['B-05','B-06','B-09','A-08/B-07','C-07','C-08','A-09/C-04','D-05']);
const section = original.split('### Recomendados antes de salir o en la primera semana (media)')[1].split('### Configuración de producción')[0];
const source = [];
for (const line of section.split('\n')) {
  if (/^\s*-\s+\*\*SEC-\d\d\*\*/.test(line)) source.push(line.match(/SEC-\d\d/)[0]);
  else if (/^\s*-\s+[ABCD]-\d\d/.test(line))
    source.push(...[...line.split(':')[0].matchAll(/\b[ABCD]-\d\d\b/g)].map(x=>x[0]));
}
const excluded = new Set(['SEC-10','SEC-11','D-10']);
const sourceScope = source.filter(x=>!excluded.has(x)).sort();
function verify(text) {
  const rows = [...text.matchAll(/^\|\s*([^|]+?)\s*\|\s*[^|]*\|\s*#(\d+)\s*\|\s*(sí|no)\s*\|\s*(Alta|Media|Baja)\s*\|$/gm)].map(x=>({id:x[1].trim(),n:Number(x[2]),cc:x[3],urg:x[4]}));
  assert.equal(rows.length,20,'20 filas de inventario');
  for(let i=0;i<20;i++) {
    const r=rows[i],id=labels[i];
    assert.equal(r.id,id,'fila '+(i+1));
    assert.equal(r.n,664+i,'issue de '+id);
    assert.equal(r.cc,withCC.has(id)?'sí':'no','CC de '+id);
    assert.equal(r.urg,high.has(id)?'Alta':medium.has(id)?'Media':'Baja','urgencia de '+id);
  }
  const covered=rows.flatMap(x=>x.id.split('/')).filter(x=>x!=='CSP').sort();
  assert.deepEqual(covered,sourceScope,'cobertura atómica de T-312');
  assert.match(text,/D-10[^]*T-392/,'D-10 excluido por T-392');
  assert.match(text,/D1=A/,'D1 elegido');
  assert.match(text,/D2=A/,'D2 elegido');
  assert.match(text,/SEC-12[^]*captura de Realtime/,'SEC-12 captura previa');
  return rows;
}
const rows=verify(doc);
console.log('GREEN: 20 filas, 21 IDs atómicos, 14 CC, 6 Alta, 8 Media, 6 Baja');
const mutations=[
  ['M01 omitir B-09', s=>s.replace(/^\| B-09 \|[^\n]*\n/m,'')],
  ['M02 cambiar CC SEC-09',s=>s.replace(/(\| SEC-09 \|[^\n]*\|\s*)sí(\s*\|)/,'$1no$2')],
  ['M03 cambiar urgencia A-07',s=>s.replace(/(\| A-07 \|[^\n]*\|\s*)Baja(\s*\|)/,'$1Media$2')],
  ['M04 duplicar issue D-04',s=>s.replace(/(\| D-04 \|[^\n]*\|\s*)#681/,'$1#682')],
];
for(const [name,alter] of mutations) {
  assert.notEqual(alter(doc),doc,'mutación sin objetivo '+name);
  assert.throws(()=>verify(alter(doc)),undefined,'mutación no detectada '+name);
  console.log('RED_CONFIRMED: '+name);
}
NODE
node /tmp/pr684-check.cjs
```

**Resultado de la revisión usando contenido obtenido de GitHub sobre 305a3c75 y 9c7cb283:** GREEN: 20 filas, 21 IDs atómicos, 14 CC, 6 Alta, 8 Media, 6 Baja. Las mutaciones independientes M01 a M04 se rechazaron (RED). Se ejecutó la lógica del validador en memoria sobre esos contenidos, sin crear un clon local del repositorio.

## Verificación remota de issues

Se consultaron individualmente los 20 issues #664–#683 por GitHub: todos abiertos, etiqueta P1, asignado Lautaro073 y urgencia coherente. Catorce tienen label contract-change y seis no. #669 confirmado abierto, tras corregir la colisión del título con T-391 en board-sync.

## Checks del proyecto pendientes/no ejecutados

```bash
# Ejecutables para quien tenga el clon y las dependencias instaladas:
node docs/revision-pr/analizar.mjs verificacion
pnpm typecheck
pnpm lint
pnpm test
# No correr la base local por esta revisión documental.
```

No se afirma haber ejecutado esos comandos en esta sesión. CI oficial del SHA 9c7cb283 estaba in_progress al consultar, approval-policy pendiente del informe, y Vercel omitió el preview para la PR documental. GitHub informó mergeable=true; **no** se ejecutó git merge-tree en un clon. Esta evidencia es de lectura y controles documentales, no de cierre de los defectos de seguridad inventariados.
