# Evidencia de revisión PR #500 — ronda 1

**SHAs:** defecto `fdafd1b02be4369cd566f1acc10558a295aef3f9` → corregido `e343f3456f540bfdb8195edb57dbc3c171d3d7c8`.  
**Entorno:** inspección mediante GitHub y contraste de logs oficiales. No Supabase/Docker local ni base remota; no acceso `git clone` al repositorio desde contenedor.

## Harness independiente completo (solo Node, sin escrituras)

Ejecutar desde la raíz de un clon/worktree del SHA que se quiera verificar. Copiar íntegro a `/tmp`:

```bash
cat > /tmp/pr500-h01-check.mjs <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const m = readFileSync('supabase/tests/rls_matrix.sql', 'utf8');
const t = readFileSync('supabase/tests/cc036_offers_rpc_only.sql', 'utf8');
const case50 = m.match(/-- 50\. CC-036:[\s\S]*?(?=-- 51-55\.)/)?.[0] ?? '';
const fx = m.match(/-- Ofertas[\s\S]*?(?=-- Vincular oferta)/)?.[0] ?? '';
const tail = t.match(/-- 18-20\.[\s\S]*?(?=-- 21-23\.)/)?.[0] ?? '';
assert.ok(case50 && fx && tail, 'No se localizaron todas las zonas del test');
assert.match(fx, /'mensaje original c2', 'pending'/);
assert.match(case50, /select is\(\s*\(select message[\s\S]*?'mensaje original c2'/);
assert.doesNotMatch(case50, /select isnt\(/);
assert.match(tail, /select is\(\s*\(select eta_minutes[\s\S]*?\),\s*15,/);
assert.match(t, /select plan\(37\);/);
assert.match(m, /select plan\(67\);/);
// Mutaciones de estado in-memory independientes del autor:
const original = { message: 'mensaje original c2', eta_minutes: 15 };
const m1 = { ...original, message: 'mensaje adulterado' };
const m2 = { ...original, eta_minutes: 99 };
assert.equal(original.message === 'mensaje original c2', true);
assert.equal(m1.message === 'mensaje original c2', false, 'M01 debe quedar RED');
assert.equal(original.eta_minutes === 15, true);
assert.equal(m2.eta_minutes === 15, false, 'M02 debe quedar RED');
console.log('PASS: aserciones exactas en SQL; M01/M02 GREEN originales y RED mutados en memoria.');
console.log('NOTA: no equivale a ejecutar el pgTAP contra una base PostgreSQL.');
NODE
node /tmp/pr500-h01-check.mjs
```

La misma lógica fue comprobada por la revisión sobre contenido **leído directamente de GitHub@e343f34**: fixture y `is` exactos, `plan(37)` y `plan(67)`, ETA exacto, M01/M02 falsos tras mutación. No se afirma haber corrido `node /tmp/...` en un clon local inaccesible.

## Si hace falta verificar H01 en runtime real

En entorno autorizado, realizar la mutación **fuera de la rama productiva** (local temporal revertido; si `db-tests` solo corre en CI, PR aislada `review/T-390-h01-mutation` marcada `REVIEW ONLY / NEVER MERGE`).

- M01: inmediatamente antes del caso 50 de `rls_matrix.sql`, con rol `postgres`, alterar el mensaje de `offer_c2_id` a `'mensaje adulterado'`; regresar al contexto del repartidor. La aserción `is(..., 'mensaje original c2')` debe fallar; quitar la mutación y debe pasar.
- M02: inmediatamente antes de las aserciones 18–20 de `cc036_offers_rpc_only.sql`, como `postgres`, modificar `eta_minutes` de `offer_b_id` de 15 a 99. `is(...,15)` debe fallar; quitar la mutación y debe pasar.
- En ambos casos conservar las expectations originales; no usar mocks ni alterar controles para lograr GREEN. No mezclar mutaciones ni crear nuevas dependencias.
- Reproducir la misma suite original en GREEN en SHA corregido; registrar el log con `Files=`, `Tests=`, `Result:`. No tocar bases remotas.

## CI contrastado con SHA exacto

- [RED antes de migración: run 39701789632](https://github.com/cadeApp/cadeApp/actions/runs/39701789632): `cc036` falló 18/36, `rls_matrix` falló 4/67.
- [GREEN con migración: run 39702356908](https://github.com/cadeApp/cadeApp/actions/runs/39702356908): `Files=35, Tests=3056, Result: PASS`.
- [GREEN sobre fdafd1b: run 39704114188](https://github.com/cadeApp/cadeApp/actions/runs/39704114188): `Files=35, Tests=3056, Result: PASS`.
- [CI sobre e343f34: run 39705997023](https://github.com/cadeApp/cadeApp/actions/runs/39705997023): `db-tests` en progreso al documentar, checks unit/typecheck/lint/build/audit/bundle-budget verdes. Confirmar resultado exacto antes de afirmar GREEN de DB.
- [E2E preview bloqueado: run 39704239240](https://github.com/cadeApp/cadeApp/actions/runs/39704239240): `BLOCKED / REQUIRES DEVELOP MIGRATION`; no es E2E ejecutado.

## Control estructurado

```bash
node docs/revision-pr/analizar.mjs verificacion
```

Se espera `PR500-H01 [arreglado-sin-verificar]` porque **no** se ejecutó mutación SQL independiente; es deliberado y evita atribuir una verificación que no existió. D01 aceptada A no tiene pendiente técnico.
