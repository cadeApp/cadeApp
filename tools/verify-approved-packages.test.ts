import { describe, expect, it } from 'vitest';
import pkg from '../package.json';

// Lista exhaustiva de dependencias aprobadas según .agents/rules/25-stack-y-patrones.md.
// Cualquier agregado requiere la aprobación explícita de Lautaro073 (regla 00).
const APPROVED_RUNTIME_PACKAGES = new Set([
  'next',
  'react',
  'react-dom',
  '@supabase/supabase-js',
  '@supabase/ssr',
  'server-only',
  'zod',
  'tailwindcss',
  'clsx',
  'tailwind-merge',
  'class-variance-authority',
  'lucide-react',
  'motion',
  'sonner',
  'react-hook-form',
  '@hookform/resolvers',
  '@radix-ui/react-alert-dialog',
  '@radix-ui/react-dialog',
  '@radix-ui/react-select',
  '@radix-ui/react-label',
  '@radix-ui/react-slot',
  '@radix-ui/react-tabs',
  'input-otp',
  '@tanstack/react-query',
  'date-fns',
  '@vis.gl/react-google-maps',
  'web-push',
  '@serwist/next',
  'browser-image-compression',
  '@sentry/nextjs',
]);

const APPROVED_DEV_PACKAGES = new Set([
  'typescript',
  'eslint',
  'eslint-config-next',
  'eslint-plugin-boundaries',
  'eslint-plugin-cadeapp',
  'prettier',
  'prettier-plugin-tailwindcss',
  'vitest',
  '@vitest/coverage-v8',
  '@testing-library/react',
  'jsdom',
  '@types/eslint',
  '@types/node',
  '@types/react',
  '@types/react-dom',
  'postcss',
  'autoprefixer',
  'tailwindcss',
  '@playwright/test',
  '@axe-core/playwright',
  'supabase',
]);

describe('DoD (c): Verificación de dependencias aprobadas (Regla 25)', () => {
  it('no hay dependencias de runtime fuera de la lista aprobada', () => {
    const dependencies = Object.keys(pkg.dependencies || {});
    const unapproved = dependencies.filter((dep) => !APPROVED_RUNTIME_PACKAGES.has(dep));
    expect(unapproved, `Dependencias no aprobadas encontradas: ${unapproved.join(', ')}`).toEqual([]);
  });

  it('no hay devDependencies fuera de la lista aprobada', () => {
    const devDependencies = Object.keys(pkg.devDependencies || {});
    const unapproved = devDependencies.filter((dep) => !APPROVED_DEV_PACKAGES.has(dep));
    expect(unapproved, `DevDependencies no aprobadas encontradas: ${unapproved.join(', ')}`).toEqual([]);
  });
});
