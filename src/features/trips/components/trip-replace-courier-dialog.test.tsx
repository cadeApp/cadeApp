// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { getDomainErrorMessage } from '@/lib/error-messages';
import type { TripDetails } from '../types';
import { TripReplaceCourierDialog } from './trip-replace-courier-dialog';
import { TripMerchantContainer } from './trip-merchant-container';
import { TripMerchantView } from './trip-merchant-view';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  republishTripAction: vi.fn(),
  merchantReportNoShowAction: vi.fn(),
  merchantCancelTripAction: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('../actions', () => ({
  republishTripAction: mocks.republishTripAction,
  merchantReportNoShowAction: mocks.merchantReportNoShowAction,
  merchantCancelTripAction: mocks.merchantCancelTripAction,
}));
vi.mock('@/ui/notify', () => ({
  notify: { success: mocks.notifySuccess, error: mocks.notifyError, info: vi.fn() },
}));
vi.mock('@vis.gl/react-google-maps', () => ({
  APILoadingStatus: { NOT_LOADED: 'NOT_LOADED', LOADING: 'LOADING', LOADED: 'LOADED', FAILED: 'FAILED' },
  useApiLoadingStatus: () => 'LOADED',
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => null,
}));

const REQUEST_ID = '30000000-0000-4000-8000-000000000369';
const trip: TripDetails = {
  id: REQUEST_ID,
  code: 'REQ-0369',
  status: 'matched',
  merchantId: 'merchant-1',
  merchantName: 'Kiosco Centro',
  merchantPhone: '3865222222',
  courierId: 'courier-1',
  courierName: 'Carlos Benítez',
  courierPhone: '3865111111',
  vehicleType: 'moto',
  licensePlate: 'AB 123 CD',
  avatarUrl: null,
  amountArs: 1800,
  pickupAddress: 'San Martín 450, Centro',
  pickupZoneName: 'Centro',
  dropoffAddress: 'Belgrano 1220, Aguilares',
  dropoffZoneName: 'Barrio Sur',
  deliveryNotes: null,
  recipientName: 'Laura Gómez',
  recipientPhone: '3865123456',
  recipientPaymentMethod: 'cash',
  needsChange: false,
  cashChangeAmount: null,
  createdAt: '2026-10-17T10:00:00Z',
  matchedAt: '2026-10-17T10:05:00Z',
  pickedUpAt: null,
  deliveredAt: null,
};

