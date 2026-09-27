// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReportIncidentButton } from './report-incident-button';
import { reportIncidentAction } from '../actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  reportIncidentAction: vi.fn(),
}));

const REQUEST_ID = 'd0000000-0000-4000-8000-000000000001';
const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * HOUR).toISOString();
}

async function openForm(): Promise<HTMLElement> {
  fireEvent.click(screen.getByRole('button', { name: /reportar un problema/i }));
  return screen.findByRole('dialog');
}

function chooseKind(dialog: HTMLElement, name: RegExp) {
  const option = within(dialog).getByRole('radio', { name });
  fireEvent.click(option);
  expect(option.getAttribute('aria-checked')).toBe('true');
}

describe('T-124: ReportIncidentButton (C06/R07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(['matched', 'in_transit'])('se muestra en un viaje %s', (tripStatus) => {
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus={tripStatus} deliveredAt={null} />);
    expect(screen.getByRole('button', { name: /reportar un problema/i })).toBeTruthy();
  });

  it('se muestra en un viaje entregado dentro de las 24 horas', () => {
    render(
      <ReportIncidentButton requestId={REQUEST_ID} tripStatus="delivered" deliveredAt={hoursAgo(2)} />
    );
    expect(screen.getByRole('button', { name: /reportar un problema/i })).toBeTruthy();
  });

  it.each([
    { tripStatus: 'delivered', deliveredAt: hoursAgo(30) },
    { tripStatus: 'cancelled', deliveredAt: null },
    { tripStatus: 'expired', deliveredAt: null },
  ])('no se muestra en $tripStatus fuera de ventana', ({ tripStatus, deliveredAt }) => {
    render(
      <ReportIncidentButton requestId={REQUEST_ID} tripStatus={tripStatus} deliveredAt={deliveredAt} />
    );
    expect(screen.queryByRole('button', { name: /reportar un problema/i })).toBeNull();
  });

  it('el formulario pide no incluir datos de contacto', async () => {
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus="matched" deliveredAt={null} />);
    const dialog = await openForm();
    expect(within(dialog).getByText(/no incluyas tel[eé]fonos/i)).toBeTruthy();
  });

  it('envía tipo y relato con el payload exacto', async () => {
    vi.mocked(reportIncidentAction).mockResolvedValue({
      ok: true,
      data: {
        incidentId: 'e0000000-0000-4000-8000-000000000002',
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus="in_transit" deliveredAt={null} />);

    const dialog = await openForm();
    chooseKind(dialog, /mercader[ií]a da[ñn]ada/i);
    fireEvent.change(within(dialog).getByLabelText(/qu[eé] pas[oó]/i), {
      target: { value: 'La caja llegó abierta y faltaba una docena de facturas.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    await waitFor(() => {
      expect(reportIncidentAction).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        kind: 'damaged_goods',
        description: 'La caja llegó abierta y faltaba una docena de facturas.',
      });
    });
    expect(await screen.findByText(/recibimos tu reporte/i)).toBeTruthy();
  });

  it('exige elegir el tipo antes de enviar', async () => {
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus="matched" deliveredAt={null} />);
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText(/qu[eé] pas[oó]/i), {
      target: { value: 'La caja llegó abierta y faltaba una docena de facturas.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it('exige un relato antes de enviar', async () => {
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus="matched" deliveredAt={null} />);
    const dialog = await openForm();
    chooseKind(dialog, /problema con el cobro/i);
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it('bloquea un relato con teléfono y no lo envía', async () => {
    render(<ReportIncidentButton requestId={REQUEST_ID} tripStatus="matched" deliveredAt={null} />);
    const dialog = await openForm();
    chooseKind(dialog, /problema con el cobro/i);
    fireEvent.change(within(dialog).getByLabelText(/qu[eé] pas[oó]/i), {
      target: { value: 'Llamame al 3865 44-1122 para ver qué pasó con el cobro.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor y deja el formulario abierto', async () => {
    vi.mocked(reportIncidentAction).mockResolvedValue({
      ok: false,
      code: 'INCIDENT_WINDOW_EXPIRED',
    });
    render(
      <ReportIncidentButton requestId={REQUEST_ID} tripStatus="delivered" deliveredAt={hoursAgo(1)} />
    );
    const dialog = await openForm();
    chooseKind(dialog, /otro/i);
    fireEvent.change(within(dialog).getByLabelText(/qu[eé] pas[oó]/i), {
      target: { value: 'El destinatario dijo que no recibió la bolsa completa.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/recibimos tu reporte/i)).toBeNull();
  });
});
