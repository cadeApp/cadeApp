#!/usr/bin/env node
// PR689 / ronda 2: harness ESTÁTICO de control del test CC-048.
// Requiere un checkout Git que incluya el commit de ronda 1 (47cd4655).
// No ejecuta PostgreSQL, no cambia archivos ni levanta Supabase/Docker.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const file = 'supabase/tests/cc048_merchant_draft_only.sql';
const oldSha = '47cd46552319f5865b3d901c11189671b389f77e';
const source = readFileSync(file, 'utf8');
const old = execFileSync('git', ['show', oldSha + ':' + file], { encoding: 'utf8' });

function check(sql) {
  assert.match(sql, /select\s+plan\(111\);/, 'plan 111');
  const halves = sql.split('-- 108-111.');
  assert.equal(halves.length, 2, 'sección exacta 108-111');
  const unchanged = halves[0].replace('select plan(111);', 'select plan(107);') +
    'select * from finish();\nrollback;\n';
  assert.equal(unchanged, old, 'tests 1-107 no modificados');
  const tail = halves[1];
  const match = tail.match(/do \$\$([\s\S]*?)\$\$;/i);
  assert.ok(match, 'bloque DO');
  const block = match[1];
  assert.match(block, /begin\s+begin\s+alter table public\.delivery_request_contacts disable trigger trg_lock_draft_contacts;/i, 'trigger deshabilitado');
  assert.match(block, /raise exception using errcode = 'U0048'/i, 'excepción de rollback');
  assert.match(block, /exception when sqlstate 'U0048' then\s+null;/i, 'catch exacto del rollback');
  assert.ok(block.lastIndexOf('insert into cc048_policy_probe') >
    block.indexOf('exception when sqlstate'), 'guardar resultados luego de revertir subtransacción');
  assert.equal((block.match(/pg_temp\.run\(pg_temp\.merchant\(\)/g) || []).length, 3,
    'tres probes como comercio titular');
  for (const fixture of ['req_published_nc', 'req_matched_nc', 'req_foreign_draft']) {
    assert.ok(block.includes('pg_temp.' + fixture + '()'), 'fixture ' + fixture);
  }
  assert.doesNotMatch(block, /select\s+(is|ok)\s*\(/i, 'sin TAP dentro de rollback');
  assert.equal((tail.match(/select is\(/g) || []).length, 4, 'cuatro aserciones');
  assert.ok(tail.indexOf('select is(') > tail.indexOf('$$;'), 'aserciones afuera');
  for (const label of ['published', 'matched', 'foreign']) {
    assert.ok(tail.includes("where label = '" + label + "'), '42501'"),
      'assert RLS 42501: ' + label);
  }
  assert.match(tail, /tgenabled::text[\s\S]*?'O', 'CC-048: el rollback/i, 'restauración trigger');
}
check(source);
console.log('GREEN: control original (plan 111, 107 previos intactos y cuatro probes)');

const cases = [
  ['plan alterado a 107', s => s.replace('select plan(111);', 'select plan(107);')],
  ['trigger sin deshabilitar', s => s.replace('disable trigger trg_lock_draft_contacts', 'enable trigger trg_lock_draft_contacts')],
  ['rollback desactivado', s => s.replace("raise exception using errcode = 'U0048'", "raise notice using errcode = 'U0048'")],
  ['fixture matched sustituida por draft', s => s.replace('format(v_insert, pg_temp.req_matched_nc()', 'format(v_insert, pg_temp.req_draft_nc()')],
  ['expectativa published falseada a 00000', s => s.replace("where label = 'published'), '42501'", "where label = 'published'), '00000'")],
  ['expectativa foreign debilitada', s => s.replace("where label = 'foreign'), '42501'", "where label = 'foreign'), '00000'")],
  ['trigger esperado deshabilitado', s => s.replace("'O', 'CC-048: el rollback", "'D', 'CC-048: el rollback")],
  ['actor del primer probe sustituido por ajeno', s => s.replace('v_published := pg_temp.run(pg_temp.merchant()', 'v_published := pg_temp.run(pg_temp.merchant_b()')],
  ['alteración de test 61 previo', s => s.replace('61-63. Contactos', '61-63. Otro caso')],
];
for (const [label, change] of cases) {
  const mutant = change(source);
  assert.notEqual(mutant, source, label + ': mutación sin efecto');
  assert.throws(() => check(mutant), undefined, label + ': mutación sobrevivió');
  console.log('RED: ' + label);
}
console.log(cases.length + '/' + cases.length + ' mutaciones de estructura detectadas; no DB ejecutada.');
