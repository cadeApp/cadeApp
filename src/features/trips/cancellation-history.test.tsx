// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import type { RequestCancellationHistory, RequestCancellationHistoryEvent } from '@/domain';
import { CancellationHistoryList } from './components/cancellation-history-list';
import { CourierCancelledAssignmentView } from './components/courier-cancelled-assignment-view';
import { CancellationHistoryCard } from './components/cancellation-history-card';
import { CancellationHistoryUnavailableError, selectCourierCancelledAssignment } from './cancellation-history-guard';

const mockLoadPage = vi.fn();
vi.mock('./actions', () => ({
  loadCancellationHistoryPageAction: (...args: unknown[]) => mockLoadPage(...args),
}));

const REQUEST_ID = '00000000-0000-4000-8000-000000037301';
const COURIER_ID = '00000000-0000-4000-8000-000000037311';

function event(n: number, overrides: Partial<RequestCancellationHistoryEvent> = {}): RequestCancellationHistoryEvent {
  return {
    id: `00000000-0000-4000-8000-0000000373${String(n).padStart(2, '0')}`,
    action: 'courier_cancel_match',
    actionLabel: 'Cancelado por el repartidor',
    category: 'vehicle_breakdown',
    categoryLabel: 'Problema con el vehículo',
    createdAt: `2026-10-18T2${n % 10}:30:00.000000+00:00`,
    actor: { id: COURIER_ID, role: 'courier', displayName: 'Juan P.' },
    offerId: null,
    rawReason: null,
    ...overrides,
  };
}