describe('T-369 / CC-029 D-C2b — diálogo de «sacar al repartidor»', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('avisa del crédito, ofrece reportar que no se presentó y pide una segunda confirmación', () => {
    const onConfirmReplace = vi.fn();
    const onReportNoShow = vi.fn();
    render(
      <TripReplaceCourierDialog
        open
        onOpenChange={vi.fn()}
        onConfirmReplace={onConfirmReplace}
        onReportNoShow={onReportNoShow}
      />
    );
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/se usa otro crédito y el de esta asignación no se devuelve/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reportar que no se presentó' }));
    expect(onReportNoShow).toHaveBeenCalledTimes(1);
    expect(onConfirmReplace).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Sacar y republicar' }));
    expect(onConfirmReplace).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '¿Confirmás que querés sacarlo y republicar?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reportar que no se presentó' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, sacar y republicar' }));
    expect(onConfirmReplace).toHaveBeenCalledTimes(1);
  });

  it('mientras republica no se puede cerrar ni repetir la acción', () => {
    const onOpenChange = vi.fn();
    render(
      <TripReplaceCourierDialog
        open
        isPending
        onOpenChange={onOpenChange}
        onConfirmReplace={vi.fn()}
        onReportNoShow={vi.fn()}
      />
    );
    expect((screen.getByRole('button', { name: 'Reportando...' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Sacar y republicar' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('la vista solo ofrece cambiar de repartidor con la solicitud asignada', () => {
    const onReplaceCourier = vi.fn();
    render(<TripMerchantView trip={trip} onReplaceCourier={onReplaceCourier} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    expect(onReplaceCourier).toHaveBeenCalledTimes(1);
    cleanup();
    render(<TripMerchantView trip={{ ...trip, status: 'in_transit', pickedUpAt: '2026-10-17T10:20:00Z' }} onReplaceCourier={onReplaceCourier} />);
    expect(screen.queryByRole('button', { name: 'Cambiar de repartidor' })).toBeNull();
  });

  it('confirmar llama a republish_request una vez y lleva a la solicitud republicada', async () => {
    mocks.republishTripAction.mockResolvedValue({ ok: true, data: { requestId: REQUEST_ID } });
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sacar y republicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, sacar y republicar' }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/merchant/requests/${REQUEST_ID}`));
    expect(mocks.republishTripAction).toHaveBeenCalledTimes(1);
    expect(mocks.republishTripAction).toHaveBeenCalledWith({ requestId: REQUEST_ID, reason: null });
    expect(mocks.merchantReportNoShowAction).not.toHaveBeenCalled();
  });

  it('la alternativa reporta el no-show con republicación y no saca al repartidor', async () => {
    mocks.merchantReportNoShowAction.mockResolvedValue({ ok: true, data: {} });
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar que no se presentó' }));

    await waitFor(() => expect(mocks.merchantReportNoShowAction).toHaveBeenCalledWith({ requestId: REQUEST_ID, republish: true }));
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
  });

  it('si falla el reporte de no-show, el error queda en el diálogo, no republica y el reintento lo limpia', async () => {
    let resolveRetry: (value: { ok: true; data: Record<string, never> }) => void = () => undefined;
    mocks.merchantReportNoShowAction
      .mockResolvedValueOnce({ ok: false, code: 'INVALID_STATE_TRANSITION' })
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRetry = resolve; }));
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar que no se presentó' }));

    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert.textContent).toBe(getDomainErrorMessage('INVALID_STATE_TRANSITION'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reportar que no se presentó' }));
    await waitFor(() => expect(within(screen.getByRole('alertdialog')).queryByRole('alert')).toBeNull());
    resolveRetry({ ok: true, data: {} });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/merchant/requests/${REQUEST_ID}`));
    expect(mocks.merchantReportNoShowAction).toHaveBeenCalledTimes(2);
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
  });

  it('PR402-H02: si la acción de no-show se rechaza (red), el error queda en el diálogo sin cerrar ni republicar', async () => {
    mocks.merchantReportNoShowAction
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, data: {} });
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar que no se presentó' }));

    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert.textContent).toBe(getDomainErrorMessage('INTERNAL_ERROR'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(mocks.merchantReportNoShowAction).toHaveBeenCalledTimes(1);
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Reportar que no se presentó' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/merchant/requests/${REQUEST_ID}`));
    expect(mocks.merchantReportNoShowAction).toHaveBeenCalledTimes(2);
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
  });

  it('cerrar el diálogo tras un no-show fallido limpia el error', async () => {
    mocks.merchantReportNoShowAction.mockResolvedValue({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reportar que no se presentó' }));
    expect((await within(screen.getByRole('alertdialog')).findByRole('alert')).textContent).toBe(
      getDomainErrorMessage('INVALID_STATE_TRANSITION')
    );

    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Volver' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    const reopened = await screen.findByRole('alertdialog');
    expect(within(reopened).queryByRole('alert')).toBeNull();
    expect(mocks.republishTripAction).not.toHaveBeenCalled();
  });

  it('sin créditos, el rechazo queda visible en el diálogo con acceso a Mi plan y se puede reintentar', async () => {
    mocks.republishTripAction
      .mockResolvedValueOnce({ ok: false, code: 'PUBLICATION_CREDITS_EXHAUSTED' })
      .mockResolvedValueOnce({ ok: false, code: 'INVALID_STATE_TRANSITION' });
    render(<TripMerchantContainer trip={trip} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar de repartidor' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sacar y republicar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, sacar y republicar' }));

    const alert = await within(screen.getByRole('alertdialog')).findByRole('alert');
    expect(alert.textContent).toContain(getDomainErrorMessage('PUBLICATION_CREDITS_EXHAUSTED'));
    expect(within(alert).getByRole('link', { name: 'Ver mis créditos y planes' }).getAttribute('href')).toBe('/merchant/plan');
    expect(mocks.push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, sacar y republicar' }));
    await waitFor(() =>
      expect(within(screen.getByRole('alertdialog')).getByRole('alert').textContent).toContain(
        getDomainErrorMessage('INVALID_STATE_TRANSITION')
      )
    );
    expect(screen.queryByRole('link', { name: 'Ver mis créditos y planes' })).toBeNull();
    expect(mocks.republishTripAction).toHaveBeenCalledTimes(2);
  });
});
