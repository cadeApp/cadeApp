import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// PR57-H18: el hook PreToolUse de la regla 00 estaba muerto por dos motivos
// independientes: la ruta de `.agents/hooks.json` no resolvía desde la raíz del
// repo, y el script leía un formato de payload que los hooks no mandan. Con
// cualquiera de los dos, todo pasaba como "ask" y nada quedaba bloqueado.

const GUARD_PATH = path.resolve('.agents/scripts/agent-guard.mjs');
const HOOKS_PATH = path.resolve('.agents/hooks.json');

type Decision = { decision: string; reason?: string };

function runGuard(payload: unknown): Decision {
  const out = execFileSync(process.execPath, [GUARD_PATH], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });
  return JSON.parse(out) as Decision;
}

describe('agent-guard: el hook está enganchado', () => {
  it('la ruta del comando de hooks.json resuelve desde la raíz del repo', () => {
    const hooks = JSON.parse(readFileSync(HOOKS_PATH, 'utf8')) as {
      [k: string]: { PreToolUse?: { hooks?: { command?: string }[] }[] };
    };
    const commands = Object.values(hooks)
      .flatMap((group) => group.PreToolUse ?? [])
      .flatMap((entry) => entry.hooks ?? [])
      .map((hook) => hook.command ?? '');

    expect(commands.length).toBeGreaterThan(0);
    for (const command of commands) {
      const script = command.replace(/^node\s+/, '').trim();
      expect(
        existsSync(path.resolve(script)),
        `hooks.json invoca "${command}" y ${script} no existe desde la raíz del repo`
      ).toBe(true);
    }
  });
});

describe('agent-guard: deniega con el formato de payload de los hooks PreToolUse', () => {
  // Éste es el formato que manda el runtime: tool_name + tool_input.
  it('bloquea un comando de Supabase contra un ambiente remoto', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'supabase db push --linked' },
    });
    expect(result.decision).toBe('deny');
  });

  it('bloquea la lectura de un archivo .env', () => {
    const result = runGuard({ tool_name: 'Read', tool_input: { file_path: '.env.local' } });
    expect(result.decision).toBe('deny');
  });

  it('bloquea un comando que menciona un secreto', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'echo $SUPABASE_SERVICE_ROLE_KEY' },
    });
    expect(result.decision).toBe('deny');
  });

  it('bloquea un push a una rama protegida', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'git push origin develop' },
    });
    expect(result.decision).toBe('deny');
  });

  it('deja pasar a "ask" lo que no está en ninguna regla', () => {
    const result = runGuard({ tool_name: 'Bash', tool_input: { command: 'pnpm typecheck' } });
    expect(result.decision).toBe('ask');
  });

  it('no bloquea .env.example, que sí se puede leer', () => {
    const result = runGuard({ tool_name: 'Read', tool_input: { file_path: '.env.example' } });
    expect(result.decision).toBe('ask');
  });
});

describe('agent-guard: sigue funcionando con el formato viejo', () => {
  it('bloquea con toolCall.args.CommandLine', () => {
    const result = runGuard({
      toolCall: { name: 'run_command', args: { CommandLine: 'supabase db push --linked' } },
    });
    expect(result.decision).toBe('deny');
  });
});
