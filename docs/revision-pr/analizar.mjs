#!/usr/bin/env node
// Agrega los hallazgos de todas las PRs revisadas.
// Uso: node docs/revision-pr/analizar.mjs [patrones|checks|abiertos|regresiones|archivos|todo]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = dirname(fileURLToPath(import.meta.url));
const hallazgos = readdirSync(raiz, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith('pr-'))
  .map((d) => join(raiz, d.name, 'hallazgos.jsonl'))
  .filter(existsSync)
  .flatMap((f, i) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l, n) => {
        try {
          return JSON.parse(l);
        } catch {
          console.error(`! Linea ${n + 1} invalida en ${f}`);
          return null;
        }
      })
      .filter(Boolean)
  );

const cuenta = (campo) =>
  [...hallazgos.reduce((m, h) => m.set(h[campo], (m.get(h[campo]) ?? 0) + 1), new Map())]
    .sort((a, b) => b[1] - a[1]);

const vistas = {
  patrones: () => {
    console.log('\n# Patrones mas frecuentes (candidatos a regla)\n');
    for (const [p, n] of cuenta('patron')) console.log(`${String(n).padStart(3)}  ${p}`);
  },
  checks: () => {
    console.log('\n# Por que los checks no lo atajaron\n');
    for (const h of hallazgos) console.log(`${h.id}  ${h.por_que_paso_los_checks}`);
  },
  abiertos: () => {
    console.log('\n# Sin cerrar\n');
    for (const h of hallazgos.filter((x) => x.estado !== 'arreglado'))
      console.log(`${h.id}  [${h.estado}]  ${h.titulo}`);
  },
  regresiones: () => {
    console.log('\n# Regresiones (arreglos que rompieron otra cosa)\n');
    for (const h of hallazgos.filter((x) => /-R\d/.test(x.id))) console.log(`${h.id}  ${h.titulo}`);
  },
  archivos: () => {
    console.log('\n# Archivos que reinciden\n');
    for (const [a, n] of cuenta('archivo').filter(([, n]) => n > 1))
      console.log(`${String(n).padStart(3)}  ${a}`);
  },
};

const vista = process.argv[2] ?? 'todo';
console.log(`${hallazgos.length} hallazgos en ${new Set(hallazgos.map((h) => h.pr)).size} PR(s)`);
if (vista === 'todo') Object.values(vistas).forEach((f) => f());
else if (vistas[vista]) vistas[vista]();
else console.error(`Vista desconocida: ${vista}. Opciones: ${Object.keys(vistas).join(', ')}, todo`);
