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

# Ronda 2 — SHA `4fb89bc79817650f747c2b12669687585ee526ec`

## Revalidación H01–H09

- compare `develop...head`: behind_by=0; ficha T-317 mismo blob SHA en ambos refs.
- Harness independiente: secreto TOTP ausente; writer recibe `<svg`; raw/base64 rechazados; cliente con 3 flags; signOut local; errores de list/unenroll fail-closed; throw post-QR borra QR y cierra sesión.

## H10 — cleanup no aislado

```js
const t = setup({ removeThrows: true });
await assert.rejects(() => enrollAdminMfa(t.deps));
assert.deepEqual(t.signOutArgs, [[{ scope: 'local' }]]);
```
Resultado actual: `signOutArgs=[]`. El rechazo de `removeFile` corta el segundo cleanup.

Mutación/control para el arreglo: volver temporalmente de `try { remove } finally { signOut }` a dos `await` secuenciales; el test debe quedar RED.

## H11 — error/end de TTY

```js
const pending = readSecret({ input: fakeTty, output, question: 'Contraseña: ' });
fakeTty.emit('error', new Error('stdin-failure'));
await assert.rejects(() => pending);
assert.equal(fakeTty.isRaw, false);
assert.equal(fakeTty.listenerCount('data'), 0);
assert.equal(fakeTty.listenerCount('error'), 0);
assert.equal(fakeTty.listenerCount('end'), 0);
```
Resultado actual: `error` deja raw=true y lanza fuera de la Promise; `end` deja raw=true con la Promise pendiente.

Mutación/control: quitar solo los handlers `error/end` del arreglo; ambos tests deben quedar RED.

## H12 — cuerpo no SVG

```js
assert.throws(() => qrSvgFromDataUri('data:image/svg+xml;utf-8,not-svg'));
```
Resultado actual: devuelve `not-svg`.

Mutación/control: quitar solo la guarda `svgXml.startsWith('<svg')`; el test debe quedar RED.

## Batería de Ronda 3

```bash
pnpm exec vitest run tools/admin-mfa-enroll.test.ts
pnpm exec eslint tools/admin-mfa-enroll.mjs --max-warnings 0
pnpm typecheck
pnpm lint
pnpm test
git diff origin/develop -- docs/tasks/T-317.md
git diff --name-only origin/develop...HEAD
git status --short
```
