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
  verificacion: () => {
    console.log('');
    console.log('# Estado de verificacion');
    console.log('');
    const esArreglo = (h) => h.estado && h.estado.startsWith('arreglado');
    const verificados = hallazgos.filter((h) => esArreglo(h) && h.verificado_en_sha);
    const sinVerificar = hallazgos.filter((h) => esArreglo(h) && !h.verificado_en_sha);
    const aceptados = hallazgos.filter((h) => h.estado === 'aceptado');
    const pendientes = hallazgos.filter((h) => h.estado === 'decision-pendiente');
    const otros = hallazgos.filter(
      (h) => !esArreglo(h) && h.estado !== 'aceptado' && h.estado !== 'decision-pendiente'
    );
    console.log(`corregidos y VERIFICADOS ejecutando: ${verificados.length}`);
    console.log(`corregidos SIN verificar:            ${sinVerificar.length}`);
    console.log(`desvios ACEPTADOS por decision:      ${aceptados.length}`);
    console.log(`decisiones PENDIENTES:               ${pendientes.length}`);
    if (otros.length) console.log(`otros (parcial/abierto):             ${otros.length}`);
    if (sinVerificar.length) {
      console.log('');
      console.log('! Corregido pero NO verificado de forma independiente:');
      for (const h of sinVerificar) console.log(`  ${h.id}  ${h.titulo}`);
    }
    if (pendientes.length) {
      console.log('');
      console.log('> Requieren decision explicita:');
      for (const h of pendientes) console.log(`  ${h.id}  ${h.titulo}`);
    }
    if (otros.length) {
      console.log('');
      console.log('~ Sin cerrar:');
      for (const h of otros) console.log(`  ${h.id}  [${h.estado}]  ${h.titulo}`);
    }
    if (aceptados.length) {
      console.log('');
      console.log('= Desvios aceptados (decision, no verificacion tecnica):');
      for (const h of aceptados)
        console.log(`  ${h.id.padEnd(10)} ${h.verificado_en_sha}  ${h.verificado_metodo}`);
    }
    console.log('');
    console.log('Verificados ejecutando, con el SHA en que se comprobo:');
    for (const h of verificados)
      console.log(`  ${h.id.padEnd(10)} ${h.verificado_en_sha}  ${h.verificado_metodo}`);
  },
  origen: () => {
    console.log('');
    console.log('# Origen: culpa del agente o de la ficha?');
    console.log('');
    const prs = [...new Set(hallazgos.map((h) => h.pr))].sort();
    const et = { agente: 'AGENTE', ficha: 'FICHA ', ambos: 'AMBOS ' };
    console.log('PR      agente  ficha  ambos   % ficha');
    for (const pr of prs) {
      const g = hallazgos.filter((h) => h.pr === pr);
      const c = { agente: 0, ficha: 0, ambos: 0 };
      for (const h of g) if (c[h.origen] !== undefined) c[h.origen]++;
      const pct = Math.round(((c.ficha + c.ambos / 2) / g.length) * 100);
      console.log(
        `#${pr}    ${String(c.agente).padStart(5)} ${String(c.ficha).padStart(6)} ${String(c.ambos).padStart(6)}   ${String(pct).padStart(4)}%`
      );
    }
    const tot = { agente: 0, ficha: 0, ambos: 0 };
    for (const h of hallazgos) if (tot[h.origen] !== undefined) tot[h.origen]++;
    console.log(`TOTAL  ${String(tot.agente).padStart(5)} ${String(tot.ficha).padStart(6)} ${String(tot.ambos).padStart(6)}`);
    for (const tipo of ['ficha', 'ambos']) {
      const g = hallazgos.filter((h) => h.origen === tipo);
      if (!g.length) continue;
      console.log('');
      console.log(`## Atribuibles a la ficha o al plan (${tipo})`);
      for (const h of g) {
        console.log(`  ${h.id}  ${h.titulo}`);
        console.log(`            ${h.origen_motivo}`);
      }
    }
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
