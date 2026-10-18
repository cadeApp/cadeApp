/**
 * Controles de mutación SQL RED→GREEN de `admin_list_publication_plans` (T-369 / CC-029 addendum D01-B, revisión
 * PR #402 rondas 1 y 2, H04/H03). Lo ejecuta solo el job `db-tests` de CI contra la base PostgreSQL efímera del
 * stack local de Supabase.
 *
 * Para cada mutación:
 *   1. instala la regresión en la base efímera (función redefinida desde su `pg_get_functiondef` real o un grant de
 *      tabla) y comprueba que quedó instalada;
 *   2. corre la MISMA suite `supabase/tests/t369_publication_credits.sql`, sin cambios, y exige RED: psql termina bien
 *      (sin errores de sintaxis, conexión ni timeout), el plan tiene la misma cantidad de pruebas que el baseline,
 *      fallan todas las aserciones esperadas y ninguna fuera de D01-B;
 *   3. restaura la función o los permisos originales, verifica que quedaron idénticos (md5 de la definición o ACL de
 *      la tabla) y exige GREEN con la misma suite.
 * Si una mutación no produce RED, o el RED no es el esperado, el runner termina con código 1 y CI falla.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TAG = '[T369-D01B]';
const dbContainer = process.env.DB_CONTAINER;
const SUITE = 'supabase/tests/t369_publication_credits.sql';
const FUNCTION = 'public.admin_list_publication_plans(integer,integer,uuid,boolean)';

// Solo la base descartable de CI: contenedor local del stack de Supabase dentro de un runner de CI.
if (process.env.CI !== 'true' || !dbContainer || !/^supabase_db_/.test(dbContainer)) {
  console.error(`${TAG} ERROR: solo corre en CI contra el contenedor efímero supabase_db_* (CI=${process.env.CI}, DB_CONTAINER=${dbContainer}).`);
  process.exit(1);
}

function psql(sql, extra = []) {
  const res = spawnSync(
    'docker',
    ['exec', '-i', dbContainer, 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', ...extra],
    { input: sql, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 300_000 }
  );
  return { status: res.status, signal: res.signal, error: res.error, stdout: res.stdout ?? '', stderr: res.stderr ?? '' };
}

function runSql(sql) {
  const res = psql(sql, ['-t', '-A']);
  if (res.status !== 0) {
    throw new Error(`${TAG} SQL error (exit ${res.status}): ${res.stderr || res.stdout}\nSQL: ${sql.slice(0, 300)}`);
  }
  return res.stdout.trim();
}

const suiteSql = readFileSync(SUITE, 'utf8');

/** Corre la suite pgTAP tal cual y devuelve el resultado TAP; lanza si la corrida no fue válida. */
function runSuite(label) {
  const res = psql(suiteSql, ['-t', '-A']);
  if (res.error || res.signal) {
    throw new Error(`${TAG} ${label}: la corrida no terminó (${res.error ?? res.signal}); un timeout no cuenta como RED`);
  }
  if (res.status !== 0) {
    throw new Error(`${TAG} ${label}: psql falló (exit ${res.status}); un error SQL no cuenta como RED:\n${res.stderr.slice(-2000)}`);
  }
  if (/syntax error|could not connect|canceling statement|connection to server/i.test(res.stderr)) {
    throw new Error(`${TAG} ${label}: error de infraestructura en la corrida:\n${res.stderr.slice(-2000)}`);
  }
  const lines = res.stdout.split('\n').map((line) => line.trim());
  const plan = lines.find((line) => /^1\.\.\d+$/.test(line));
  if (!plan) throw new Error(`${TAG} ${label}: la suite no emitió el plan TAP (¿abortó?)`);
  const failed = lines
    .filter((line) => /^not ok \d+/.test(line))
    .map((line) => line.replace(/^not ok \d+ - /, ''));
  return { total: Number(plan.slice(3)), failed };
}

function functionMd5() {
  return runSql(`select md5(pg_get_functiondef('${FUNCTION}'::regprocedure));`);
}

function tableAcl() {
  return runSql(`select coalesce(relacl::text, '') from pg_class where oid = 'public.publication_plans'::regclass;`);
}

function replaceOnce(text, from, to, id) {
  const count = text.split(from).length - 1;
  if (count !== 1) throw new Error(`${TAG} ${id}: la mutación esperaba 1 aparición de «${from}» y encontró ${count}`);
  return text.replace(from, to);
}

const baseline = runSuite('baseline');
if (baseline.failed.length > 0) {
  throw new Error(`${TAG} baseline: la suite original debe estar GREEN antes de mutar:\n${baseline.failed.join('\n')}`);
}
console.log(`${TAG} baseline GREEN: ${baseline.total} pruebas, 0 fallas`);

const originalDef = runSql(`select pg_get_functiondef('${FUNCTION}'::regprocedure);`);
const originalMd5 = functionMd5();
const originalAcl = tableAcl();

