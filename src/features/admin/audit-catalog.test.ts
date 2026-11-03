import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ADMIN_COPY } from './copy';

/**
 * T-400: cada `action` y cada `target_type` que las migraciones escriben en `audit_log` tiene etiqueta.
 * La fuente de verdad son las migraciones, no una lista a mano.
 */

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

/**
 * Valores dinámicos con dominio acotado. Cada uno declara el archivo donde está su dominio vigente.
 * `report_incident` también pasa por `p_action`, pero vuelve antes de escribir la auditoría.
 */
const DYNAMIC_VALUES: Record<
  string,
  { readonly source: string; readonly values: readonly string[] }
> = {
  p_action: {
    source: '20261017090000_t369_publication_credits.sql',
    values: [
      'publish_request',
      'republish_request',
      'cancel_request',
      'mark_picked_up',
      'mark_delivered',
      'report_no_show',
      'courier_cancel_match',
    ],
  },
};

const INSERT_HEADER =
  /insert\s+into\s+(?:public\.)?audit_log\s*\(\s*actor_id\s*,\s*action\s*,\s*target_type\s*,/gi;

/** Las tres primeras expresiones de primer nivel después de `values (` o `select`. */
function leadingExpressions(sql: string, from: number): string[] {
  const rest = sql.slice(from);
  const start = /\)\s*(values\s*\(|select\s)/i.exec(rest);
  if (!start) return [];
  const items: string[] = [];
  let depth = 0;
  let current = '';
  let quoted = false;
  for (const char of rest.slice(start.index + start[0].length)) {
    if (char === "'") quoted = !quoted;
    if (!quoted && char === '(') depth += 1;
    if (!quoted && char === ')') {
      if (depth === 0) break;
      depth -= 1;
    }
    if (!quoted && depth === 0 && char === ',') {
      items.push(current.trim());
      current = '';
      if (items.length === 3) break;
      continue;
    }
    current += char;
  }
  return items;
}

function resolve(expression: string, file: string): readonly string[] {
  const literal = /^'([a-z_]+)'$/.exec(expression);
  if (literal?.[1]) return [literal[1]];
  const dynamic = DYNAMIC_VALUES[expression];
  if (dynamic) return dynamic.values;
  throw new Error(`${file}: valor no reconocido en una escritura a audit_log: ${expression}`);
}

function collectCatalog() {
  const actions = new Map<string, string>();
  const targetTypes = new Map<string, string>();
  let writes = 0;
  for (const file of fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const anyInsert = sql.match(/insert\s+into\s+(?:public\.)?audit_log\b/gi)?.length ?? 0;
    const headers = [...sql.matchAll(INSERT_HEADER)];
    if (headers.length !== anyInsert) {
      throw new Error(
        `${file}: una escritura a audit_log no empieza por (actor_id, action, target_type, ...)`
      );
    }
    for (const header of headers) {
      const [, action, targetType] = leadingExpressions(sql, header.index + header[0].length);
      if (!action || !targetType)
        throw new Error(`${file}: no se pudo leer la escritura a audit_log`);
      for (const value of resolve(action, file)) actions.set(value, file);
      for (const value of resolve(targetType, file)) targetTypes.set(value, file);
      writes += 1;
    }
  }
  return { actions, targetTypes, writes };
}

describe('T-400: catálogo de acciones y entidades de audit_log', () => {
  const catalog = collectCatalog();

  it('encuentra las escrituras de las migraciones', () => {
    expect(catalog.writes).toBeGreaterThan(30);
    expect([...catalog.actions.keys()]).toEqual(
      expect.arrayContaining(['admin_decide_courier', 'admin_reinstate_courier', 'expired'])
    );
  });

  it('cada acción tiene etiqueta', () => {
    const missing = [...catalog.actions]
      .filter(([action]) => !Object.prototype.hasOwnProperty.call(ADMIN_COPY.audit.actions, action))
      .map(([action, file]) => `${action} (${file})`);
    expect(missing).toEqual([]);
  });

  it('cada tipo de entidad tiene etiqueta', () => {
    const missing = [...catalog.targetTypes]
      .filter(([type]) => !Object.prototype.hasOwnProperty.call(ADMIN_COPY.audit.entities, type))
      .map(([type, file]) => `${type} (${file})`);
    expect(missing).toEqual([]);
  });

  it('el dominio declarado de cada valor dinámico sigue en su archivo de origen', () => {
    for (const { source, values } of Object.values(DYNAMIC_VALUES)) {
      const sql = fs.readFileSync(path.join(migrationsDir, source), 'utf-8');
      for (const value of values) expect(sql, `${value} en ${source}`).toContain(`'${value}'`);
    }
  });
});
