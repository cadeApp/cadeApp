import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn utility', () => {
  it('combina clases simples', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resuelve conflictos de Tailwind correctamente con tailwind-merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
  });

  it('ignora valores condicionales falsy', () => {
    expect(cn('text-sm', false && 'text-lg', null, undefined, 'font-bold')).toBe(
      'text-sm font-bold'
    );
  });
});
