import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

describe('T-001: DoD - Kit de agy, CODEOWNERS y Guard', () => {
  describe('DoD 1: Instalación de archivos raíz de agy-kit', () => {
    it('debe existir AGENTS.md en la raíz del repositorio', () => {
      const agentsPath = path.resolve('AGENTS.md');
      expect(fs.existsSync(agentsPath), 'AGENTS.md no existe en la raíz').toBe(true);
      const content = fs.readFileSync(agentsPath, 'utf-8');
      expect(content).toContain('cadeApp — reglas raíz para agentes');
      expect(content).toContain('## 0. Confianza');
    });

    it('debe existir .agents/hooks.json configurado con PreToolUse', () => {
      const hooksPath = path.resolve('.agents/hooks.json');
      expect(fs.existsSync(hooksPath), '.agents/hooks.json no existe').toBe(true);
      const content = JSON.parse(fs.readFileSync(hooksPath, 'utf-8'));
      const hookConfig = content['cadeapp-guard'] ?? content;
      expect(hookConfig).toHaveProperty('PreToolUse');
    });

    it('debe existir .agents/scripts/agent-guard.mjs', () => {
      const guardPath = path.resolve('.agents/scripts/agent-guard.mjs');
      expect(fs.existsSync(guardPath), '.agents/scripts/agent-guard.mjs no existe').toBe(true);
    });

    it('deben existir las 8 reglas en .agents/rules/', () => {
      const rules = [
        '00-confianza-y-seguridad.md',
        '10-typescript.md',
        '20-arquitectura.md',
        '25-stack-y-patrones.md',
        '30-supabase.md',
        '40-testing.md',
        '50-git-y-coordinacion.md',
        '60-ui-accesibilidad.md',
      ];
      for (const rule of rules) {
        const rulePath = path.resolve('.agents/rules', rule);
        expect(fs.existsSync(rulePath), `Regla faltante: .agents/rules/${rule}`).toBe(true);
      }
    });

    it('deben existir las skills requeridas en .agents/skills/', () => {
      const skills = [
        'tomar-tarea',
        'retomar-tarea',
        'cerrar-sesion',
        'revisar-pr',
        'contract-change',
        'implementar-diseno',
        'nueva-migracion',
        'nueva-rpc',
        'nuevo-e2e',
      ];
      for (const skill of skills) {
        const skillPath = path.resolve('.agents/skills', skill, 'SKILL.md');
        expect(fs.existsSync(skillPath), `Skill faltante: .agents/skills/${skill}/SKILL.md`).toBe(true);
      }
    });

    it('deben existir los AGENTS.md por zona y plantillas de docs', () => {
      expect(fs.existsSync(path.resolve('supabase/AGENTS.md')), 'Falta supabase/AGENTS.md').toBe(true);
      expect(fs.existsSync(path.resolve('src/domain/AGENTS.md')), 'Falta src/domain/AGENTS.md').toBe(true);
      expect(fs.existsSync(path.resolve('e2e/AGENTS.md')), 'Falta e2e/AGENTS.md').toBe(true);
      expect(fs.existsSync(path.resolve('.github/pull_request_template.md')), 'Falta pull_request_template.md').toBe(true);
      expect(fs.existsSync(path.resolve('docs/tasks/_plantilla.md')), 'Falta docs/tasks/_plantilla.md').toBe(true);
      expect(fs.existsSync(path.resolve('docs/tasks/log/_plantilla.md')), 'Falta docs/tasks/log/_plantilla.md').toBe(true);
      expect(fs.existsSync(path.resolve('docs/contracts/_plantilla.md')), 'Falta docs/contracts/_plantilla.md').toBe(true);
    });

    it('docs/agy-kit/ debe haber sido eliminado tras la instalación', () => {
      expect(fs.existsSync(path.resolve('docs/agy-kit')), 'docs/agy-kit/ aún no fue removido').toBe(false);
    });
  });

  describe('DoD 2: Configuración de .github/CODEOWNERS', () => {
    it('debe existir .github/CODEOWNERS con sintaxis válida y usuarios reales', () => {
      const codeownersPath = path.resolve('.github/CODEOWNERS');
      expect(fs.existsSync(codeownersPath), '.github/CODEOWNERS no existe').toBe(true);

      const content = fs.readFileSync(codeownersPath, 'utf-8');
      expect(content).toContain('@Lautaro073');
      expect(content).toContain('@KiraK72');
      expect(content).not.toContain('@persona2');
      expect(content).not.toContain('@persona3');

      const VALID_COLLABORATORS = new Set(['@Lautaro073', '@KiraK72']);

      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const [pattern, ...owners] = trimmed.split(/\s+/);
        expect(pattern, `Patrón inválido en CODEOWNERS: ${pattern}`).toBeDefined();
        expect(owners.length, `Ruta sin dueños en CODEOWNERS: ${pattern}`).toBeGreaterThan(0);
        for (const owner of owners) {
          expect(owner.startsWith('@'), `Dueño debe comenzar con @: ${owner}`).toBe(true);
          expect(
            VALID_COLLABORATORS.has(owner),
            `Dueño ${owner} en ruta ${pattern} no es un colaborador real del repositorio`
          ).toBe(true);
        }
      }
    });
  });

  describe('DoD 3: agent-guard.mjs bloqueos y permisos', () => {
    const runGuard = (payload: unknown) => {
      const guardPath = path.resolve('.agents/scripts/agent-guard.mjs');
      const input = JSON.stringify(payload);
      const stdout = execSync(`node "${guardPath}"`, {
        input,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return JSON.parse(stdout.trim());
    };

    describe('H01 & DoD 3.1: Bloqueo de secretos .env y allowlist de .env.example', () => {
      it('debe bloquear lectura o mención de .env.local (deny)', () => {
        const payload = {
          toolCall: {
            name: 'view_file',
            args: {
              AbsolutePath: 'c:/Users/El Yisus Pai/Desktop/Proyectos/cadeApp/.env.local',
            },
          },
        };
        const result = runGuard(payload);
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('debe bloquear cat .env (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat .env' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('H01: debe bloquear cat .env* con comodín (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat .env*' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('H01: debe bloquear cat .env.* (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat .env.*' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('H01: debe bloquear cp .env* /tmp/x (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cp .env* /tmp/x' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('H01: debe bloquear .env.example* si usa comodín o sufijo extraño (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat .env.example*' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });

      it('H01: debe permitir cat .env.example (ask)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat .env.example' } },
        });
        expect(result.decision).toBe('ask');
      });

      it('H01: debe permitir view_file de .env.example (ask)', () => {
        const result = runGuard({
          toolCall: {
            name: 'view_file',
            args: {
              AbsolutePath: 'c:/Users/El Yisus Pai/Desktop/Proyectos/cadeApp/.env.example',
            },
          },
        });
        expect(result.decision).toBe('ask');
      });
          it('H06: debe permitir nombres legítimos que empiezan con .env como .environment-setup.md (ask)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'cat docs/.environment-setup.md' } },
        });
        expect(result.decision).toBe('ask');
      });
    });

    describe('DoD 3.2: Bloqueo de supabase remoto', () => {
      it('debe bloquear supabase db push (deny)', () => {
        const payload = {
          toolCall: {
            name: 'run_command',
            args: {
              CommandLine: 'pnpm supabase db push',
            },
          },
        };
        const result = runGuard(payload);
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 00');
      });
    });

    describe('H02 & DoD 3.3: Bloqueo de git push desprotegido', () => {
      it('debe bloquear git push origin develop (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push origin develop' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });

      it('debe bloquear git push -u origin develop (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push -u origin develop' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });

      it('debe bloquear git push origin staging y main (deny)', () => {
        expect(runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push origin staging' } },
        }).decision).toBe('deny');
        expect(runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push origin main' } },
        }).decision).toBe('deny');
      });

      it('H02: debe bloquear git push pelado (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });

      it('H02: debe bloquear git push origin sin rama (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push origin' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });

      it('H02: debe bloquear git push origin HEAD (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push origin HEAD' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });

      it('H02: debe bloquear git push -u origin HEAD (deny)', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'git push -u origin HEAD' } },
        });
        expect(result.decision).toBe('deny');
        expect(result.reason).toContain('Regla 50');
      });
    });

    describe('DoD 3.4: Permiso para comandos legítimos', () => {
      it('debe permitir pnpm test con decisión ask', () => {
        const result = runGuard({
          toolCall: { name: 'run_command', args: { CommandLine: 'pnpm test' } },
        });
        expect(result.decision).toBe('ask');
      });

      it('H02: debe permitir git push origin feat/T-001-kit-agy-codeowners con decisión ask', () => {
        const result = runGuard({
          toolCall: {
            name: 'run_command',
            args: { CommandLine: 'git push origin feat/T-001-kit-agy-codeowners' },
          },
        });
        expect(result.decision).toBe('ask');
      });

      it('H02: debe permitir git push -u origin feat/T-001-kit-agy-codeowners con decisión ask', () => {
        const result = runGuard({
          toolCall: {
            name: 'run_command',
            args: { CommandLine: 'git push -u origin feat/T-001-kit-agy-codeowners' },
          },
        });
        expect(result.decision).toBe('ask');
      });
    });
  });
});
