/**
 * CC-031 — Pruebas multisesión de concurrencia y atomicidad para la inmutabilidad
 * de `display_name` en perfiles de repartidores (T-355 / CC-031).
 *
 * Verificaciones:
 *   - Escenario A: Dos sesiones del mismo repartidor. S1 actualiza teléfono y retiene el
 *     row lock; S2 intenta editar display_name. Se comprueba que S2 espera en pg_locks
 *     con wait_event_type = 'Lock'. Al commitear S1, S2 falla determinísticamente con 42501
 *     (COURIER_DISPLAY_NAME_IMMUTABLE), el nombre permanece intacto y el teléfono persiste.
 *   - Escenario B: Admin corrige display_name en S1 reteniendo row lock; repartidor edita
 *     teléfono en S2 esperando en lock. Tras el commit del admin, el repartidor persiste su
 *     teléfono sin revertir la corrección administrativa de identidad.
 *   - Escenario C: Admin revoca consentimiento a 'reconsent_required' en S1 con lock abierto;
 *     repartidor intenta editar teléfono en S2 esperando en lock. Tras el commit del admin,
 *     el filtro RLS (app_private.is_active_operational_actor) evalúa la fila bajo el snapshot
 *     committed y no realiza escrituras (0 filas actualizadas), preservando el estado legal.
 *   - Controles de mutación RED->GREEN:
 *     1. Concurrencia: deshabilitar la guarda permite a S2 sobrescribir display_name (RED confirmado);
 *        al restaurar el trigger, S2 vuelve a ser rechazado (GREEN restaurado).
 *     2. pgTAP (H01): ejecución del oráculo original contra la BD efímera de CI:
 *        baseline GREEN (exit 0) -> mutación con trigger deshabilitado (exit != 0, falla específica en
 *        «GREEN: direct courier name update rejected») -> restauración en finally y GREEN (exit 0).
 */

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';

const TAG = '[CC-031]';
const dbContainer = process.env.DB_CONTAINER;
if (!dbContainer) {
  console.error(`${TAG} ERROR: La variable de entorno DB_CONTAINER no está definida.`);
  process.exit(1);
}

const LOCK_WAIT_TIMEOUT_MS = Number(process.env.LOCK_TIMEOUT_MS) || 15_000;
const SESSION_SETUP = "set statement_timeout = '30s'; set lock_timeout = '25s';";
const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const PGTAP_SUITE = 'supabase/tests/cc031_courier_display_name_guard.sql';

function psqlArgs(extra = []) {
  return [
    'exec',
    '-i',
    dbContainer,
    'psql',
    '-X',
    '-q',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    'postgres',
    ...extra,
  ];
}

function runSql(sql) {
  const res = spawnSync('docker', psqlArgs(['-t', '-A']), {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`${TAG} SQL error (exit ${res.status}): ${res.stderr || res.stdout}\nSQL: ${sql.slice(0, 400)}`);
  }
  return res.stdout.trim();
}

class PsqlSession {
  constructor(label) {
    this.label = label;
    this.output = '';
    this.exited = false;
    this.pid = null;
    this.proc = spawn(
      'docker',
      ['exec', '-i', dbContainer, 'psql', '-X', '-U', 'postgres', '-d', 'postgres'],
      { stdio: ['pipe', 'pipe', 'pipe'] }
    );
    this.proc.stdout.on('data', (d) => (this.output += d.toString('utf8')));
    this.proc.stderr.on('data', (d) => (this.output += d.toString('utf8')));
    this.proc.on('exit', () => (this.exited = true));
  }

  send(label, sql) {
    const outputStart = this.output.length;
    const marker = `CC031_${label}_DONE`;
    this.proc.stdin.write(`\\set VERBOSITY verbose\n${sql.trim()}\n\\echo ${marker}\n`);
    return { outputStart, marker };
  }

