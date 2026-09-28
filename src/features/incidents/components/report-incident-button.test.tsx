// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ReportIncidentButton, type ReportIncidentButtonProps } from './report-incident-button';
import { reportIncidentAction } from '../actions';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  reportIncidentAction: vi.fn(),
}));

// El Dialog y el formulario son chunks diferidos: se transforman una vez antes de las pruebas para que abrir el Dialog
// no dependa del tiempo de compilación en frío de Vitest.
beforeAll(async () => {
  await import('./report-incident-dialog');
  await import('./report-incident-form');
});

const REQUEST_ID = 'd0000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-09-27T15:00:00.000Z');
const HOUR = 60 * 60 * 1000;

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * HOUR).toISOString();
}

function renderButton(props: Partial<ReportIncidentButtonProps> = {}) {
  return render(
    <ReportIncidentButton
      requestId={REQUEST_ID}
      actorRole="merchant"
      tripStatus="matched"
      deliveredAt={null}
      {...props}
    />
  );
}

function reportTrigger() {
  return screen.queryByRole('button', { name: /reportar un problema/i });
}

async function openForm(): Promise<HTMLElement> {
  const trigger = reportTrigger();
  if (!trigger) throw new Error('El botón «Reportar un problema» no está visible');
  fireEvent.click(trigger);
  const dialog = await screen.findByRole('dialog');
  // El formulario se carga de forma diferida al abrir el Dialog.
  await within(dialog).findByRole('radiogroup');
  return dialog;
}

function chooseKind(dialog: HTMLElement, name: RegExp) {
  const option = within(dialog).getByRole('radio', { name });
  fireEvent.click(option);
  expect(option.getAttribute('aria-checked')).toBe('true');
}

function describeWhatHappened(dialog: HTMLElement, value: string) {
  fireEvent.change(within(dialog).getByLabelText(/qu[eé] pas[oó]/i), { target: { value } });
}

describe('PR113-H05: ReportIncidentButton aplica D05-A según actor, estado y entrega', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    { actorRole: 'merchant', tripStatus: 'matched', deliveredAt: null, visible: true },
    { actorRole: 'merchant', tripStatus: 'in_transit', deliveredAt: null, visible: true },
    { actorRole: 'merchant', tripStatus: 'delivered', deliveredAt: hoursAgo(2), visible: true },
    { actorRole: 'merchant', tripStatus: 'delivered', deliveredAt: hoursAgo(24), visible: true },
    { actorRole: 'merchant', tripStatus: 'delivered', deliveredAt: hoursAgo(24.01), visible: false },
    { actorRole: 'merchant', tripStatus: 'delivered', deliveredAt: hoursAgo(30), visible: false },
    { actorRole: 'merchant', tripStatus: 'delivered', deliveredAt: null, visible: false },
    { actorRole: 'merchant', tripStatus: 'cancelled', deliveredAt: null, visible: false },
    { actorRole: 'merchant', tripStatus: 'expired', deliveredAt: null, visible: false },
    { actorRole: 'merchant', tripStatus: 'published', deliveredAt: null, visible: false },
    { actorRole: 'courier', tripStatus: 'matched', deliveredAt: null, visible: true },
    { actorRole: 'courier', tripStatus: 'in_transit', deliveredAt: null, visible: true },
    { actorRole: 'courier', tripStatus: 'delivered', deliveredAt: hoursAgo(1), visible: false },
    { actorRole: 'courier', tripStatus: 'delivered', deliveredAt: hoursAgo(30), visible: false },
    { actorRole: 'courier', tripStatus: 'cancelled', deliveredAt: null, visible: false },
    { actorRole: 'admin', tripStatus: 'matched', deliveredAt: null, visible: false },
  ] as const)(
    '$actorRole en $tripStatus (entregado: $deliveredAt) → visible: $visible',
    ({ actorRole, tripStatus, deliveredAt, visible }) => {
      renderButton({
        actorRole: actorRole as ReportIncidentButtonProps['actorRole'],
        tripStatus,
        deliveredAt,
      });
      expect(reportTrigger() !== null).toBe(visible);
    }
  );
});

