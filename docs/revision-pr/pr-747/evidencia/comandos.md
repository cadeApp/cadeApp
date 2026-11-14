# Evidencia y comandos — PR #747 / T-437 / CC-052

**Fuente:** GitHub Actions y git. No se ejecutó Supabase remoto, Docker ni Playwright nuevo en esta revisión. La reproducción propuesta es **de lectura**, no re-despacha workflows.

## Datos efectivamente contrastados

| Run | Job | SHA/versión verificada en su log | Resultado |
|---|---|---|---|
| [43535604463](https://github.com/cadeApp/cadeApp/actions/runs/43535604463) | `132263796461` | checkout de `3da9a12ebd9780d2a0a3cf64fdf76d4af854d152` | `132 passed` + `1 flaky` (T-376 reintento PASS); cuatro T-437 PASS |
| [43540265968](https://github.com/cadeApp/cadeApp/actions/runs/43540265968) | `132278930924` | checkout de `abb122c6c359a322ed0f84fd368ff5f5c0c3cdca` | control `1 passed`; mutante `1 failed` por `toBeDisabled`; `RED_CONFIRMED` |
| [43532735200](https://github.com/cadeApp/cadeApp/actions/runs/43532735200) | `132254180640` | `1a231dfa` | reactivar `RED_CONFIRMED` |
| [43532737982, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/43532737982) | `132258451468` | `1a231dfa` | reconsiderar `RED_CONFIRMED` |

El E2E fue ejecución sobre el **SHA de código de la PR antes del merge** con el entorno Develop, no sobre la fusión `abb122c6`. La mutación sí se ejecutó sobre la fusión. El fallo previo de aprobación `CONTROL_NOT_GREEN` (43532734795) queda correctamente supersedido por la nueva corrida `RED_CONFIRMED`.

## Reproducción con shell (arnés completo)

Guarda esto en `/tmp/pr747-evidencia.sh` y ejecutá `bash /tmp/pr747-evidencia.sh /ruta/al/clon`. Requiere `git` con ambos commits, `gh` autenticado con acceso de lectura al repo y `node`; lee solo logs de Actions y el archivo documental, **no** busca ni imprime secretos. Guarda las salidas largas en archivos temporales y los borra al salir.

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "${1:-$PWD}"
BASE=abb122c6c359a322ed0f84fd368ff5f5c0c3cdca
HEAD=5cab2380907ced83c3b4647b43552e22453d6822
git cat-file -e "${BASE}^{commit}"
git cat-file -e "${HEAD}^{commit}"
test "$(git diff --name-only "$BASE" "$HEAD")" = "docs/tasks/log/T-437.md"
test "$(git diff --numstat "$BASE" "$HEAD" -- docs/tasks/log/T-437.md)" = "$(printf '15\t0\tdocs/tasks/log/T-437.md')"
ROOT="$(mktemp -d)"
trap 'rm -rf "$ROOT"' EXIT
git show "$HEAD:docs/tasks/log/T-437.md" > "$ROOT/bitacora.txt"
for id in 43535604463 43540265968 43532735200 43532737982; do
  gh run view "$id" --repo cadeApp/cadeApp --log > "$ROOT/$id.log"
done
node --input-type=module - "$ROOT" <<'JS'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir=process.argv[2];
const read=(id)=>readFileSync(dir+'/'+id+'.log','utf8');
const content=readFileSync(dir+'/bitacora.txt','utf8');
const block=content.split('## 2026-11-13 — cierre post-merge (#746 → `abb122c6`)')[1];
assert.ok(block,'cierre ausente');
function validate(s) {
  for(const token of [
    '43535604463','132 passed','1 flaky','T-376','subsanación',
    '43540265968','RED_CONFIRMED','toBeDisabled','43532735200','43532737982','#743'
  ]) assert.ok(s.includes(token),'falta evidencia documental: '+token);
}
validate(block);
const alters=[
  block.replace('43540265968','RUN_NO_ACREDITADA'),
  block.replace('132 passed','131 passed'),
  block.replace('toBeDisabled','toBeEnabled'),
  block.replace('43532735200','RUN_NO_ACREDITADA'),
];
for(const v of alters) assert.throws(()=>validate(v),undefined,'control documental aceptó un dato adulterado');
const full=read('43535604463'), approve=read('43540265968');
assert.ok(full.includes('3da9a12ebd9780d2a0a3cf64fdf76d4af854d152'),'SHA E2E incorrecto');
assert.match(full,/132 passed/);
assert.match(full,/1 flaky/);
for(const token of [
  'bypass: un suspendido con la selfie sin verificar no se puede reactivar',
  'bypass: un rechazado con la selfie sin verificar no se puede reconsiderar',
  'T-437 (CC-052) bypass: con la selfie sin verificar',
  'T-437 (CC-052) subsanación:'
]) assert.ok(full.includes(token),'E2E T-437 ausente: '+token);
for(const token of [
  'abb122c6c359a322ed0f84fd368ff5f5c0c3cdca',
  '1 passed','1 failed','toBeDisabled','Expected: disabled','Received: enabled',
  'RED_CONFIRMED: Control GREEN y mutante RED por la aserción esperada.'
]) assert.ok(approve.includes(token),'mutación de aprobación no acreditada: '+token);
assert.ok(read('43532735200').includes('RED_CONFIRMED:'));
assert.ok(read('43532737982').includes('RED_CONFIRMED:'));
console.log('PASS: integridad documental, 4 mutaciones de comprobación negativa estructural y 4 logs Actions');
JS
```

### Alcance del arnés

Las cuatro alteraciones son **contrapruebas documentales**: detectan adulteración del resumen escrito, no mutaciones de la aplicación. Las mutaciones de comportamiento ya fueron ejecutadas por el workflow `e2e-mutation` y verificadas en sus logs. No crear RED sintéticos ni adjudicar un GREEN sin run real.

### Controles adicionales

```bash
git fetch origin
git diff --check abb122c6..5cab2380
git diff --stat abb122c6..5cab2380
node docs/revision-pr/analizar.mjs verificacion
```

**Comprobación realizada en esta sesión:** comparación remota de GitHub con un único archivo +15/-0, lectura de jobs y segmentos relevantes de logs, verificación del estado de #670 (closed/completed) y #743 (open). No se ejecutó el shell con `gh` desde un clon local; esos comandos quedan para reproducción del informe.
