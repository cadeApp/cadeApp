import { describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';

describe('T-000: Verificación de Fronteras Arquitectónicas y DoD', () => {
  const eslint = new ESLint();

  it('DoD (a): ESLint debe fallar ante un import profundo a components de otra feature', async () => {
    const filePath = path.resolve('tools/lint-fixtures/deep-feature-import.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasEntryPointViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'boundaries/entry-point'
    );
    expect(hasEntryPointViolation).toBe(true);
  });

  it('DoD (a): ESLint debe fallar ante un import profundo a schemas de otra feature (Hallazgo 8)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/deep-import-schemas.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasEntryPointViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'boundaries/entry-point'
    );
    expect(hasEntryPointViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" importa de src/server/**', async () => {
    const filePath = path.resolve('tools/lint-fixtures/client-importing-server.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" tiene comentarios previos (Hallazgo 2)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/client-with-comment-importing-server.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" reexporta desde src/server/** (Hallazgo 6)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/client-reexporting-server.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint NO debe fallar cuando un archivo "use client" importa de next/server (Hallazgo 7)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/client-importing-next-server.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBe(0);
  });

  it('DoD (c): ESLint debe fallar ante paquetes fuera de la lista aprobada (regla 25)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/unapproved-package.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result!.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('axios')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (c): ESLint debe fallar ante subrutas de paquetes no aprobados como lodash/get (Hallazgo 5)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/unapproved-subpath.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result!.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('lodash')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (c): ESLint debe fallar cuando un componente dentro de una feature importa paquetes prohibidos (R1)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/feature-component-unapproved-package.tsx');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result!.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('axios')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (a): ESLint debe fallar cuando un archivo suelto de feature importa de src/server/** (Hallazgo 9)', async () => {
    const filePath = path.resolve('tools/lint-fixtures/feature-loose-file-importing-server.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBeGreaterThan(0);

    const hasFeatureServerViolation = result!.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/feature-server-boundary'
    );
    expect(hasFeatureServerViolation).toBe(true);
  });

  it('DoD: Las Server Actions de features/_template pueden importar ./schemas y @/server sin errores de boundaries', async () => {
    const filePath = path.resolve('src/features/_template/actions.ts');
    const [result] = await eslint.lintFiles([filePath]);
    expect(result).toBeDefined();
    expect(result!.messages.length).toBe(0);
  });
});

