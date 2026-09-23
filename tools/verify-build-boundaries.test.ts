import { describe, expect, it } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';

const execAsync = promisify(exec);

describe('DoD: Build Boundaries (server-only)', () => {
  it('un Client Component que importa un módulo server-only rompe el build de producción (Hallazgo 4)', async () => {
    const probeDir = path.resolve('src/app/boundary-probe');
    await fs.mkdir(probeDir, { recursive: true });
    await fs.writeFile(
      path.join(probeDir, 'probe.tsx'),
      `'use client';\nimport { serverEnv } from '@/server/env';\nexport function Probe() { return <div>{serverEnv.NODE_ENV}</div>; }\n`
    );
    await fs.writeFile(
      path.join(probeDir, 'page.tsx'),
      `import { Probe } from './probe';\nexport default function Page() { return <Probe />; }\n`
    );

    try {
      let buildError: Error | null = null;
      try {
        // --no-lint aísla la frontera de server-only del paso de ESLint
        await execAsync('npx next build --no-lint');
      } catch (err) {
        buildError = err as Error;
      }
      expect(buildError, 'El build debería haber fallado por server-only').not.toBeNull();
      expect(buildError?.message).toMatch(/needs ["']?server-only["']?/i);
    } finally {
      await fs.rm(probeDir, { recursive: true, force: true });
      await fs.rm(path.resolve('.next'), { recursive: true, force: true });
    }
  }, 120_000);
});
