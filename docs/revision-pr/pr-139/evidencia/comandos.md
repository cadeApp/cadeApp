# Comandos reproducibles — PR #139 / ronda 1

SHA revisado: 7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463.

> La sesión de revisión no pudo clonar GitHub por DNS. Las reproducciones runtime se hicieron contra el contenido exacto recuperado por el conector. En un checkout del SHA, ejecutar lo siguiente.

## H01 — target actual

~~~bash
git fetch origin
git rev-list --left-right --count origin/develop...HEAD
git diff origin/develop -- docs/tasks/T-317.md
~~~
En la ronda: 13 1.

## H02 — launcher

~~~bash
node -e "const p=require('./package.json'); if(p.scripts['admin:mfa-enroll'] !== 'node tools/admin-mfa-enroll.mjs') process.exit(1)"
~~~
Mutación RED: volver a agregar --env-file-if-exists=.env.local.

## H03/H04/H06/H07/H08 — harness independiente

Con cliente/prompt/writer inyectados, afirmar exactamente:

~~~js
assert.ok(!output.join('\n').includes(TOTP_SECRET));
assert.ok(writerArgs[0].startsWith('<svg'));
assert.ok(!writerArgs[0].startsWith('data:image/'));
assert.throws(() => qrSvgFromDataUri('<svg></svg>'));
assert.throws(() => qrSvgFromDataUri('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='));
assert.match(source, /detectSessionInUrl\s*:\s*false/);
assert.deepEqual(signOutArgs[0], [{ scope: 'local' }]);
const listError = setup({listResult:{data:null,error:{message:'network'}}});
await enrollAdminMfa(listError.deps);
assert.ok(!listError.calls.includes('enroll'));
const unenrollError = setup({
  listResult:{data:{all:[{id:'old',factor_type:'totp',status:'unverified'}],totp:[]},error:null},
  unenrollResult:{data:null,error:{message:'network'}}
});
await enrollAdminMfa(unenrollError.deps);
assert.ok(!unenrollError.calls.includes('enroll'));
~~~

Resultados sobre el SHA: H03 filtra el sentinel; H04 writer recibe data URL y raw SVG se acepta; H06 flag ausente; H07 signOutArgs=[[]]; H08 ambos errores continúan hasta enroll y terminan ok:true.

## H05 — no-TTY

~~~js
const fakeProcess = { stdin:{isTTY:false}, stdout:{write(){}} };
await assert.rejects(() => promptSecret('Contraseña: '));
~~~
Sobre el SHA revisado resolvió piped-password; el helper no contiene isTTY, setRawMode ni finally.

## H09 — mutación propia RED

Control: challengeAndVerify lanza después de writeQr; debe quedar removed=['/tmp/qr.svg'].

~~~js
try {
  ({ error: verifyError } = await client.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code }));
} catch (error) {
  qrFile = null; // MUTACIÓN: pierde la referencia solo en excepción
  throw error;
}
~~~
Control de revisión: removed=['/tmp/qr.svg']. Mutación: removed=[]. La suite del autor no contiene un mock MFA que lance/rechace en ese tramo.

## Batería final obligatoria tras arreglar

~~~bash
pnpm exec vitest run tools/admin-mfa-enroll.test.ts
pnpm exec eslint tools/admin-mfa-enroll.mjs --max-warnings 0
pnpm typecheck
pnpm lint
pnpm test
git diff origin/develop -- docs/tasks/T-317.md
git diff --name-only origin/develop...HEAD
git status --short
~~~

No crear tests falsos, no bajar aserciones, no modificar tests ajenos para conseguir verde y no tocar docs/revision-pr/** desde la sesión de arreglo.
