// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DisputeCandidates } from './dispute-candidates';

const CANDIDATE = {
  courierId: '20000000-0000-4000-8000-0000000050c7',
  displayName: 'Titular Real',
  phoneMasked: '•••• 1234',
  status: 'pending' as const,
  applicationSubmitted: false as const,
  documentsCount: 4,
};

describe('CC-050 (D4-B): DisputeCandidates', () => {
  it('sin búsqueda muestra el formulario por GET con el campo q y ninguna lista', () => {
    render(<DisputeCandidates lookup={null} result={null} />);
    const input = screen.getByLabelText('Teléfono completo o ID de la cuenta');
    expect(input.getAttribute('name')).toBe('q');
    expect(input.closest('form')?.getAttribute('method')?.toLowerCase()).toBe('get');
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lista los candidatos con enlace al detalle protegido y el teléfono enmascarado', () => {
    render(<DisputeCandidates lookup="3815551234" result={{ ok: true, data: { candidates: [CANDIDATE] } }} />);
    const list = screen.getByRole('list');
    const link = within(list).getByRole('link', { name: /Titular Real/ });
    expect(link.getAttribute('href')).toBe(`/admin/applicants/${CANDIDATE.courierId}`);
    expect(list.textContent).toContain('•••• 1234');
    expect(list.textContent).toContain('4 documentos');
    expect(list.textContent).not.toContain('3815551234');
  });

  it('sin coincidencias muestra un estado vacío', () => {
    render(<DisputeCandidates lookup="3815551234" result={{ ok: true, data: { candidates: [] } }} />);
    expect(screen.getByText('No hay cuentas pendientes sin enviar con ese dato.')).toBeDefined();
  });

  it('VALIDATION_ERROR pide un teléfono completo o el ID exacto', () => {
    render(<DisputeCandidates lookup="juan" result={{ ok: false, code: 'VALIDATION_ERROR' }} />);
    expect(screen.getByRole('alert').textContent).toBe('Ingresá un teléfono completo o el ID exacto de la cuenta.');
  });

  it('AAL2_REQUIRED muestra el mensaje del dominio', () => {
    render(<DisputeCandidates lookup="3815551234" result={{ ok: false, code: 'AAL2_REQUIRED' }} />);
    expect(screen.getByRole('alert').textContent).toBe('Ingresá tu código de verificación en dos pasos para continuar.');
  });
});