const AUTHZ = [
  'D01-B: sin usuario autenticado da UNAUTHENTICATED',
  'D01-B: un comercio con AAL1 no lista el catálogo',
  'D01-B: un comercio con AAL2 tampoco lista el catálogo',
  'D01-B: un repartidor no lista el catálogo',
  'D01-B: el admin con AAL1 recibe AAL2_REQUIRED',
  'D01-B: la autorización se evalúa antes que el cursor (no filtra información por validación)',
];
const TABLE_BYPASS = [
  'D01-B: el admin con AAL2 no puede leer publication_plans directo',
  'D01-B: un comercio no puede leer publication_plans directo',
  'D01-B: publication_plans sigue con RLS y sin SELECT para anon/authenticated',
];
const PAGINATION = [
  'D01-B: 151 planes se recorren en páginas 50/50/50/1',
  'D01-B: el recorrido devuelve cada plan una vez, en orden (sort, id)',
  'D01-B: activeOnly recorre solo los activos, completos y en orden',
  'D01-B: con exactamente 50 filas restantes no hay nextCursor y la página sigue a la fila del cursor',
];

function redefine(id, replacements) {
  let mutated = originalDef;
  for (const [from, to] of replacements) mutated = replaceOnce(mutated, from, to, id);
  runSql(`${mutated};`);
  if (functionMd5() === originalMd5) throw new Error(`${TAG} ${id}: la mutación no quedó instalada`);
  return () => {
    runSql(`${originalDef};`);
    if (functionMd5() !== originalMd5) throw new Error(`${TAG} ${id}: la función no quedó idéntica a la original`);
  };
}

const MUTATIONS = [
  {
    id: 'M1 sin assert_admin_aal2()',
    expected: AUTHZ,
    apply: () => {
      const restore = redefine('M1', [['  perform app_private.assert_admin_aal2();\n', '']]);
      const def = runSql(`select pg_get_functiondef('${FUNCTION}'::regprocedure);`);
      if (def.includes('assert_admin_aal2')) throw new Error(`${TAG} M1: la guarda sigue instalada`);
      return restore;
    },
  },
  {
    id: 'M2 select de publication_plans concedido a authenticated',
    expected: TABLE_BYPASS,
    apply: () => {
      runSql('grant select on table public.publication_plans to authenticated;');
      if (runSql("select has_table_privilege('authenticated', 'public.publication_plans', 'select');") !== 't') {
        throw new Error(`${TAG} M2: el grant no quedó instalado`);
      }
      return () => {
        runSql('revoke select on table public.publication_plans from authenticated;');
        if (tableAcl() !== originalAcl) throw new Error(`${TAG} M2: los permisos de la tabla no quedaron como antes`);
      };
    },
  },
  {
    id: 'M3 sin el predicado del cursor',
    expected: PAGINATION,
    apply: () =>
      redefine('M3', [[
        '\n      and (p_after_sort is null or (pl.sort, pl.id) > (p_after_sort, p_after_id))',
        '',
      ]]),
  },
  {
    id: 'M3b cursor solo por sort (sin desempate por id)',
    expected: ['D01-B: 151 planes se recorren en páginas 50/50/50/1', 'D01-B: el recorrido devuelve cada plan una vez, en orden (sort, id)'],
    apply: () =>
      redefine('M3b', [[
        '(pl.sort, pl.id) > (p_after_sort, p_after_id)',
        'pl.sort > p_after_sort',
      ]]),
  },
];

let problems = 0;
for (const mutation of MUTATIONS) {
  const restore = mutation.apply();
  let red;
  try {
    red = runSuite(`${mutation.id} (mutado)`);
  } finally {
    restore();
  }
  const missing = mutation.expected.filter((name) => !red.failed.includes(name));
  const foreign = red.failed.filter((name) => !name.startsWith('D01-B: '));
  if (red.total !== baseline.total || red.failed.length === 0 || missing.length > 0 || foreign.length > 0) {
    problems += 1;
    console.error(
      `${TAG} ${mutation.id}: RED inválido (pruebas ${red.total}/${baseline.total}; faltan ${JSON.stringify(missing)}; ajenas ${JSON.stringify(foreign)}; fallas ${JSON.stringify(red.failed)})`
    );
  } else {
    console.log(`${TAG} ${mutation.id} RED: ${red.failed.length}/${red.total} fallas, todas de D01-B:\n  - ${red.failed.join('\n  - ')}`);
  }
  const green = runSuite(`${mutation.id} (restaurado)`);
  if (green.failed.length > 0 || green.total !== baseline.total) {
    problems += 1;
    console.error(`${TAG} ${mutation.id}: no volvió a GREEN tras restaurar: ${JSON.stringify(green.failed)}`);
  } else {
    console.log(`${TAG} ${mutation.id} GREEN tras restaurar: ${green.total} pruebas, 0 fallas`);
  }
}

if (functionMd5() !== originalMd5 || tableAcl() !== originalAcl) {
  console.error(`${TAG} la base no quedó con la función y los permisos originales`);
  process.exit(1);
}
if (problems > 0) {
  console.error(`${TAG} ${problems} control(es) de mutación fallaron`);
  process.exit(1);
}
console.log(`${TAG} TODOS LOS CONTROLES DE MUTACIÓN D01-B OK (${MUTATIONS.length}/${MUTATIONS.length})`);