function history(
  events: RequestCancellationHistoryEvent[],
  nextCursor: RequestCancellationHistory['pagination']['nextCursor'] = null
): RequestCancellationHistory {
  return {
    version: '1.0',
    requestId: REQUEST_ID,
    events,
    pagination: { limit: 50, hasMore: nextCursor !== null, nextCursor },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('T-373 — CancellationHistoryList', () => {
  it('muestra cada evento con acción, motivo permitido, fecha/hora de Argentina y actor', () => {
    render(<CancellationHistoryList requestId={REQUEST_ID} initialEvents={[event(1)]} initialNextCursor={null} />);

    const item = within(screen.getByRole('list', { name: 'Historial de asignaciones' })).getByRole('listitem');
    expect(within(item).getByText('Cancelado por el repartidor')).toBeTruthy();
    expect(within(item).getByText('Problema con el vehículo')).toBeTruthy();
    const time = item.querySelector('time');
    expect(time?.getAttribute('dateTime')).toBe('2026-10-18T21:30:00.000000+00:00');
    expect(time?.textContent).toBe('18/10/2026 18:30');
    expect(item.textContent).toContain('Juan P.');
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('respeta el orden de la RPC (más reciente primero) y distingue actor y categoría de cada evento', () => {
    // El orden lo fija la RPC: created_at DESC, id DESC, con desempate por id probado en
    // supabase/tests/cc032_request_cancellation_history.sql («un empate exacto en created_at desempata por id desc»).
    // La UI no reordena: muestra exactamente la secuencia recibida.
    const courierB = { id: '00000000-0000-4000-8000-000000037312', role: 'courier' as const, displayName: 'Cadete B' };
    const newerB = event(2, { actor: courierB, category: 'personal_emergency', categoryLabel: 'Emergencia' });
    const olderA = event(1);
    render(<CancellationHistoryList requestId={REQUEST_ID} initialEvents={[newerB, olderA]} initialNextCursor={null} />);

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining('Emergencia'),
      expect.stringContaining('Problema con el vehículo'),
    ]);
    expect(items[0]?.textContent).toContain('Cadete B');
    expect(items[1]?.textContent).toContain('Juan P.');
  });

  it('no muestra identidad falsa si el perfil fue borrado y nunca renderiza el texto libre', () => {
    render(
      <CancellationHistoryList
        requestId={REQUEST_ID}
        initialEvents={[event(1, { actor: null, rawReason: 'texto privado del cadete' })]}
        initialNextCursor={null}
      />
    );

    expect(screen.getByText(/Repartidor no disponible/)).toBeTruthy();
    expect(screen.queryByText(/texto privado del cadete/)).toBeNull();
  });

  it('«Ver más» pide la página siguiente con el cursor keyset, agrega sin duplicar y se oculta al final', async () => {
    const cursor = { beforeCreatedAt: '2026-10-18T21:30:00.000000+00:00', beforeId: event(1).id };
    mockLoadPage.mockResolvedValue({ ok: true, data: history([event(1), event(2)]) });

    render(<CancellationHistoryList requestId={REQUEST_ID} initialEvents={[event(1)]} initialNextCursor={cursor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(mockLoadPage).toHaveBeenCalledExactlyOnceWith({ requestId: REQUEST_ID, cursor });
    expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
  });

  it('si falla la página siguiente avisa con role=alert, conserva lo cargado y permite reintentar', async () => {
    const cursor = { beforeCreatedAt: '2026-10-18T21:30:00.000000+00:00', beforeId: event(1).id };
    mockLoadPage.mockResolvedValueOnce({ ok: false, code: 'INTERNAL_ERROR' });

    render(<CancellationHistoryList requestId={REQUEST_ID} initialEvents={[event(1)]} initialNextCursor={cursor} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver más' }));

    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos cargar más eventos del historial.');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    mockLoadPage.mockRejectedValueOnce(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(mockLoadPage).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('T-373 — CancellationHistoryCard', () => {
  function renderCard(viewer: 'merchant' | 'courier', result: Parameters<typeof CancellationHistoryCard>[0]['result']) {
    return render(<CancellationHistoryCard requestId={REQUEST_ID} viewer={viewer} result={result} />);
  }

  it('comercio sin cancelaciones: estado vacío legible, sin sumar una región viva', () => {
    renderCard('merchant', { ok: true, data: history([]) });
    expect(screen.getByText('Ningún repartidor canceló una asignación de este pedido.')).toBeTruthy();
    // No agrega una región viva: la página ya tiene la suya (aviso offline, toasts).
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('comercio con cancelaciones: aclara que el pedido no se canceló y lista los eventos', () => {
    renderCard('merchant', { ok: true, data: history([event(2), event(1)]) });
    expect(screen.getByText(/Eso no cancela el pedido/)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('error de la RPC: alerta accesible, sin detalles internos', () => {
    renderCard('merchant', { ok: false, code: 'INTERNAL_ERROR' });
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos cargar el historial de asignaciones. Recargá la página para reintentar.'
    );
  });

  it('repartidor sin cancelaciones propias (NOT_FOUND) no ve nada', () => {
    const { container } = renderCard('courier', { ok: false, code: 'NOT_FOUND' });
    expect(container.innerHTML).toBe('');
  });

  it('repartidor con cancelaciones propias ve su cronología', () => {
    renderCard('courier', { ok: true, data: history([event(1)]) });
    expect(screen.getByText('Tus cancelaciones de asignación en este pedido.')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('T-373 / 5-A — CourierCancelledAssignmentView', () => {
  it('explica que la asignación se canceló sin cancelar el pedido, lista sus eventos y vuelve al feed', () => {
    render(<CourierCancelledAssignmentView requestId={REQUEST_ID} history={history([event(1)])} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Cancelaste esta asignación' })).toBeTruthy();
    expect(screen.getByText(/No es una cancelación del pedido/)).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Volver a pedidos disponibles' }).getAttribute('href')).toBe('/courier/feed');
  });
});

describe('T-373 / PR425-H04 — selectCourierCancelledAssignment (repartidor sin viaje visible)', () => {
  const ABSENT = 'ABSENT_404';
  const onAbsent = vi.fn((): never => {
    throw new Error(ABSENT);
  });

  it('historial con eventos propios: devuelve la cronología para «Cancelaste esta asignación»', () => {
    const data = history([event(1)]);
    expect(selectCourierCancelledAssignment({ ok: true, data }, onAbsent)).toBe(data);
    expect(onAbsent).not.toHaveBeenCalled();
  });

  it.each(['NOT_FOUND', 'UNAUTHORIZED_ACTOR', 'VALIDATION_ERROR', 'UNAUTHENTICATED'] as const)(
    '%s es ausencia: 404 fail-closed',
    (code) => {
      expect(() => selectCourierCancelledAssignment({ ok: false, code }, onAbsent)).toThrow(ABSENT);
    }
  );

  it('sin eventos propios también es ausencia: 404', () => {
    expect(() => selectCourierCancelledAssignment({ ok: true, data: history([]) }, onAbsent)).toThrow(ABSENT);
  });

  it('INTERNAL_ERROR no es ausencia: lanza un error sanitizado y nunca elige el 404', () => {
    let thrown: unknown;
    try {
      selectCourierCancelledAssignment({ ok: false, code: 'INTERNAL_ERROR' }, onAbsent);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(CancellationHistoryUnavailableError);
    expect((thrown as Error).message).toBe('CANCELLATION_HISTORY_UNAVAILABLE');
    expect(onAbsent).not.toHaveBeenCalled();
  });

  it('viaje actual válido + historial con INTERNAL_ERROR: el detalle sigue y la tarjeta del repartidor muestra el error acotado', () => {
    render(<CancellationHistoryCard requestId={REQUEST_ID} viewer="courier" result={{ ok: false, code: 'INTERNAL_ERROR' }} />);
    expect(screen.getByRole('alert').textContent).toBe(
      'No pudimos cargar el historial de asignaciones. Recargá la página para reintentar.'
    );
  });
});
