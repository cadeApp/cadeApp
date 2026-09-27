// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { IncidentDecision } from '@/domain';
import { IncidentDetailPanel } from './incident-detail-panel';
import { resolveIncidentAction } from '../actions';
import type { IncidentDetail } from '../types';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  resolveIncidentAction: vi.fn(),
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
    cancelledAt: null,
  },
};

const REASON = 'Reclamo grave pendiente de revisión con ambas partes.';

const DECISION_CASES = [
  { decision: 'no_action', button: /resolver sin sanci[oó]n/i, confirm: /confirmar resoluci[oó]n/i },
  { decision: 'warning', button: /advertencia/i, confirm: /confirmar advertencia/i },
  {
    decision: 'preventive_suspension',
    button: /suspensi[oó]n preventiva/i,
    confirm: /confirmar suspensi[oó]n/i,
  },
] as const satisfies readonly { decision: IncidentDecision; button: RegExp; confirm: RegExp }[];

function okResult(decision: IncidentDecision) {
  return {
    ok: true as const,
    data: {
      incidentId: INCIDENT_ID,
      status: decision === 'no_action' ? ('dismissed' as const) : ('resolved' as const),
      decision,
      courierId: decision === 'preventive_suspension' ? COURIER_ID : null,
      withdrawnOffersCount: decision === 'preventive_suspension' ? 1 : 0,
    },
  };
}

async function openDecision(button: RegExp): Promise<{ trigger: HTMLElement; dialog: HTMLElement }> {
  const trigger = screen.getByRole('button', { name: button });
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  return { trigger, dialog };
}

describe('T-124: IncidentDetailPanel (A05)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra el relato, las partes con teléfono para llamar y la cronología del viaje', () => {
    render(<IncidentDetailPanel incident={incident} />);

    expect(screen.getByRole('heading', { level: 1, name: /mercader[ií]a da[ñn]ada/i })).toBeTruthy();
    expect(screen.getByText(/faltaba una docena de facturas/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /llamar a panader[ií]a la espiga/i }).getAttribute('href')).toBe(
      'tel:3865551234'
    );
    expect(screen.getByRole('link', { name: /llamar a diego santill[aá]n/i }).getAttribute('href')).toBe(
      'tel:3865112233'
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

  it('ofrece las tres resoluciones de A05 en un incidente abierto', () => {
    render(<IncidentDetailPanel incident={incident} />);
    for (const { button } of DECISION_CASES) {
      expect(screen.getByRole('button', { name: button })).toBeTruthy();
    }
  });

  it('no ofrece suspender si no hay repartidor o ya está suspendido', () => {
    const { rerender } = render(<IncidentDetailPanel incident={{ ...incident, courier: null }} />);
    expect(screen.queryByRole('button', { name: /suspensi[oó]n preventiva/i })).toBeNull();

    rerender(<IncidentDetailPanel incident={{ ...incident, courierSuspended: true }} />);
    expect(screen.queryByRole('button', { name: /suspensi[oó]n preventiva/i })).toBeNull();
    expect(screen.getByText(/repartidor suspendido/i)).toBeTruthy();
  });

  it.each(['resolved', 'dismissed'] as const)(
    'un incidente %s muestra su estado final y su resolución, sin acciones',
    (status) => {
      render(
        <IncidentDetailPanel
          incident={{ ...incident, status, resolution: 'warning: Advertencia registrada.' }}
        />
      );
      expect(screen.getByText(/advertencia registrada/i)).toBeTruthy();
      expect(screen.getByText(status === 'resolved' ? /^resuelto$/i : /cerrado sin sanci[oó]n/i)).toBeTruthy();
      for (const { button } of DECISION_CASES) {
        expect(screen.queryByRole('button', { name: button })).toBeNull();
      }
    }
  );

  it('no muestra datos del destinatario', () => {
    render(<IncidentDetailPanel incident={incident} />);
    expect(document.body.textContent ?? '').not.toMatch(/destinatari|recipient/i);
  });
});

describe('PR113-H07/H08: Dialogs de resolución de A05', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(DECISION_CASES)('$decision: el clic solo abre un Dialog titulado y descripto', async ({ button }) => {
    render(<IncidentDetailPanel incident={incident} />);
    const { dialog } = await openDecision(button);

    expect(within(dialog).getByRole('heading')).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
    expect(resolveIncidentAction).not.toHaveBeenCalled();
  });

  it.each(DECISION_CASES)('$decision exige motivo antes de llamar a la action', async ({ button, confirm }) => {
    render(<IncidentDetailPanel incident={incident} />);
    const { dialog } = await openDecision(button);

    fireEvent.click(within(dialog).getByRole('button', { name: confirm }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/motivo/i);
    expect(resolveIncidentAction).not.toHaveBeenCalled();
  });

  it.each(DECISION_CASES)(
    '$decision confirmado llama a resolveIncidentAction con { incidentId, decision, reason } y refresca',
    async ({ decision, button, confirm }) => {
      vi.mocked(resolveIncidentAction).mockResolvedValue(okResult(decision));
      render(<IncidentDetailPanel incident={incident} />);
      const { dialog } = await openDecision(button);

      fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
      fireEvent.click(within(dialog).getByRole('button', { name: confirm }));

      await waitFor(() => expect(resolveIncidentAction).toHaveBeenCalledTimes(1));
      expect(resolveIncidentAction).toHaveBeenCalledWith({ incidentId: INCIDENT_ID, decision, reason: REASON });
      expect(vi.mocked(resolveIncidentAction).mock.calls[0]?.[0]).not.toHaveProperty('courierId');
      await waitFor(() => expect(refresh).toHaveBeenCalled());
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    }
  );

  it('mientras resuelve, deshabilita confirmar y cancelar', async () => {
    let resolveAction: (value: Awaited<ReturnType<typeof resolveIncidentAction>>) => void = () => undefined;
    vi.mocked(resolveIncidentAction).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    render(<IncidentDetailPanel incident={incident} />);
    const { dialog } = await openDecision(/advertencia/i);
    fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar advertencia/i }));

    const processing = await within(dialog).findByRole('button', { name: /procesando/i });
    expect(processing).toHaveProperty('disabled', true);
    expect(processing.getAttribute('aria-busy')).toBe('true');
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toHaveProperty('disabled', true);

    resolveAction(okResult('warning'));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('muestra el error del servidor dentro del Dialog sin refrescar', async () => {
    vi.mocked(resolveIncidentAction).mockResolvedValue({ ok: false, code: 'AAL2_REQUIRED' });
    render(<IncidentDetailPanel incident={incident} />);
    const { dialog } = await openDecision(/advertencia/i);
    fireEvent.change(within(dialog).getByLabelText(/motivo/i), { target: { value: REASON } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirmar advertencia/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/verificaci[oó]n en dos pasos/i);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it.each(DECISION_CASES)(
    '$decision: Escape cierra el Dialog y el foco vuelve al mismo botón',
    async ({ button }) => {
      render(<IncidentDetailPanel incident={incident} />);
      const { trigger, dialog } = await openDecision(button);

      fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  );

  it.each(DECISION_CASES)(
    '$decision: Cancelar cierra el Dialog y el foco vuelve al mismo botón',
    async ({ button }) => {
      render(<IncidentDetailPanel incident={incident} />);
      const { trigger, dialog } = await openDecision(button);

      fireEvent.click(within(dialog).getByRole('button', { name: /cancelar/i }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    }
  );
});
