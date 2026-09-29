import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';

const walk = (p, acc = []) => {
  if (!fs.existsSync(p)) return acc;
  const s = fs.statSync(p);
  if (s.isDirectory()) {
    if (/node_modules|revision-pr|el-consejo/.test(p)) return acc;
    for (const f of fs.readdirSync(p)) walk(path.join(p, f), acc);
  } else if (p.endsWith('.md')) acc.push(p);
  return acc;
};

const files = [...walk('docs'), ...walk('.agents'), 'AGENTS.md', 'supabase/AGENTS.md', 'src/domain/AGENTS.md', 'e2e/AGENTS.md'].filter((f) => fs.existsSync(f));

const rotos = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(/\[[^\]]*\]\(([^)\s#]+)(?:#[^)]*)?\)/g)) {
    const href = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(href)) continue; // http(s), mailto, file...
    const target = path.resolve(path.dirname(f), decodeURIComponent(href));
    if (!fs.existsSync(target)) rotos.push({ f: f.split(path.sep).join('/'), href });
  }
}

console.log('=== enlaces relativos rotos ===');
for (const r of rotos) {
  let origen = 'ARCHIVO-NUEVO-EN-ESTA-PR';
  try { cp.execSync(`git cat-file -e origin/develop:${r.f}`, { stdio: 'ignore' }); origen = 'archivo ya existia'; } catch {}
  console.log(`  ${r.f}  ->  ${r.href}   [${origen}]`);
}
console.log('total:', rotos.length);
