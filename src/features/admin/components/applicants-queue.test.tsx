// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ApplicantsQueue } from './applicants-queue';
import type { ApplicantQueueItem } from '../types';

const push = vi.fn();
let currentParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => currentParams,
}));

const NOW = '2026-11-04T15:00:00.000Z';

function item(overrides: Partial<ApplicantQueueItem> = {}): ApplicantQueueItem {
  return {
    id: 'a0000000-0000-4000-8000-000000000403',
    fullName: 'José Pérez',
    hasDni: true,
    phone: '3865123456',
    vehicleType: 'moto',
    status: 'pending',
    docLevel: 0,
    createdAt: '2026-11-01T12:00:00.000000Z',
    submittedAt: '2026-11-04T13:00:00.000000Z',
    licenseStatus: 'none',
    insuranceStatus: 'none',
    documentsSummary: { hasDniFront: true, hasDniBack: true, hasSelfie: true, hasLicense: false, hasInsurance: false },
    ...overrides,
  };
}

function renderQueue(props: Partial<React.ComponentProps<typeof ApplicantsQueue>> = {}) {
  return render(
    <ApplicantsQueue initialTab="pending" applicants={[item()]} total={7} now={NOW} {...props} />
  );
}

/** Texto de la celda de una columna en la primera fila de datos. */
function cell(columnName: string): string {
  const headers = screen.getAllByRole('columnheader').map((th) => th.textContent ?? '');
  const index = headers.findIndex((text) => text === columnName);
  const [, firstRow] = screen.getAllByRole('row');
  return firstRow?.querySelectorAll('td')[index]?.textContent ?? '';
}

beforeEach(() => {
  push.mockClear();
  currentParams = new URLSearchParams();
});

afterEach(() => cleanup());

describe('T-403: contador de la pestaña', () => {
  it('muestra la cantidad exacta junto al título, con el nombre de la pestaña', () => {
    renderQueue({ total: 7 });
    expect(screen.getByTestId('applicants-count').textContent).toBe('7 pendientes');
  });

  it('singular y otras pestañas', () => {
    renderQueue({ total: 1 });
    expect(screen.getByTestId('applicants-count').textContent).toBe('1 pendiente');
    cleanup();
    renderQueue({ initialTab: 'approved', total: 3 });
    expect(screen.getByTestId('applicants-count').textContent).toBe('3 aprobados');
  });
});

