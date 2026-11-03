import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ADMIN_COPY } from './copy';

/**
 * T-400: cada `action` y cada `target_type` que las migraciones escriben en `audit_log` tiene etiqueta.
 * La fuente de verdad son las migraciones, no una lista a mano.
 */

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

interface DynamicValue {
  /** Función de las migraciones donde vive la escritura con este valor. */
  readonly fn: string;
  readonly values: readonly string[];
  /** Valores del dominio que nunca llegan a la auditoría, con el motivo. */
  readonly excluded: Readonly<Record<string, string>>;
}

/**
 * Valores dinámicos con dominio acotado. El dominio real se deriva del SQL (comparaciones en el cuerpo de la
 * función y literales con que la llaman) y tiene que coincidir exactamente con lo declarado acá.
 */
const DYNAMIC_VALUES: Record<string, DynamicValue> = {
  p_action: {
    fn: 'app_private.request_cycle',
    excluded: { report_incident: 'vuelve con el incidente creado antes de escribir audit_log' },
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

const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort()
  .map((name) => ({ name, sql: fs.readFileSync(path.join(migrationsDir, name), 'utf-8') }));

interface DynamicUse {
  readonly expression: string;
  readonly file: string;
  readonly sql: string;
  readonly index: number;
}

function collectCatalog() {
  const actions = new Map<string, string>();
  const targetTypes = new Map<string, string>();
  const dynamicUses: DynamicUse[] = [];
  let writes = 0;
  for (const { name: file, sql } of migrationFiles) {
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
      for (const expression of [action, targetType]) {
        if (DYNAMIC_VALUES[expression])
          dynamicUses.push({ expression, file, sql, index: header.index });
      }
      writes += 1;
    }
  }
  return { actions, targetTypes, dynamicUses, writes };
}

const FUNCTION_HEADER = /create\s+(?:or\s+replace\s+)?function\s+([a-z_][a-z0-9_.]*)\s*\(/gi;

/**
 * Función que contiene la escritura, su cuerpo (hasta el cierre `$$;`) y la posición de la escritura en él.
 */
function enclosingFunction(
  sql: string,
  index: number
): { name: string; body: string; writeAt: number } {
  const header = [...sql.matchAll(FUNCTION_HEADER)].filter((match) => match.index < index).pop();
  const end = sql.indexOf('$$;', index);
  if (!header?.[1] || end === -1) throw new Error('escritura dinámica fuera de una función');
  return {
    name: header[1].toLowerCase(),
    body: sql.slice(header.index, end),
    writeAt: index - header.index,
  };
}

function quotedLiterals(text: string): string[] {
  return [...text.matchAll(/'([a-z_]+)'/g)].flatMap((match) => (match[1] ? [match[1]] : []));
}

/** Valores con que el cuerpo compara la expresión (`=`, `<>`, `in (...)`). */
function comparedDomain(expression: string, body: string): Set<string> {
  const domain = new Set<string>();
  const compared = new RegExp(`\\b${expression}\\s*(?:=|<>|!=)\\s*'([a-z_]+)'`, 'gi');
  const listed = new RegExp(`\\b${expression}\\s+(?:not\\s+)?in\\s*\\(([^)]*)\\)`, 'gi');
  for (const match of body.matchAll(compared)) if (match[1]) domain.add(match[1]);
  for (const match of body.matchAll(listed)) {
    for (const value of quotedLiterals(match[1] ?? '')) domain.add(value);
  }
  return domain;
}

/** Literales con que las migraciones llaman a la función como primer argumento. */
function calledDomain(fn: string): Map<string, string> {
  const called = new RegExp(`${fn.replace('.', '\\.')}\\(\\s*'([a-z_]+)'`, 'gi');
  const domain = new Map<string, string>();
  for (const { name, sql } of migrationFiles) {
    for (const match of sql.matchAll(called)) if (match[1]) domain.set(match[1], name);
  }
  return domain;
}

/** `if <expr> = '<valor>' then ... return` antes de la escritura, dentro de esa misma rama del `if`. */
function returnsBeforeWrite(expression: string, value: string, body: string, writeAt: number) {
  const early = new RegExp(
    `\\bif\\s+${expression}\\s*=\\s*'${value}'\\s+then\\b(?:(?!\\b(?:end\\s+if|elsif|else)\\b)[\\s\\S])*?\\breturn\\b`,
    'i'
  ).exec(body);
  return early !== null && early.index + early[0].length < writeAt;
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

  it('el dominio declarado de cada valor dinámico coincide exactamente con el del SQL, archivo por archivo', () => {
    expect(catalog.dynamicUses.length).toBeGreaterThan(0);
    for (const [expression, declared] of Object.entries(DYNAMIC_VALUES)) {
      const expected = [...declared.values].sort();
      for (const use of catalog.dynamicUses.filter(
        (candidate) => candidate.expression === expression
      )) {
        const where = `${expression} en ${use.file}`;
        const fn = enclosingFunction(use.sql, use.index);
        expect(fn.name, where).toBe(declared.fn);

        const domain = comparedDomain(expression, fn.body);
        for (const value of Object.keys(declared.excluded)) {
          expect(
            returnsBeforeWrite(expression, value, fn.body, fn.writeAt),
            `${value} (${where})`
          ).toBe(true);
          domain.delete(value);
        }
        expect([...domain].sort(), where).toEqual(expected);
      }
    }
  });

  it('las llamadas a la función dinámica solo usan valores declarados', () => {
    for (const declared of Object.values(DYNAMIC_VALUES)) {
      const allowed = new Set([...declared.values, ...Object.keys(declared.excluded)]);
      const unknown = [...calledDomain(declared.fn)]
        .filter(([value]) => !allowed.has(value))
        .map(([value, file]) => `${value} (${file})`);
      expect(unknown).toEqual([]);
    }
  });
});
