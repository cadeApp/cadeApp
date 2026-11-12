// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DisputeCandidates } from './dispute-candidates';
import { findDisputeCandidatesAction, findDniReservationAction } from '../actions';

vi.mock('../actions', () => ({
  findDisputeCandidatesAction: vi.fn(),
  findDniReservationAction: vi.fn(),
}));

const CANDIDATE = {
  courierId: '20000000-0000-4000-8000-0000000050c7',
  displayName: 'Titular Real',
  phoneMasked: '•••• 1234',
  status: 'pending' as const,
  applicationSubmitted: false as const,
  documentsCount: 4,
};
const RESERVER_ID = '20000000-0000-4000-8000-0000000050c3';

function searchClaimant(value: string) {
  const form = screen.getByRole('form', { name: 'Buscar al reclamante' });
  fireEvent.change(within(form).getByLabelText('Teléfono completo o ID de la cuenta'), { target: { value } });
  fireEvent.submit(form);
}

function searchReservation(value: string) {
  const form = screen.getByRole('form', { name: 'Buscar quién reservó el DNI' });
  fireEvent.change(within(form).getByLabelText('DNI verificado del titular'), { target: { value } });
  fireEvent.submit(form);
}

describe('CC-050 (D4-B, PR711-H02/H03): DisputeCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('los dos formularios son POST, sin campo q ni action con querystring', () => {
    const { container } = render(<DisputeCandidates />);
    const forms = container.querySelectorAll('form');
    expect(forms).toHaveLength(2);
    for (const form of forms) {
      expect(form.getAttribute('method')?.toLowerCase()).toBe('post');
      expect(form.getAttribute('action') ?? '').not.toContain('?');
    }
    expect(container.querySelector('[name="q"]')).toBeNull();
  });

  it('busca al reclamante con la server action y lista con enlace al detalle, sin repetir el teléfono', async () => {
    vi.mocked(findDisputeCandidatesAction).mockResolvedValue({ ok: true, data: { candidates: [CANDIDATE] } });
    render(<DisputeCandidates />);

    searchClaimant('3815551234');

    await waitFor(() => expect(findDisputeCandidatesAction).toHaveBeenCalledWith({ lookup: '3815551234' }));
    const list = await screen.findByRole('list');
    const link = within(list).getByRole('link', { name: /Titular Real/ });
    expect(link.getAttribute('href')).toBe(`/admin/applicants/${CANDIDATE.courierId}`);
    expect(list.textContent).toContain('•••• 1234');
    expect(list.textContent).toContain('4 documentos');
    expect(list.textContent).not.toContain('3815551234');
  });

  it('sin coincidencias muestra el estado vacío del reclamante', async () => {
    vi.mocked(findDisputeCandidatesAction).mockResolvedValue({ ok: true, data: { candidates: [] } });
    render(<DisputeCandidates />);
    searchClaimant('3815551234');
    expect(await screen.findByText('No hay cuentas pendientes sin enviar con ese dato.')).toBeDefined();
  });

  it('VALIDATION_ERROR del reclamante pide un teléfono completo o el ID exacto', async () => {
    vi.mocked(findDisputeCandidatesAction).mockResolvedValue({ ok: false, code: 'VALIDATION_ERROR' });
    render(<DisputeCandidates />);
    searchClaimant('juan');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ingresá un teléfono completo o el ID exacto de la cuenta.'
    );
  });

  it('busca la reserva por DNI con la server action y enlaza a la cuenta, sin repetir el DNI', async () => {
    vi.mocked(findDniReservationAction).mockResolvedValue({
      ok: true,
      data: { reservation: { courierId: RESERVER_ID, status: 'approved' } },
    });
    const { container } = render(<DisputeCandidates />);

    searchReservation('38123456');

    await waitFor(() => expect(findDniReservationAction).toHaveBeenCalledWith({ dni: '38123456' }));
    const link = await screen.findByRole('link', { name: 'Ver la cuenta que lo reservó (Aprobado)' });
    expect(link.getAttribute('href')).toBe(`/admin/applicants/${RESERVER_ID}`);
    const result = screen.getByRole('region', { name: 'Resultado de la reserva' });
    expect(result.textContent).not.toContain('38123456');
    expect(container.innerHTML).not.toMatch(/[0-9a-f]{64}/);
    // Nunca libera sola: no hay acción de liberar en este resultado.
    expect(within(result).queryByRole('button')).toBeNull();
  });

  it('sin reserva muestra el estado vacío y con un DNI inválido pide 7 u 8 dígitos', async () => {
    vi.mocked(findDniReservationAction).mockResolvedValueOnce({ ok: true, data: { reservation: null } });
    render(<DisputeCandidates />);
    searchReservation('38123456');
    expect(await screen.findByText('Ninguna cuenta tiene reservado ese DNI.')).toBeDefined();

    vi.mocked(findDniReservationAction).mockResolvedValueOnce({ ok: false, code: 'VALIDATION_ERROR' });
    searchReservation('12');
    expect((await screen.findByRole('alert')).textContent).toBe('Ingresá un DNI de 7 u 8 dígitos.');
  });

  it('AAL2_REQUIRED muestra el mensaje del dominio', async () => {
    vi.mocked(findDniReservationAction).mockResolvedValue({ ok: false, code: 'AAL2_REQUIRED' });
    render(<DisputeCandidates />);
    searchReservation('38123456');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Ingresá tu código de verificación en dos pasos para continuar.'
    );
  });
});