  async waitFor(marker, timeoutMs = LOCK_WAIT_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const isMatch = typeof marker === 'string' ? this.output.includes(marker) : marker.test(this.output);
      if (isMatch) return this.output;
      if (this.exited) {
        throw new Error(`${TAG}[${this.label}] psql terminó inesperadamente esperando ${marker}. Salida:\n${this.output}`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${TAG}[${this.label}] Timeout esperando ${marker}. Salida:\n${this.output}`);
  }

  async wait({ outputStart, marker }, timeoutMs = LOCK_WAIT_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const slice = this.output.slice(outputStart);
      if (slice.includes(marker)) return slice;
      if (this.exited) {
        throw new Error(`${TAG}[${this.label}] psql terminó antes de ${marker}. Salida:\n${slice}`);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`${TAG}[${this.label}] Timeout esperando ${marker}. Salida:\n${this.output.slice(outputStart)}`);
  }

  async run(label, sql) {
    const out = await this.wait(this.send(label, sql));
    if (/(^|\n)ERROR:/.test(out)) {
      throw new Error(`${TAG}[${this.label}] SQL falló en ${label}:\n${out}`);
    }
    return out;
  }

  async init() {
    this.send('INIT', `${SESSION_SETUP}\nselect 'PID:' || pg_backend_pid() || ':ENDPID';`);
    await this.waitFor(/PID:\d+:ENDPID/);
    this.pid = Number(this.output.match(/PID:(\d+):ENDPID/)[1]);
    return this;
  }

  /**
   * Confirma determinísticamente que esta sesión está bloqueada esperando un row lock
   * no concedido (not l.granted) y con wait_event_type = 'Lock' en pg_stat_activity.
   */
  async assertBlocked(pending, queryMarker, timeoutMs = LOCK_WAIT_TIMEOUT_MS) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      assert.ok(
        !this.output.slice(pending.outputStart).includes(pending.marker),
        `${TAG}[${this.label}] la sentencia terminó prematuramente en vez de esperar el lock`
      );
      const waiting = Number(
        runSql(`
          select count(*)
          from pg_locks l
          join pg_stat_activity a on l.pid = a.pid
          where l.pid = ${this.pid}
            and not l.granted
            and a.wait_event_type = 'Lock'
            and a.query like '%${queryMarker}%';
        `)
      );
      if (waiting > 0) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(
      `${TAG}[${this.label}] Timeout esperando que pid ${this.pid} quede bloqueado en lock para "${queryMarker}". Salida actual:\n${this.output.slice(pending.outputStart)}`
    );
  }

  close() {
    try {
      this.proc.stdin.end();
      this.proc.kill('SIGTERM');
    } catch {
      // Ignorar fallas al cerrar proceso ya finalizado
    }
  }
}

async function withSessions(fn) {
  const s1 = await new PsqlSession('S1').init();
  const s2 = await new PsqlSession('S2').init();
  try {
    await fn(s1, s2);
  } finally {
    s1.close();
    s2.close();
  }
}

/** Escenario A: Dos sesiones de courier; S1 escribe teléfono con lock abierto, S2 intenta display_name. */
async function scenarioA(courierId, { expectGuard = true } = {}) {
  console.log(`${TAG} Escenario A (expectGuard=${expectGuard}): S1 teléfono vs S2 nombre prohibido...`);
  runSql(`
    update public.profiles
    set display_name = 'Original Name', phone = '3865000001', consent_status = 'active', role = 'courier'
    where id = '${courierId}';
  `);

  let s2Output = '';
  await withSessions(async (s1, s2) => {
    // S1: Begin TX, update phone, retiene row lock
    await s1.run('A_S1_PHONE', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal1"}', true);
      update public.profiles set phone = '3865000002' where id = '${courierId}';
    `);

    // S2: Begin TX, intenta cambio prohibido de display_name (se bloquea en el row lock de S1)
    const pendingS2 = s2.send('A_S2_NAME', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal1"}', true);
      update public.profiles set display_name = 'Race forbidden' where id = '${courierId}';
      commit;
    `);

    // Verificar determinísticamente que S2 queda bloqueado esperando el lock
    await s2.assertBlocked(pendingS2, 'Race forbidden');

    // S1 commitea su transacción
    await s1.run('A_S1_COMMIT', 'commit;');

    // S2 se desbloquea y termina
    s2Output = await s2.wait(pendingS2);
  });

  const profile = runSql(`select display_name || '||' || phone from public.profiles where id = '${courierId}';`);
  const [displayName, phone] = profile.split('||');

  if (expectGuard) {
    assert.match(s2Output, /COURIER_DISPLAY_NAME_IMMUTABLE/, 'S2 debe fallar con COURIER_DISPLAY_NAME_IMMUTABLE');
    assert.match(s2Output, /42501/, 'S2 debe reportar SQLSTATE 42501');
    assert.equal(displayName, 'Original Name', 'display_name debe permanecer intacto tras el rechazo');
    assert.equal(phone, '3865000002', 'phone de S1 debe haber quedado persistido');
    console.log(`${TAG} Escenario A GREEN: bloqueo en lock verificado, 42501 obtenido, display_name intacto, teléfono persistido.`);
  } else {
    assert.doesNotMatch(s2Output, /ERROR:/, 'En mutación RED, S2 no debe encontrar error');
    assert.equal(displayName, 'Race forbidden', 'En mutación RED, display_name debió ser sobrescrito');
    console.log(`${TAG} Escenario A RED confirmado: sin trigger el courier sobrescribe display_name.`);
  }
}

/** Escenario B: Admin corrige nombre en S1 con lock abierto; courier edita teléfono en S2 esperando en lock. */
async function scenarioB(courierId, adminId) {
  console.log(`${TAG} Escenario B: S1 admin corrección nombre vs S2 courier teléfono...`);
  runSql(`
    update public.profiles
    set display_name = 'Original Name', phone = '3865000002', consent_status = 'active', role = 'courier'
    where id = '${courierId}';
  `);

  let s2Output = '';
  await withSessions(async (s1, s2) => {
    // S1 (admin): Begin TX, corrige nombre, retiene row lock
    await s1.run('B_S1_ADMIN', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${adminId}","role":"authenticated","aal":"aal2"}', true);
      update public.profiles set display_name = 'Admin Corrected' where id = '${courierId}';
    `);

    // S2 (courier): Begin TX, edita teléfono (se bloquea en el row lock de S1)
    const pendingS2 = s2.send('B_S2_COURIER', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal1"}', true);
      update public.profiles set phone = '3865000091' where id = '${courierId}';
      commit;
    `);

    // Verificar determinísticamente que S2 queda bloqueado esperando el lock
    await s2.assertBlocked(pendingS2, '3865000091');

    // S1 commitea la corrección administrativa
    await s1.run('B_S1_COMMIT', 'commit;');

    // S2 se desbloquea y termina
    s2Output = await s2.wait(pendingS2);
  });

  assert.doesNotMatch(s2Output, /ERROR:/, 'S2 no debe fallar tras la corrección administrativa');

  const profile = runSql(`select display_name || '||' || phone from public.profiles where id = '${courierId}';`);
  const [displayName, phone] = profile.split('||');

  assert.equal(displayName, 'Admin Corrected', 'display_name corregido por admin no debe ser revertido por courier');
  assert.equal(phone, '3865000091', 'phone actualizado por courier debe persistir');
  console.log(`${TAG} Escenario B GREEN: corrección administrativa preservada, teléfono actualizado por courier.`);
}

/** Escenario C: Admin revoca consentimiento en S1 con lock abierto; courier intenta editar teléfono en S2 esperando en lock. */
async function scenarioC(courierId, adminId) {
  console.log(`${TAG} Escenario C: S1 admin revoca consentimiento vs S2 courier teléfono...`);
  runSql(`
    update public.profiles
    set consent_status = 'active', phone = '3865000091', role = 'courier'
    where id = '${courierId}';
  `);

  let s2Output = '';
  await withSessions(async (s1, s2) => {
    // S1 (admin): Begin TX, revoca consentimiento a reconsent_required, retiene row lock
    await s1.run('C_S1_REVOKE', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${adminId}","role":"authenticated","aal":"aal2"}', true);
      update public.profiles set consent_status = 'reconsent_required' where id = '${courierId}';
    `);

    // S2 (courier): Begin TX, intenta actualizar teléfono (se bloquea en el row lock de S1)
    const pendingS2 = s2.send('C_S2_PHONE', `
      begin;
      set local role authenticated;
      select set_config('request.jwt.claims', '{"sub":"${courierId}","role":"authenticated","aal":"aal1"}', true);
      update public.profiles set phone = '3865000092' where id = '${courierId}';
      commit;
    `);

    // Verificar determinísticamente que S2 queda bloqueado esperando el lock
    await s2.assertBlocked(pendingS2, '3865000092');

    // S1 commitea la revocación de consentimiento
    await s1.run('C_S1_COMMIT', 'commit;');

    // S2 se desbloquea y termina
    s2Output = await s2.wait(pendingS2);
  });

