import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Las fichas de `docs/tasks/T-xxx.md` son el único documento que el agente lee
 * para saber qué puede tocar. Si su DoD le exige escribir un archivo que sus
 * «Archivos permitidos» no listan, la ficha se contradice a sí misma y el
 * agente sólo puede desviarse o frenar.
 *
 * No es hipotético: el choque apareció en las tres primeras PR revisadas
 * (PR47-A01, PR48-A01, PR48-A02, PR49-A01) y frenó a T-003 antes de empezar.
 * 26 de las 27 fichas lo tenían.
 */

const DIR = 'docs/tasks';

type Ficha = {
  id: string;
  archivo: string;
  permitidos: string;
  dod: string;
};

function seccion(texto: string, titulo: string): string {
  const m = texto.match(new RegExp(`## ${titulo}\\n([\\s\\S]*?)(?:\\n## |$)`));
  return m?.[1] ?? '';
}

const fichas: Ficha[] = fs
  .readdirSync(DIR)
  .filter((f) => /^T-\d+\.md$/.test(f))
  .sort()
  .map((f) => {
    const texto = fs.readFileSync(path.join(DIR, f), 'utf-8').replace(/\r\n/g, '\n');
    return {
      id: f.replace('.md', ''),
      archivo: `${DIR}/${f}`,
      permitidos: seccion(texto, 'Archivos permitidos'),
      dod: seccion(texto, 'DoD'),
    };
  });

/** Un glob de la ficha cubre una ruta concreta. Sólo entiende `**` al final, que es lo que se usa. */
function permite(permitidos: string, ruta: string): boolean {
  const entradas = permitidos.match(/`([^`]+)`/g)?.map((s) => s.slice(1, -1)) ?? [];
  return entradas.some((e) => (e.endsWith('**') ? ruta.startsWith(e.slice(0, -2)) : e === ruta));
}

describe('Fichas de tarea: coherencia interna', () => {
  it('hay fichas para verificar', () => {
    expect(fichas.length).toBeGreaterThan(20);
  });

  it('toda ficha cuyo DoD exige la bitácora la lista en «Archivos permitidos»', () => {
    const rotas = fichas
      .filter((f) => f.dod.includes(`docs/tasks/log/${f.id}.md`))
      .filter((f) => !permite(f.permitidos, `docs/tasks/log/${f.id}.md`))
      .map((f) => f.id);

    expect(
      rotas,
      `El DoD de estas fichas exige la bitácora y sus «Archivos permitidos» no la incluyen, ` +
        `así que la skill tomar-tarea no puede crearla sin salirse de alcance: ${rotas.join(', ')}`
    ).toEqual([]);
  });

  it('ninguna entrada de «Archivos permitidos» deja backticks sin cerrar', () => {
    // Un backtick suelto desincroniza el emparejado y hace que las rutas
    // siguientes dejen de leerse como rutas. Había 6 entradas así.
    const rotas: string[] = [];
    for (const f of fichas) {
      for (const linea of f.permitidos.split('\n')) {
        if ((linea.match(/`/g) ?? []).length % 2 !== 0) rotas.push(`${f.id}: ${linea.trim()}`);
      }
    }

    expect(
      rotas,
      `Estas entradas tienen backticks sin cerrar y sus rutas no se leen bien:\n${rotas.join('\n')}`
    ).toEqual([]);
  });

  it('toda ficha se lista a sí misma en «Archivos permitidos»', () => {
    // El agente marca las casillas del DoD, que viven en la propia ficha.
    const rotas = fichas.filter((f) => !permite(f.permitidos, f.archivo)).map((f) => f.id);

    expect(
      rotas,
      `Estas fichas no se permiten a sí mismas, así que marcar el DoD sería un desvío: ${rotas.join(', ')}`
    ).toEqual([]);
  });
});

describe('Fichas de tarea: sincronía con el plan', () => {
  /**
   * Las fichas declaran estar «sincronizada con docs/implementation-plan.md §8».
   * Excepciones, todas de tareas ya mergeadas, que se dejan como están para no
   * reescribir el registro de un trabajo cerrado:
   *   T-000 — no tiene fila en la tabla §8.
   *   T-001 — su DoD se reescribió durante la tarea (PR #48).
   *   T-002 — su DoD se reformuló durante la tarea (PR #49).
   * Cualquier ficha nueva o no empezada entra al control.
   */
  const EXCEPCIONES = new Set(['T-000', 'T-001', 'T-002']);

  const plan = fs
    .readFileSync('docs/implementation-plan.md', 'utf-8')
    .replace(/\r\n/g, '\n')
    .split('\n');

  const dodDelPlan = new Map<string, string>();
  for (const linea of plan) {
    const m = linea.match(/^\|\s*(T-\d+)\s*\|/);
    if (!m) continue;
    const celdas = linea.split('|').map((s) => s.trim());
    const dod = celdas[6];
    const id = m[1];
    if (dod && id) dodDelPlan.set(id, dod);
  }

  it('el primer ítem del DoD de cada ficha coincide con su fila del plan', () => {
    const desincronizadas: string[] = [];

    for (const f of fichas) {
      if (EXCEPCIONES.has(f.id)) continue;
      const esperado = dodDelPlan.get(f.id);
      if (!esperado) continue;
      const m = f.dod.match(/^- \[[ x]\] (.*)$/m);
      if (m?.[1]?.trim() !== esperado) desincronizadas.push(f.id);
    }

    expect(
      desincronizadas,
      `El DoD de estas fichas no coincide con su fila de docs/implementation-plan.md. ` +
        `El agente trabaja desde la ficha: lo que sólo esté en el plan no se construye. ` +
        `Desincronizadas: ${desincronizadas.join(', ')}`
    ).toEqual([]);
  });
});
