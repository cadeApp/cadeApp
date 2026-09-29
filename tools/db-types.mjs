#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

const TARGET_FILE = process.env.DB_TYPES_TARGET_FILE
  ? path.resolve(process.env.DB_TYPES_TARGET_FILE)
  : path.resolve('src/types/database.types.ts');

const args = process.argv.slice(2);
const cliArgs = ['supabase', 'gen', 'types', 'typescript', '--schema', 'public'];

if (args.length > 0) {
  cliArgs.push(...args);
} else {
  const projectRef =
    process.env.SUPABASE_PROJECT_REF ||
    process.env.SUPABASE_PROJECT_ID ||
    (() => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const match = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/);
      return match ? match[1] : null;
    })();

  if (projectRef) {
    cliArgs.push('--project-id', projectRef);
  } else {
    cliArgs.push('--linked');
  }
}

console.log(`[db:types] Ejecutando: pnpm ${cliArgs.join(' ')}`);

const isWindows = process.platform === 'win32';
const result = spawnSync('pnpm', cliArgs, {
  encoding: 'utf-8',
  shell: isWindows,
});

if (result.status !== 0) {
  console.error('[db:types] Error al generar tipos con Supabase CLI:');
  if (result.stdout) console.error(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
  console.error('[db:types] src/types/database.types.ts NO fue modificado para proteger los tipos commiteados.');
  process.exit(1);
}

const output = (result.stdout || '').trim();

if (!output || !output.includes('export type') || output.length < 50) {
  console.error('[db:types] La salida generada no es válida o está vacía. No se sobreescribirá el archivo.');
  process.exit(1);
}

writeFileSync(TARGET_FILE, output + '\n', 'utf-8');
console.log(`[db:types] Tipos generados exitosamente en ${TARGET_FILE}`);