  console.log(`${TAG} Escenario C S2 salida:\n${s2Output.trim()}`);
  // Comprobar resultado: o bien RLS rechaza la escritura bajo EPQ (42501 / policy violation) o bien actualiza 0 filas.
  // En cualquier caso, no debe escribir si el consentimiento ya no está vigente (sin escribir si no está vigente).
  assert.ok(
    /42501|violates row-level security policy|UPDATE 0/.test(s2Output),
    `S2 debe ser rechazado por RLS o no afectar filas tras revocación de consentimiento. Salida: ${s2Output}`
  );

  const profile = runSql(`select consent_status || '||' || phone from public.profiles where id = '${courierId}';`);
  const [consentStatus, phone] = profile.split('||');

  assert.equal(consentStatus, 'reconsent_required', 'consent_status debe persistir reconsent_required');
  assert.equal(phone, '3865000091', 'phone no debe haberse modificado tras revocación de consentimiento');
  console.log(
    `${TAG} Escenario C GREEN: consentimiento revocado por admin bloquea la escritura concurrente de teléfono (${s2Output.includes('42501') ? 'rechazo RLS 42501' : '0 filas actualizadas'}), estado persistido.`
  );
}

/** Ejecuta el harness pgTAP de mutación RED->GREEN (H01) sobre la suite unitaria original. */
function runPgTapHarness() {
  const H01_TAG = '[CC-031-H01]';
  console.log(`${H01_TAG} Ejecutando batería pgTAP RED->GREEN contra ${PGTAP_SUITE}...`);

  function execPgTap() {
    const res = spawnSync(pnpmCmd, ['supabase', 'test', 'db', PGTAP_SUITE], {
      encoding: 'utf8',
      shell: true,
      maxBuffer: 10 * 1024 * 1024,
    });
    const output = `${res.stdout || ''}\n${res.stderr || ''}`;
    const lines = output.split('\n').map((l) => l.trim());
    const summary = lines.filter((l) => /Files=|Tests=|Result:/.test(l)).slice(-3).join('\n');
    const failures = lines.filter((l) => l.includes('Failed test') || /^not ok/.test(l));
    return { status: res.status, output, summary, failures };
  }

  // 1. Baseline GREEN
  const baseline = execPgTap();
  console.log(`${H01_TAG} Baseline GREEN (exit ${baseline.status}):\n${baseline.summary}`);
  assert.equal(baseline.status, 0, `${H01_TAG} Baseline de pgTAP debe ser exit 0 PASS`);

  // 2. Mutated RED: deshabilitar trigger en BD efímera
  console.log(`${H01_TAG} Deshabilitando trigger guard_courier_display_name_update en BD efímera...`);
  runSql('alter table public.profiles disable trigger guard_courier_display_name_update;');
  let red;
  try {
    red = execPgTap();
    console.log(`${H01_TAG} Mutated RED (exit ${red.status}):\n${red.summary}`);
    console.log(`${H01_TAG} Fallas capturadas:\n${red.failures.join('\n')}`);
    assert.notEqual(red.status, 0, `${H01_TAG} Suite sin trigger debe fallar con exit no cero`);
    const expectedOracle = 'GREEN: direct courier name update rejected';
    assert.ok(
      red.failures.some((l) => l.includes(expectedOracle)),
      `${H01_TAG} Debe fallar específicamente la aserción de identidad: «${expectedOracle}»`
    );
    console.log(`${H01_TAG} RED GENUINO confirmado: falló la aserción «${expectedOracle}» con exit ${red.status}`);
  } finally {
    console.log(`${H01_TAG} Restaurando trigger guard_courier_display_name_update...`);
    runSql('alter table public.profiles enable trigger guard_courier_display_name_update;');
  }

  // 3. Restored GREEN
  const restored = execPgTap();
  console.log(`${H01_TAG} Restored GREEN (exit ${restored.status}):\n${restored.summary}`);
  assert.equal(restored.status, 0, `${H01_TAG} Suite restaurada debe ser exit 0 PASS`);
  console.log(`${H01_TAG} Verificación RED->GREEN pgTAP completada con éxito.`);

  return {
    baselineExit: baseline.status,
    baselineSummary: baseline.summary,
    redExit: red.status,
    redSummary: red.summary,
    failedAssertion: 'GREEN: direct courier name update rejected',
    restoredExit: restored.status,
    restoredSummary: restored.summary,
  };
}

