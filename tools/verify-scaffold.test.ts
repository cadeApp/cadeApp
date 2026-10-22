import { beforeAll, describe, expect, it } from 'vitest';
import { ESLint } from 'eslint';
import path from 'node:path';

const FILES = {
  deepFeatureImport: 'tools/lint-fixtures/deep-feature-import.ts',
  deepImportSchemas: 'tools/lint-fixtures/deep-import-schemas.ts',
  clientImportingServer: 'tools/lint-fixtures/client-importing-server.tsx',
  clientWithCommentImportingServer: 'tools/lint-fixtures/client-with-comment-importing-server.tsx',
  clientReexportingServer: 'tools/lint-fixtures/client-reexporting-server.tsx',
  clientImportingNextServer: 'tools/lint-fixtures/client-importing-next-server.tsx',
  unapprovedPackage: 'tools/lint-fixtures/unapproved-package.ts',
  unapprovedSubpath: 'tools/lint-fixtures/unapproved-subpath.ts',
  featureComponentUnapprovedPackage: 'tools/lint-fixtures/feature-component-unapproved-package.tsx',
  featureLooseFileImportingServer: 'tools/lint-fixtures/feature-loose-file-importing-server.ts',
  templateActions: 'src/features/_template/actions.ts',
  clientBrowserSupabaseConsumer: 'tools/lint-fixtures/client-browser-supabase-consumer.tsx',
  serverWithoutServerOnly: 'tools/lint-fixtures/server-without-server-only.ts',
  serverWithServerOnly: 'tools/lint-fixtures/server-with-server-only.ts',
} as const;

describe('T-000: Verificación de Fronteras Arquitectónicas y DoD', () => {
  const eslint = new ESLint();
  let resultsByPath = new Map<string, ESLint.LintResult>();

  // Un solo lint en lote: el arranque en frío de ESLint (plugins y parser TS) se paga una vez y no dentro de un `it`
  // (PR275-H04).
  beforeAll(async () => {
    const lintResults = await eslint.lintFiles(Object.values(FILES).map((file) => path.resolve(file)));
    resultsByPath = new Map(lintResults.map((result) => [path.resolve(result.filePath), result]));
  });

  function resultFor(file: string): ESLint.LintResult {
    const result = resultsByPath.get(path.resolve(file));
    if (!result) {
      throw new Error(`No hubo resultado ESLint para ${file}`);
    }
    return result;
  }

  it('DoD (a): ESLint debe fallar ante un import profundo a components de otra feature', () => {
    const result = resultFor(FILES.deepFeatureImport);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasEntryPointViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'boundaries/entry-point'
    );
    expect(hasEntryPointViolation).toBe(true);
  });

  it('DoD (a): ESLint debe fallar ante un import profundo a schemas de otra feature (Hallazgo 8)', () => {
    const result = resultFor(FILES.deepImportSchemas);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasEntryPointViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'boundaries/entry-point'
    );
    expect(hasEntryPointViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" importa de src/server/**', () => {
    const result = resultFor(FILES.clientImportingServer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" tiene comentarios previos (Hallazgo 2)', () => {
    const result = resultFor(FILES.clientWithCommentImportingServer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint debe fallar cuando un archivo "use client" reexporta desde src/server/** (Hallazgo 6)', () => {
    const result = resultFor(FILES.clientReexportingServer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasClientServerViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/client-no-server'
    );
    expect(hasClientServerViolation).toBe(true);
  });

  it('DoD (b): ESLint NO debe fallar cuando un archivo "use client" importa de next/server (Hallazgo 7)', () => {
    const result = resultFor(FILES.clientImportingNextServer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBe(0);
  });

  it('DoD (c): ESLint debe fallar ante paquetes fuera de la lista aprobada (regla 25)', () => {
    const result = resultFor(FILES.unapprovedPackage);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('axios')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (c): ESLint debe fallar ante subrutas de paquetes no aprobados como lodash/get (Hallazgo 5)', () => {
    const result = resultFor(FILES.unapprovedSubpath);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('lodash')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (c): ESLint debe fallar cuando un componente dentro de una feature importa paquetes prohibidos (R1)', () => {
    const result = resultFor(FILES.featureComponentUnapprovedPackage);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasRestrictedImport = result.messages.some(
      (m: { ruleId?: string | null; message: string }) =>
        m.ruleId === 'no-restricted-imports' && m.message.includes('axios')
    );
    expect(hasRestrictedImport).toBe(true);
  });

  it('DoD (a): ESLint debe fallar cuando un archivo suelto de feature importa de src/server/** (Hallazgo 9)', () => {
    const result = resultFor(FILES.featureLooseFileImportingServer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasFeatureServerViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/feature-server-boundary'
    );
    expect(hasFeatureServerViolation).toBe(true);
  });

  it('DoD: Las Server Actions de features/_template pueden importar ./schemas y @/server sin errores de boundaries', () => {
    const result = resultFor(FILES.templateActions);
    expect(result).toBeDefined();
    expect(result.messages.length).toBe(0);
  });

  it('H01 & AG-10: Un Client Component ("use client") puede importar y usar Supabase desde @/lib/supabase/browser sin violar fronteras', () => {
    const result = resultFor(FILES.clientBrowserSupabaseConsumer);
    expect(result).toBeDefined();
    expect(result.messages.length).toBe(0);
  });

  it('H02: ESLint debe fallar si un archivo de src/server/** no contiene import "server-only"', () => {
    const result = resultFor(FILES.serverWithoutServerOnly);
    expect(result).toBeDefined();
    expect(result.messages.length).toBeGreaterThan(0);

    const hasServerOnlyViolation = result.messages.some(
      (m: { ruleId?: string | null }) => m.ruleId === 'cadeapp/server-layer-must-be-server-only'
    );
    expect(hasServerOnlyViolation).toBe(true);
  });

  it('H02 (AG-07): ESLint NO debe fallar cuando un archivo de src/server/** contiene import "server-only"', () => {
    const result = resultFor(FILES.serverWithServerOnly);
    expect(result).toBeDefined();
    expect(result.messages.length).toBe(0);
  });
});

