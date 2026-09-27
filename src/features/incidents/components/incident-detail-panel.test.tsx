// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { IncidentDetailPanel } from './incident-detail-panel';
import { resolveIncidentAction, suspendCourierForIncidentAction } from '../actions';
import type { IncidentDetail } from '../types';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  resolveIncidentAction: vi.fn(),
  suspendCourierForIncidentAction: vi.fn(),
}));

const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';
const COURIER_ID = 'c0000000-0000-4000-8000-000000000003';

const incident: IncidentDetail = {
  id: INCIDENT_ID,
  requestId: 'd0000000-0000-4000-8000-000000000001',
  kind: 'damaged_goods',
  description: 'La caja llegó abierta y faltaba una docena de facturas.',
  status: 'open',
  resolution: null,
  createdAt: '2026-09-27T12:00:00.000Z',
  reporterRole: 'merchant',
  reporterName: 'Panadería La Espiga',
  merchant: {
    id: 'f0000000-0000-4000-8000-00000000000a',
    name: 'Panadería La Espiga',
    phone: '3865551234',
  },
  courier: { id: COURIER_ID, name: 'Diego Santillán', phone: '3865112233' },
  courierSuspended: false,
  timeline: {
    publishedAt: '2026-09-27T10:00:00.000Z',
    matchedAt: '2026-09-27T10:05:00.000Z',
    pickedUpAt: '2026-09-27T10:20:00.000Z',
    deliveredAt: null,
  },
};

const REASON = 'Reclamo grave pendiente de revisión con ambas partes.';

describe('T-124: IncidentDetailPanel (A05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el relato, las partes con teléfono para llamar y la cronología del viaje', () => {
    render(<IncidentDetailPanel incident={incident} />);

    expect(screen.getByText(/faltaba una docena de facturas/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /llamar a panader[ií]a la espiga/i }).getAttribute('href')).toMatch(
      /^tel:/
    );
    expect(screen.getByRole('link', { name: /llamar a diego santill[aá]n/i }).getAttribute('href')).toMatch(
      /^tel:/
    );
    const times = Array.from(document.querySelectorAll('time')).map((node) => node.getAttribute('dateTime'));
    expect(times).toEqual(
      expect.arrayContaining([
        '2026-09-27T10:00:00.000Z',
        '2026-09-27T10:05:00.000Z',
        '2026-09-27T10:20:00.000Z',
      ])
    );
  });

  it('«Suspensión preventiva» exige confirmación: el clic solo abre el diálogo', async () => {
    render(<IncidentDetailPanel incident={incident} />);
    fireEvent.click(screen.getByRole('button', { name: /suspensi[oó]n preventiva/i }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(suspendCourierForIncidentAction).not.toHaveBeenCalled();
  });

  it('«Suspensión preventiva» exige motivo antes de suspender', async () => {
    render(<IncidentDetailPanel incident={incident} />);
    fireEvent.click(screen.getByRole('button', { name: /suspensi[oó]n preventiva/i }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar suspensi[oó]n/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(suspendCourierForIncidentAction).not.toHaveBeenCalled();
  });

  it('confirmada con motivo, suspende al instante al repartidor del viaje y refresca', async () => {
    vi.mocked(suspendCourierForIncidentAction).mockResolvedValue({
      ok: true,
      data: {
        courierId: COURIER_ID,
        status: 'suspended',
        withdrawnOffersCount: 1,
        deactivatedAt: '2026-09-27T12:05:00.000Z',
      },
    });
    render(<IncidentDetailPanel incident={incident} />);
    fireEvent.click(screen.getByRole('button', { name: /suspensi[oó]n preventiva/i }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar suspensi[oó]n/i }));

    await waitFor(() => {
      expect(suspendCourierForIncidentAction).toHaveBeenCalledWith({
        incidentId: INCIDENT_ID,
        courierId: COURIER_ID,
        reason: REASON,
      });
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('no ofrece suspender si no hay repartidor o ya está suspendido', () => {
    const { rerender } = render(<IncidentDetailPanel incident={{ ...incident, courier: null }} />);
    expect(screen.queryByRole('button', { name: /suspensi[oó]n preventiva/i })).toBeNull();

    rerender(<IncidentDetailPanel incident={{ ...incident, courierSuspended: true }} />);
    expect(screen.queryByRole('button', { name: /suspensi[oó]n preventiva/i })).toBeNull();
    expect(screen.getByText(/repartidor suspendido/i)).toBeTruthy();
  });

  it.each([
    { button: /resolver sin sanci[oó]n/i, decision: 'no_action' },
    { button: /advertencia/i, decision: 'warning' },
  ] as const)('$decision exige motivo y registra la decisión tipificada', async ({ button, decision }) => {
    vi.mocked(resolveIncidentAction).mockResolvedValue({
      ok: true,
      data: { incidentId: INCIDENT_ID },
    });
    render(<IncidentDetailPanel incident={incident} />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar/i }));
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(resolveIncidentAction).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(resolveIncidentAction).toHaveBeenCalledWith({
        incidentId: INCIDENT_ID,
        decision,
        reason: REASON,
      });
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('muestra el error del servidor sin refrescar', async () => {
    vi.mocked(resolveIncidentAction).mockResolvedValue({ ok: false, code: 'AAL2_REQUIRED' });
    render(<IncidentDetailPanel incident={incident} />);
    fireEvent.click(screen.getByRole('button', { name: /advertencia/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar/i }));

    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('un incidente cerrado muestra su resolución y no ofrece acciones', () => {
    render(
      <IncidentDetailPanel
        incident={{ ...incident, status: 'resolved', resolution: 'Advertencia registrada.' }}
      />
    );
    expect(screen.getByText(/advertencia registrada/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /resolver sin sanci[oó]n/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /suspensi[oó]n preventiva/i })).toBeNull();
  });
});