async function main() {
  const courierId = crypto.randomUUID();
  const adminId = crypto.randomUUID();

  // Setup fixtures sintéticas en la base efímera
  // handle_new_user exige role in ('merchant', 'courier'); para admin creamos usuario merchant y actualizamos role a admin en profiles.
  runSql(`
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, raw_user_meta_data)
    values
      ('${courierId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'courier_${courierId}@cc031.test', 'pwd', '{"role":"courier"}'::jsonb),
      ('${adminId}', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin_${adminId}@cc031.test', 'pwd', '{"role":"merchant"}'::jsonb)
    on conflict (id) do nothing;

    update public.profiles
    set role = 'courier', consent_status = 'active', display_name = 'Original Name', phone = '3865000001'
    where id = '${courierId}';

    update public.profiles
    set role = 'admin', consent_status = 'active', display_name = 'Admin User', phone = '3865999999'
    where id = '${adminId}';

    update public.couriers
    set status = 'pending', available = false, vehicle_type = 'moto', vehicle_plate = 'CC31INT'
    where profile_id = '${courierId}';
  `);

  try {
    const isMutationOnly = process.argv.includes('--mutation-check');
    if (!isMutationOnly) {
      // 1. Escenarios de concurrencia GREEN
      await scenarioA(courierId, { expectGuard: true });
      await scenarioB(courierId, adminId);
      await scenarioC(courierId, adminId);
    }

    // 2. Control de mutación RED->GREEN de concurrencia
    console.log(`${TAG} Ejecutando control de mutación de concurrencia (RED->GREEN)...`);
    runSql('alter table public.profiles disable trigger guard_courier_display_name_update;');
    try {
      await scenarioA(courierId, { expectGuard: false });
    } finally {
      runSql('alter table public.profiles enable trigger guard_courier_display_name_update;');
    }
    await scenarioA(courierId, { expectGuard: true });
    console.log(`${TAG} Control de mutación de concurrencia GREEN restaurado.`);

    // 3. Control de mutación RED->GREEN de la suite pgTAP (H01)
    if (!process.argv.includes('--skip-pgtap')) {
      runPgTapHarness();
    }
  } finally {
    // Teardown de fixtures sintéticas
    runSql(`
      delete from public.audit_log where actor_id in ('${courierId}', '${adminId}');
      delete from public.merchants where profile_id in ('${courierId}', '${adminId}');
      delete from public.couriers where profile_id in ('${courierId}', '${adminId}');
      delete from public.profiles where id in ('${courierId}', '${adminId}');
      delete from auth.users where id in ('${courierId}', '${adminId}');
    `);
  }
}

main().catch((err) => {
  console.error(`${TAG} ERROR:`, err instanceof Error ? err.stack || err.message : String(err));
  process.exit(1);
});
