import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const SW = 'src/server/cron/sweep.ts',
  RT = 'src/app/api/cron/sweep/route.ts';
const M = {
  'X00-control': [],
  'X01-positivo-sin-guarda-published': [
    [
      SW,
      ".in('id', expiredRequestIds)\n      .eq('status', 'published')",
      ".in('id', expiredRequestIds)",
    ],
  ],
  'X02-solicitud-a-cancelled': [
    [
      SW,
      ".update({ status: 'expired' })\n      .in('id', expiredRequestIds)",
      ".update({ status: 'cancelled' })\n      .in('id', expiredRequestIds)",
    ],
  ],
  'X03-ofertas-a-withdrawn': [
    [
      SW,
      ".update({ status: 'expired', decided_at: nowIso })",
      ".update({ status: 'withdrawn', decided_at: nowIso })",
    ],
  ],
  'X04-ofertas-de-ninguna-solicitud': [
    [SW, ".in('request_id', actuallyExpiredIds)", ".in('request_id', [])"],
  ],
  'X05-purged_at-null': [[SW, '.update({ purged_at: nowIso })', '.update({ purged_at: null })']],
  'X06-comercio-a-cancelled': [
    [
      SW,
      ".update({ subscription_status: 'expired' })",
      ".update({ subscription_status: 'cancelled' })",
    ],
  ],
  'X07-ignora-error-storage': [[SW, 'if (!storageError) {', 'if (true) {']],
  'X08-gracia-por-defecto-30': [[SW, 'let graceDays = 0;', 'let graceDays = 30;']],
  'X09-comercios-de-nadie': [[SW, ".in('profile_id', expiredProfileIds)", ".in('profile_id', [])"]],
  'X10-ruta-sin-chequeo-de-largo': [
    [RT, 'authHeaderBuf.length !== expectedAuthBuf.length ||\n    ', ''],
  ],
  'X11-ruta-500-con-detalle': [
    [
      RT,
      "} catch {\n    return NextResponse.json({ error: 'Internal Error' }, { status: 500 });",
      "} catch (e) {\n    return NextResponse.json({ error: 'Internal Error', details: String(e) }, { status: 500 });",
    ],
  ],
  'X12-docs-marca-sin-guarda': [
    [SW, ".in('id', docIds)\n        .is('purged_at', null)", ".in('id', docIds)"],
  ],
  'X13-reloj-corrido-3h': [
    [SW, 'now: nowDate,', 'now: new Date(nowDate.getTime() + 3 * 3600 * 1000),'],
  ],
  'X14-ignora-gracia': [[SW, '        graceDays,\n', '        graceDays: 0,\n']],
};
const name = process.argv[2];
if (!name || !(name in M)) {
  console.log(`Uso: node mut.mjs <nombre>. Opciones:\n${Object.keys(M).join('\n')}`);
  process.exit(1);
}
const orig = new Map([
  [SW, readFileSync(SW)],
  [RT, readFileSync(RT)],
]);
try {
  for (const [f, a, b] of M[name]) {
    const t = readFileSync(f, 'utf8');
    const isCrlf = t.includes('\r\n');
    const targetA = isCrlf ? a.replace(/\r?\n/g, '\r\n') : a;
    const targetB = isCrlf ? b.replace(/\r?\n/g, '\r\n') : b;
    const n = t.split(targetA).length - 1;
    if (n !== 1) {
      console.log(`${name}: SIN OBJETIVO (${n})`);
      process.exit(2);
    }
    writeFileSync(f, t.replace(targetA, targetB));
  }
  let out = '';
  try {
    out = execSync('pnpm exec vitest run --no-color src/server/cron src/app/api 2>&1', {
      encoding: 'utf8',
    });
  } catch (e) {
    out = e.stdout ?? String(e);
  }
  console.log(`${name}: ${(out.split('\n').find((l) => /^\s+Tests\s/.test(l)) ?? '?').trim()}`);
} finally {
  for (const [f, b] of orig) writeFileSync(f, b);
}
