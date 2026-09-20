import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';

describe('T-000: Verificación de Fronteras Arquitectónicas y DoD', () => {
  const eslint = new ESLint();

  it('DoD (a): ESLint debe fallar ante un import profundo entre features', async () => {
    const filePath = path.resolve('tools/lint-fixtures/deep-feature-import.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasEntryPointViolation = result!.messages.some(
      (m) => m.ruleId === 'boundaries/entry-point'
    );
    expect(hasEntryPointViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" importa de src/server/**', async () => {
    const filePath = path.resolve('tools/lint-fixtures/client-importing-server.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result!.messages.some(
      (m) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (c): ESLint debe fallar ante paquetes fuera de la lista aprobada (regla 25)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/unapproved-package.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result!.messages.some(
      (m) => m.ruleId === 'no-restricted-imports' && m.message.includes('axios')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD: Importar un módulo con server-only desde cliente rompe en tiempo de ejecución/build', async () => {
    // server-only arroja excepción al ejecutarse en un entorno no-react-server (cliente)
    expect(() => {
      // Cargar index.js de server-only (la rama default cuando no es react-server)
      const serverOnlyPath = path.resolve('node_modules/server-only/index.js');
      require(serverOnlyPath);
    }).toThrowError(/This module cannot be imported from a Client Component module/);
  });
});
