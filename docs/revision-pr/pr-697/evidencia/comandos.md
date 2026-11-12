# Evidencia y comandos reproducibles — PR #697 / Ronda 1

**Objeto:** revisión de documentos en `b9f0bb12` contra `develop@9dafedab`. No se corrió Supabase/Docker local o remoto, ni GitHub workflows manuales, ni endpoints push remotos.

## Consultas de fuente

- PR: https://github.com/cadeApp/cadeApp/pull/697
- Diff: https://github.com/cadeApp/cadeApp/pull/697/files
- SQL actual: `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:311-315` y `supabase/migrations/20261020123000_cc035_register_push_subscription.sql` en `9dafedab`.
- Emisor y tipo: `src/server/push/sender.ts:130-134, 250-262, 274-356` en `9dafedab`.
- Dependencia exacta: https://raw.githubusercontent.com/web-push-libs/web-push/v3.6.7/src/web-push-lib.js, líneas 205-207, 292-294, 329-330, 341-379. `httpsOptions.timeout` tiene semántica de timeout de socket, no límite de vida del request.

## Arnés completo de contraejemplos (independiente)

Se ejecutó con Node `v22.16.0`. Para repetir: copiá **solo** el bloque siguiente a `/tmp/cc049-counterexamples.mjs` y ejecutá `node /tmp/cc049-counterexamples.mjs`. Usa loopback 127.0.0.1, **no abre conexiones externas**. H01/H02 son modelos lógicos que muestran limitaciones de los tests prometidos; NO simulan PostgreSQL ni certifican seguridad de la implementación. H03 demuestra la semántica de timeout de `http(s).request`; no ejecuta el paquete `web-push`.

```js
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

// H01: contraejemplo lógico. No ejecuta PostgreSQL ni representa sus policies reales.
const acceptsDirectWrite = ({ grant, policy }) => grant && policy;
const deniedByRls = { grant: true, policy: false };
assert.equal(acceptsDirectWrite(deniedByRls), false);
console.log('H01: GREEN (bypass de escritura denegado incluso con grant restituido).');
assert.equal(deniedByRls.grant, true);
console.log('H01: RED del control de grants: authenticated conserva INSERT indebidamente.');

// H02: contraejemplo lógico. Repetir DELETE durante un test puede ocultar la ausencia del DELETE migratorio.
const migrationActuallyCleaned = false;
const rows = [{ endpoint: 'allowed', allowed: true }, { endpoint: 'invalid', allowed: false }];
const observedRows = migrationActuallyCleaned ? rows.filter(x=>x.allowed) : rows;
const afterTestOwnDelete = observedRows.filter(x => x.allowed);
assert.deepEqual(afterTestOwnDelete, [{ endpoint:'allowed', allowed:true }]);
assert.equal(migrationActuallyCleaned, false);
console.log('H02: GREEN del test de DELETE rehecho, aunque no haya limpieza en migración.');

// H03: comportamiento real de timeout de socket de Node, con servidor HTTP de loopback.
// HTTP en vez de HTTPS solo ilustra semántica de http(s).request({timeout}). No hay endpoint remoto.
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  let n = 0;
  const interval = setInterval(() => {
    res.write('.');
    if (++n === 18) { clearInterval(interval); res.end(); }
  }, 30);
  res.on('close', () => clearInterval(interval));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const address = server.address();
  assert(address && typeof address !== 'string');
  const t0 = performance.now();
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host:'127.0.0.1', port:address.port, timeout:110 }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy(new Error('Socket timeout')));
    req.on('error', reject);
    req.end();
  });
  const elapsed = Math.round(performance.now() - t0);
  assert.equal(status, 200);
  assert(elapsed > 300, 'el servidor alimentó el socket sin pausas mayores a timeout');
  console.log('H03: GREEN de socket timeout de 110 ms; respuesta duró ' + elapsed + ' ms (> 300 ms).');
} finally {
  server.close();
  await once(server, 'close');
}
```

### Salida observada

```text
H01: GREEN (bypass de escritura denegado incluso con grant restituido).
H01: RED del control de grants: authenticated conserva INSERT indebidamente.
H02: GREEN del test de DELETE rehecho, aunque no haya limpieza en migración.
H03: GREEN de socket timeout de 110 ms; respuesta duró 559 ms (> 300 ms).
```

*La duración de H03 depende del scheduler; no se exige exactamente 559 ms. La palabra RED en H01 es una **contradicción de un invariante lógico**, no el resultado de una ejecución pgTAP roja.*

## Controles a ejecutar al arreglar la PR documental (no ejecutados aquí)

```bash
git pull origin feat/T-432-sec07-push-hardening
git diff --check
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-432-sec07-push-hardening
```

## Experimentos requeridos en la futura PR de implementación (no ejecutados)

1. En `supabase/tests/cc049_push_subscriptions_hardening.sql`: asserts `has_table_privilege` de INSERT/UPDATE/ TRUNCATE para `authenticated` y `anon`. **Mutación RED-GRANT**: volver a conceder INSERT/UPDATE con RLS cerrada; deben fallar las aserciones de grants, no necesariamente el bypass.
2. En la misma suite: intentos directos por columna bajo `authenticated` con grants temporalmente abiertos y policy permisiva temporal para probar cada barrera (rollback al finalizar transacción). **Mutación RED-RLS**: restaurar policy write propia con grant presente; deben observarse escrituras reales y quedar en rojo casos de prohibición. No concluir a partir de solo `0 rows` sin comprobar estado persistido.
3. Con D5-C, la primera migración no tiene DELETE. Para demostrar preservación de históricos, usar base aislada/efímera presembrada **antes** de aplicar la migración y comparar **después**, sin ejecutar DELETE desde el test. Una suite post-migración sola no puede certificar esta propiedad del rollout. El inventario posterior de producción es lectura de conteos, no parte de esta revisión.
4. `src/server/push/push.test.ts`: mock de la petición HTTPS en la frontera de red, sin evitar la implementación productiva. **Mutación RED-DEADLINE**: quitar `request.destroy` o usar solo `timeout` de socket. Simular bytes cada pocos ms durante >5 s con reloj controlado; se exige destrucción de request y failureCount sin delete. **Mutación RED-REDIRECT**: aceptar 302 y seguir `Location: https://host-prohibido`; debe fallar el test.
5. `src/server/push/push.test.ts` y `src/app/api/push/send/route.test.ts`: caso bloqueado `{status:0,error:'ENDPOINT_NOT_ALLOWED'}` **sin propia clave** `endpoint` y caso permitido con `endpoint`. **Mutación RED-LEAK**: agregar `endpoint: sub.endpoint` al registro bloqueado; la aserción `Object.hasOwn(record, 'endpoint') === false` debe fallar.
6. Ensayos de matriz de host: usar variantes buenas y malas independientes para SQL, domain, fake, schema y emisor. **Mutación RED-PARSER**: comparación por `endsWith` o regex no anclada debe aceptar `fcm.googleapis.com.evil.example`; la suite debe detectarlo.

## Limitaciones de esta ronda

No hubo clon local ni dependencias para `pnpm`, y no se ejecutó `git merge-tree`. GitHub informó `mergeable:true`. La rama no había recibido cambios ajenos a `b9f0bb12` al tomar la foto. Los 123 tests que figuran en la PR son **declaración del autor**, no una verificación propia. No se inspeccionaron logs de CI; no se deben rellenar `verificado_en_sha` de hallazgos abiertos.
