// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import IncidentsLoading from '../loading';
import IncidentsError from '../error';
import IncidentDetailLoading from '../[id]/loading';
import IncidentDetailError from '../[id]/error';

const routeDir = path.join(process.cwd(), 'src', 'app', '(admin)', 'admin', 'incidents');

/** Bloques `Skeleton` de `src/ui` dentro de una zona marcada del layout de carga. */
function skeletonsIn(container: HTMLElement, zone: string): Element[] {
  return Array.from(container.querySelectorAll(`[data-skeleton="${zone}"]`)).flatMap((node) => [
    ...(node.matches('.animate-pulse') ? [node] : []),
    ...Array.from(node.querySelectorAll('.animate-pulse')),
  ]);
}

describe('PR113-H08: loading.tsx de /admin/incidents imita la bandeja con Skeleton', () => {
  it('anuncia la carga y dibuja título, pestañas y filas de incidentes', () => {
    const { container } = render(<IncidentsLoading />);

    const busy = screen.getByRole('status');
    expect(busy.getAttribute('aria-busy')).toBe('true');
    expect(busy.textContent).toMatch(/cargando incidentes/i);

    expect(skeletonsIn(container, 'title').length).toBeGreaterThanOrEqual(1);
    expect(skeletonsIn(container, 'tab')).toHaveLength(2);
    expect(skeletonsIn(container, 'row').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('[data-skeleton="row"]').length).toBeGreaterThanOrEqual(3);
  });

  it('no es un spinner ni solo texto: todo lo visible es Skeleton', () => {
    const { container } = render(<IncidentsLoading />);
    expect(container.querySelector('.animate-spin')).toBeNull();
    const visibleText = Array.from(container.querySelectorAll('*'))
      .filter((node) => !node.closest('.sr-only') && node.children.length === 0)
      .map((node) => node.textContent?.trim())
      .filter(Boolean);
    expect(visibleText).toEqual([]);
  });
});

describe('PR113-H08: loading.tsx de /admin/incidents/[id] imita el detalle con Skeleton', () => {
  it('anuncia la carga y dibuja título, relato, cronología, partes y acciones', () => {
    const { container } = render(<IncidentDetailLoading />);

    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    for (const zone of ['title', 'story', 'timeline', 'parties', 'actions']) {
      expect(skeletonsIn(container, zone).length, zone).toBeGreaterThanOrEqual(1);
    }
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});

const SENSITIVE_ERROR = Object.assign(
  new Error('permission denied for table incidents · recipient_phone 3865998877'),
  { digest: 'digest-123', stack: 'Error: at getIncidentsQueue (src/features/incidents/queries.ts:10)' }
);

describe.each([
  { name: 'la bandeja', Boundary: IncidentsError, file: 'error.tsx', title: /no pudimos cargar los incidentes/i },
  {
    name: 'el detalle',
    Boundary: IncidentDetailError,
    file: path.join('[id]', 'error.tsx'),
    title: /no pudimos cargar el incidente/i,
  },
])('PR113-H08: error.tsx de $name', ({ Boundary, file, title }) => {
  const reset = vi.fn();

  beforeEach(() => {
    reset.mockClear();
  });

  it('es un Client Component de Next', () => {
    const source = fs.readFileSync(path.join(routeDir, file), 'utf-8');
    expect(source.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('muestra copy seguro sin mensaje, stack ni digest del error', () => {
    render(<Boundary error={SENSITIVE_ERROR} reset={reset} />);

    expect(screen.getByRole('alert').textContent).toMatch(title);
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/permission denied|recipient|3865998877|digest-123|queries\.ts|stack/i);
  });

  it('«Reintentar» llama a reset()', () => {
    render(<Boundary error={SENSITIVE_ERROR} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