describe('T-403: buscador «Buscar por nombre»', () => {
  it('manda el término a la URL (?q=), conserva la pestaña y vuelve a la primera página', () => {
    currentParams = new URLSearchParams('tab=approved&cursor=2026-11-03T16:00:00Z~x&dir=prev');
    renderQueue({ initialTab: 'approved' });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), { target: { value: '  jose ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(push).toHaveBeenCalledWith('/admin/applicants?tab=approved&q=jose');
  });

  it('un término vacío saca la búsqueda de la URL', () => {
    currentParams = new URLSearchParams('tab=pending&q=jose');
    renderQueue({ query: 'jose' });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar por nombre' }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));

    expect(push).toHaveBeenCalledWith('/admin/applicants?tab=pending');
  });

  it('el campo limita a 80 caracteres y arranca con el término vigente', () => {
    renderQueue({ query: 'jose' });
    const input = screen.getByRole('searchbox', { name: 'Buscar por nombre' }) as HTMLInputElement;
    expect(input.maxLength).toBe(80);
    expect(input.value).toBe('jose');
  });

  it('sin resultados para la búsqueda, un estado vacío que lo dice y permite limpiarla', () => {
    currentParams = new URLSearchParams('tab=pending&q=zzz');
    renderQueue({ applicants: [], total: 0, query: 'zzz' });

    expect(screen.getByText('No encontramos postulantes con «zzz»')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar búsqueda' }));
    expect(push).toHaveBeenCalledWith('/admin/applicants?tab=pending');
  });

  it('sin búsqueda, el estado vacío habitual de la pestaña', () => {
    renderQueue({ applicants: [], total: 0 });
    expect(screen.getByText('No hay postulantes en estado "Pendientes"')).toBeDefined();
  });
});

describe('T-403: columna «Opcionales»', () => {
  it.each([
    ['ninguno', { licenseStatus: 'none', insuranceStatus: 'none' }, '0/2'],
    ['uno verificado', { licenseStatus: 'verified', insuranceStatus: 'none' }, '1/2'],
    ['los dos verificados', { licenseStatus: 'verified', insuranceStatus: 'verified' }, '2/2'],
    ['uno verificado y otro enviado', { licenseStatus: 'verified', insuranceStatus: 'submitted' }, '1/2 · 1 en revisión'],
    ['dos enviados sin verificar', { licenseStatus: 'submitted', insuranceStatus: 'submitted' }, '0/2 · 2 en revisión'],
    ['rechazado no cuenta', { licenseStatus: 'rejected', insuranceStatus: 'verified' }, '1/2'],
  ] as const)('%s → %s', (_case, statuses, expected) => {
    renderQueue({ applicants: [item(statuses)] });
    expect(cell('Opcionales')).toBe(expected);
  });
});

describe('T-403: columna «Enviado»', () => {
  it('fecha relativa desde submitted_at, con la fecha completa en <time>', () => {
    renderQueue();
    const time = screen.getByText('hace 2 h');
    expect(time.tagName).toBe('TIME');
    expect(time.getAttribute('dateTime')).toBe('2026-11-04T13:00:00.000000Z');
    expect(time.getAttribute('title')).toMatch(/04\/11\/2026/);
  });

  it('días', () => {
    renderQueue({ applicants: [item({ submittedAt: '2026-11-01T15:00:00.000000Z' })] });
    expect(cell('Enviado')).toBe('hace 3 días');
  });

  it('sin submitted_at muestra «Sin fecha de envío» y nunca la fecha de alta', () => {
    renderQueue({ applicants: [item({ submittedAt: null, createdAt: '2026-11-04T14:00:00.000000Z' })] });
    expect(cell('Enviado')).toBe('Sin fecha de envío');
    expect(cell('Enviado')).not.toMatch(/hace/);
  });
});

describe('T-403: paginación en los dos sentidos', () => {
  it('«Siguiente» usa nextCursor y conserva pestaña y búsqueda', () => {
    currentParams = new URLSearchParams('tab=approved&q=jose&dir=prev&cursor=old');
    renderQueue({ initialTab: 'approved', query: 'jose', nextCursor: '2026-11-03T15:00:00Z~n', prevCursor: null });

    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    const url = new URL(String(push.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.searchParams.get('tab')).toBe('approved');
    expect(url.searchParams.get('q')).toBe('jose');
    expect(url.searchParams.get('cursor')).toBe('2026-11-03T15:00:00Z~n');
    expect(url.searchParams.get('dir')).toBeNull();
  });

  it('«Anterior» usa prevCursor con dir=prev y conserva pestaña y búsqueda', () => {
    currentParams = new URLSearchParams('tab=pending&q=jose&cursor=2026-11-03T15:00:00Z~n');
    renderQueue({ query: 'jose', nextCursor: null, prevCursor: '2026-11-03T16:00:00Z~p' });

    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));

    const url = new URL(String(push.mock.calls[0]?.[0]), 'http://localhost');
    expect(url.searchParams.get('tab')).toBe('pending');
    expect(url.searchParams.get('q')).toBe('jose');
    expect(url.searchParams.get('cursor')).toBe('2026-11-03T16:00:00Z~p');
    expect(url.searchParams.get('dir')).toBe('prev');
  });

  it('cambiar de pestaña vuelve a la primera página y conserva la búsqueda', () => {
    currentParams = new URLSearchParams('tab=pending&q=jose&cursor=x&dir=prev');
    renderQueue({ query: 'jose' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Aprobados' }));

    expect(push).toHaveBeenCalledWith('/admin/applicants?tab=approved&q=jose');
  });
});