describe('ReportIncidentButton evalúa la ventana con el instante del servidor', () => {
  it('usa `now` en lugar del reloj local para que SSR e hidratación coincidan', () => {
    const serverNow = NOW.getTime();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(serverNow + 48 * HOUR));
    try {
      renderButton({ tripStatus: 'delivered', deliveredAt: hoursAgo(23), now: serverNow });
      expect(reportTrigger()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('T-124: formulario de ReportIncidentButton (C06/R07)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('abre un Dialog titulado que pide no incluir datos de contacto', async () => {
    renderButton();
    const dialog = await openForm();
    expect(within(dialog).getByRole('heading', { name: /reportar un problema/i })).toBeTruthy();
    expect(within(dialog).getByText(/no incluyas tel[eé]fonos/i)).toBeTruthy();
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('ofrece los tipos canónicos con etiquetas humanas', async () => {
    renderButton();
    const dialog = await openForm();
    const labels = within(dialog)
      .getAllByRole('radio')
      .map((option) => option.textContent?.trim());
    expect(labels).toEqual([
      'No se presentó',
      'Problema con el cobro',
      'Mercadería dañada',
      'Problema de seguridad',
      'Otro',
    ]);
  });

  it('al elegir «Problema de seguridad» avisa que no es atención inmediata y remite al 911', async () => {
    renderButton();
    const dialog = await openForm();
    expect(within(dialog).queryByText(/911/)).toBeNull();

    chooseKind(dialog, /problema de seguridad/i);

    expect(within(dialog).getByText(/llam[aá] al 911/i).textContent).toMatch(/no es atenci[oó]n inmediata/i);
  });

  it('envía tipo y relato con el payload exacto, cierra el Dialog y deja la confirmación en pantalla', async () => {
    vi.mocked(reportIncidentAction).mockResolvedValue({
      ok: true,
      data: {
        incidentId: 'e0000000-0000-4000-8000-000000000002',
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });
    renderButton({ actorRole: 'courier', tripStatus: 'in_transit' });

    const dialog = await openForm();
    chooseKind(dialog, /mercader[ií]a da[ñn]ada/i);
    describeWhatHappened(dialog, 'La caja llegó abierta y faltaba una docena de facturas.');
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    await waitFor(() => {
      expect(reportIncidentAction).toHaveBeenCalledWith({
        requestId: REQUEST_ID,
        kind: 'damaged_goods',
        description: 'La caja llegó abierta y faltaba una docena de facturas.',
      });
    });
    expect(reportIncidentAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('status').textContent).toMatch(/recibimos tu reporte/i);

    const reopened = await openForm();
    expect(within(reopened).getByLabelText(/qu[eé] pas[oó]/i)).toHaveProperty('value', '');
    expect(
      within(reopened)
        .getAllByRole('radio')
        .every((option) => option.getAttribute('aria-checked') === 'false')
    ).toBe(true);
  });

  it('mientras envía, deshabilita el envío y lo anuncia', async () => {
    let resolveAction: (value: Awaited<ReturnType<typeof reportIncidentAction>>) => void = () => undefined;
    vi.mocked(reportIncidentAction).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      })
    );
    renderButton();
    const dialog = await openForm();
    chooseKind(dialog, /otro/i);
    describeWhatHappened(dialog, 'El cliente dijo que la bolsa llegó incompleta.');
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    const submit = await within(dialog).findByRole('button', { name: /enviando reporte/i });
    expect(submit).toHaveProperty('disabled', true);
    expect(submit.getAttribute('aria-busy')).toBe('true');
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toHaveProperty('disabled', true);

    resolveAction({ ok: false, code: 'RATE_LIMITED' });
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
  });

  it('exige elegir el tipo antes de enviar', async () => {
    renderButton();
    const dialog = await openForm();
    describeWhatHappened(dialog, 'La caja llegó abierta y faltaba una docena de facturas.');
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/eleg[ií] qu[eé] tipo/i);
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it('exige un relato antes de enviar', async () => {
    renderButton();
    const dialog = await openForm();
    chooseKind(dialog, /problema con el cobro/i);
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/al menos 5/i);
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it.each([
    'Llamame al 3865 44-1122 para ver qué pasó con el cobro.',
    'Escribime a juan.perez@correo.com por el reclamo.',
  ])('bloquea un relato con datos de contacto y no lo envía: %s', async (description) => {
    renderButton();
    const dialog = await openForm();
    chooseKind(dialog, /problema con el cobro/i);
    describeWhatHappened(dialog, description);
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/datos de contacto/i);
    expect(reportIncidentAction).not.toHaveBeenCalled();
  });

  it('permite montos en el relato', async () => {
    vi.mocked(reportIncidentAction).mockResolvedValue({
      ok: true,
      data: {
        incidentId: 'e0000000-0000-4000-8000-000000000002',
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });
    renderButton();
    const dialog = await openForm();
    chooseKind(dialog, /problema con el cobro/i);
    describeWhatHappened(dialog, 'Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.');
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    await waitFor(() => expect(reportIncidentAction).toHaveBeenCalledTimes(1));
  });

  it('muestra el error de dominio y deja el formulario abierto', async () => {
    vi.mocked(reportIncidentAction).mockResolvedValue({
      ok: false,
      code: 'INCIDENT_WINDOW_EXPIRED',
    });
    renderButton({ tripStatus: 'delivered', deliveredAt: new Date(Date.now() - HOUR).toISOString() });
    const dialog = await openForm();
    chooseKind(dialog, /otro/i);
    describeWhatHappened(dialog, 'El destinatario dijo que no recibió la bolsa completa.');
    fireEvent.click(within(dialog).getByRole('button', { name: /enviar reporte/i }));

    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/tiempo l[ií]mite/i);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByText(/recibimos tu reporte/i)).toBeNull();
  });

  it('Escape cierra el Dialog y devuelve el foco al botón que lo abrió', async () => {
    renderButton();
    const trigger = reportTrigger();
    if (!trigger) throw new Error('sin botón');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape', code: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('Cancelar cierra el Dialog y devuelve el foco al botón que lo abrió', async () => {
    renderButton();
    const trigger = reportTrigger();
    if (!trigger) throw new Error('sin botón');
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(await within(dialog).findByRole('button', { name: /cancelar/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
