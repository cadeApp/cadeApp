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

# Ronda 3 — SHA `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1`

## Target y alcance

- `compare develop...head`: `behind_by=0`.
- `docs/tasks/T-317.md`: mismo blob SHA `2e1f5d68d2d6b33eb474d84bcfede5cd2cec1951` en develop y head.
- Desde `f6de2d5` solo cambiaron `tools/admin-mfa-enroll.mjs`, `tools/admin-mfa-enroll.test.ts` y `docs/tasks/log/T-317.md`.

## Revalidación H01–H12

Harness independiente sobre las funciones exactas del SHA:

- launcher exacto: `node tools/admin-mfa-enroll.mjs`;
- flujo feliz: `ok:true`;
- salida sin sentinelas de password/code/access/refresh/TOTP/otpauth;
- writer: `<svg></svg>`;
- raw SVG/base64: rechazados;
- no-TTY: `OperatorError`;
- Ctrl+C: `raw=false`, listeners data/error/end = 0;
- client auth flags: `false/false/false`;
- listFactors error: `FACTORS_UNAVAILABLE`, sin enroll;
- unenroll error: `CLEANUP_FAILED`, sin enroll;
- throw post-QR: QR eliminado + signOut local;
- removeFile throw: signOut local igualmente llamado;
- stdin error/end: `OperatorError`, raw restaurado, listeners 0;
- body `not-svg`: `QR_FORMAT`, sin writer.

## Mutaciones propias

Control: H10=true, H11=true, H12=true.

- H10 — reemplazar `try { remove } finally { signOut }` por dos awaits secuenciales: H10=false.
- H11 — quitar handlers/listener cleanup de `error/end`: H11=false.
- H12 — quitar `svgXml.startsWith('<svg')`: H12=false.

Las otras propiedades permanecieron true en cada mutación.

## CI exact-head

`bundle-budget=success, db-tests=success, audit=success, typecheck=success, lint=success, build=success, unit=success, approval-policy=failure, Supabase Preview=skipped`

Log de `unit`:
- `tools/admin-mfa-enroll.test.ts (30 tests)` ✅
- `Test Files 104 passed (104)`
- `Tests 1412 passed (1412)`
- `verify-workflows`: 29 tests
- `verify-adr`: 6 tests

Log de `approval-policy`:
`Falta el informe completo de revisar-pr sin bloqueantes.`

El workflow `.github/workflows/approval-policy.mjs` exige que la sección `### Informe de revisión de agy` del **cuerpo del PR** contenga el informe completo. Un comentario no satisface esa regla.

# Ronda 4 — SHA `d6fac40e01202c99f6db800e4057017ffee3c80c`

## Inmutabilidad funcional respecto de R3

Blobs comparados entre `6cfa41e` y `d6fac40e01202c99f6db800e4057017ffee3c80c`:

- `tools/admin-mfa-enroll.mjs`: `8d6456a10fae24735cfd65dc07412d167b67515a` en ambos.
- `tools/admin-mfa-enroll.test.ts`: `5c814898bea98bf4752cc9ff7399c2aa72314934` en ambos.
- `docs/runbooks/admin-bootstrap.md`: `c8d6ae667bc1ca92ebf206455cecab9eda734938` en ambos.
- `package.json` cambió por merges ajenos, pero `scripts["admin:mfa-enroll"]` sigue exactamente en `node tools/admin-mfa-enroll.mjs`.

Ficha T-317:
- head blob: `2e1f5d68d2d6b33eb474d84bcfede5cd2cec1951`
- develop blob: `2e1f5d68d2d6b33eb474d84bcfede5cd2cec1951`

## Divergencia actual

`compare develop...d6fac40e01202c99f6db800e4057017ffee3c80c`:
- behind_by=12
- ahead_by=10

Los 12 commits faltantes en la rama tocan solo T-318/PR143:
- docs/implementation-plan.md
- docs/tasks/T-318.md
- docs/revision-pr/pr-143/**

No modifican T-317 ni workflows.

## CI exact-head

Log de unit:
- `tools/admin-mfa-enroll.test.ts (30 tests)` ✅
- `Test Files 105 passed (105)`
- `Tests 1437 passed (1437)`
- verify-workflows: 31
- verify-adr: 6

Checks:
- bundle-budget success
- db-tests success
- build success
- audit success
- unit success
- typecheck success
- lint success
- approval-policy failure

Log de approval-policy:
`Falta el informe completo de revisar-pr sin bloqueantes.`

## Evidencia manual

La evidencia real de `cadeapp-staging` sigue pendiente. Un intento que no alcanza enrolamiento TOTP + login MFA + `/admin/applicants` con AAL2 no satisface el ítem del DoD.

# Rondas 5–6 — PR139-H13

- Staging: `mfa.enroll()` respondió, pero el parser devolvió `QR_FORMAT`.
- Fuente oficial revisada: Supabase JS 2.116 concatena `data:image/svg+xml;utf-8,` + SVG crudo; Supabase Auth usa SVGo.
- Reproducción independiente R6: real=true; raw/base64/wrong-prefix/not-svg/xml-without-svg=false.
- Mutación conceptual antigua `startsWith('<svg')`: false para el fixture real.
- CI checkout: `refs/pull/139/merge`, commit `d85ee4ac17921e46ca4d228fdfe8ef26b070116d` = `b9115b7e388a490e51461f5085fc5918a4bd6740` + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6`.
- Unit: 107 files / 1498 tests; enrolador 34/34.

# Ronda 7 — staging web

## H14

Lectura exacta del head:
- `loginAction` → `resolvePostLoginRedirect`;
- `resolvePostLoginRedirect` usa `getRoleDefaultPath(role)` como fallback;
- `getRoleDefaultPath('admin') === '/'`;
- `evaluateRouteGuard('/admin/applicants', admin aal1)` sí produce `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`.

Conclusión: la protección de rutas existe, pero el login directo de admin no entra en ese circuito.

## H15

Respuesta observada por DevTools en staging:
`{ok:false,code:'INTERNAL_ERROR'}`.

Código:
- `factorsError || !factors?.totp?.length` → INTERNAL_ERROR;
- `challengeError || !challenge` → INTERNAL_ERROR;
- `verifyError` → VALIDATION_ERROR.

Los tests de `verifyAdminMfaAction` cubren payload inválido y éxito, no los estados anteriores.
