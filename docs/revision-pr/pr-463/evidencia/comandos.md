# Evidencia y comandos reproducibles — PR #463 / ronda 1

SHA revisado: `6e9e5457cf9267922feaa02997c5b6f8c4a0eb68`, rama `feat/T-381-merchant-panel-refresh`.

## Fuentes realmente consultadas

Se leyeron vía GitHub: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-381.md` **de develop**, `docs/tasks/T-366.md`, los 7 archivos cambiados, el hook compartido `useRealtimeInvalidation`, los comentarios, la bitácora y los jobs CI.

- `compare_commits(develop, 6e9e5457cf9267922feaa02997c5b6f8c4a0eb68)`: ahead=3, behind=0, mergeable=true en metadata del PR.
- CI job unit `118823496653`: `Test Files 153 passed (153)`; `Tests 2994 passed (2994)`. Conclusión success.
- Checks `typecheck/lint/build/audit/bundle-budget`: success. `db-tests`: cancelled. `approval-policy`: failure. No afirmar green completo.
- Bitácora del autor: `pnpm exec vitest run src/features/requests` → 241 passed; M1–M7 RED; E2E `request-states` 15 passed, chromium 90 passed y 3 flaky, global-settings 6 passed. **Declaraciones del autor, no reproducción propia.**

## Análisis de H01 (inspección)

La prueba combina en el MISMO `act`:
```tsx
document.dispatchEvent(new Event('visibilitychange'));
window.dispatchEvent(new Event('focus'));
realtime.state.handler?.({ eventType: 'UPDATE', table: 'offers' });
```
Tras avanzar el reloj solo exige el total de 2 llamadas, que foco o Realtime pueden satisfacer aunque el listener de visibilidad no exista. El evento hidden negativo tampoco detecta la ausencia del listener.

## Harness COMPLETO de mutación independiente I01 (PENDIENTE DE EJECUTAR)

Requiere checkout del SHA revisado, Node >=22.14, pnpm y dependencias instaladas. Se puede copiar el siguiente bloque en `/tmp/pr463-i01.sh` y ejecutar `bash /tmp/pr463-i01.sh` desde el root de cadeApp. **No toca el archivo fuente**: Vitest intercepta el módulo en memoria mediante plugin Vite; solo escribe una configuración efímera que se borra automáticamente. No usa `git checkout` para revertir. No ejecutar contra servicios remotos.

```bash
#!/usr/bin/env bash
set -euo pipefail
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const source = 'src/features/requests/hooks/use-merchant-panel-refresh.ts';
const needle = "document.addEventListener('visibilitychange', onVisibilityChange);";
const code = readFileSync(source, 'utf8');
if (!code.includes(needle)) throw new Error('I01: símbolo no encontrado: abortar, no declarar rojo');
const config = resolve(root, `.pr463-i01-${process.pid}.config.ts`);
const tag = 'PR463-I01-MUTATION-APPLIED';
const override = `
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';
export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'pr463-i01-visibility-in-memory',
    enforce: 'pre',
    transform(source, id) {
      if (!id.split('?')[0].replaceAll('\\\\', '/').endsWith('/src/features/requests/hooks/use-merchant-panel-refresh.ts')) return null;
      const target = ${JSON.stringify(needle)};
      if (!source.includes(target)) throw new Error('I01: mutation target absent');
      console.log('${tag}');
      return { code: source.replace(target, ''), map: null };
    }
  }]
}));
`;
const specs = [
  'src/features/requests/hooks/use-merchant-panel-refresh.test.tsx',
  'src/features/requests/components/merchant-requests-list.test.tsx'
];
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
function run(args) {
  const res = spawnSync(pnpm, args, { cwd: root, encoding: 'utf8', maxBuffer: 30_000_000 });
  const output = (res.stdout ?? '') + '\n' + (res.stderr ?? '');
  console.log(output.split('\n').filter(line => /Test Files|Tests\s+|PR463-I01|failed|Error:/.test(line)).slice(-18).join('\n'));
  if (res.error) throw res.error;
  return { status: res.status, output };
}
const baseline = run(['exec', 'vitest', 'run', ...specs]);
if (baseline.status !== 0) throw new Error('Baseline no verde, revisar antes de mutar');
try {
  writeFileSync(config, override);
  const mutant = run(['exec', 'vitest', 'run', ...specs, '--config', config]);
  if (!mutant.output.includes(tag)) throw new Error('I01: plugin no se aplicó; no usar el resultado');
  if (mutant.status === 0) console.log('I01 CIEGA: mutación aplicada, tests verdes (reproducido)');
  else console.log('I01 MATADA: el test detectó la ausencia del listener');
} finally {
  try { unlinkSync(config); } catch {}
}
NODE
```

**Advertencia:** el harness es una propuesta ejecutable documentada, pero la presente revisión NO contó con checkout de dependencias para probarlo. Un resultado esperado por inspección no se registra como `verificado-runtime`.

## Reparación requerida y red/green

En `use-merchant-panel-refresh.test.tsx`:
1. Ejecutar `visible` **sin** `focus` ni `realtime.handler`, avanzar `debounce - 1` y afirmar que no hubo refresh, avanzar 1 ms y afirmar exactamente una llamada nueva.
2. Probar luego el burst combinado `visible + focus + Realtime` y un único refresh total tras debounce.
3. En el test correcto, correr I01 y exigir resumen RED (cuando se quite solo listener). Restaurado el transform, exigir GREEN. No adulterar expectations, hacer tests vacíos, usar if(test) ni mockear el camino productivo.
4. Escribir comandos y salidas reales resumidas en bitácora, con commit y SHA remoto.

Para la ronda final: `git fetch origin && git merge-tree --write-tree origin/develop HEAD`; `pnpm typecheck && pnpm lint && pnpm test`; CI oficial con `e2e-preview` según decisión de Lautaro073. Sin ejecutar Supabase o Docker local.
