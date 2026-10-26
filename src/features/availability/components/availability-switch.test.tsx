// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilitySwitch } from './availability-switch';

const mocks = vi.hoisted(() => ({
  setAvailabilityAction: vi.fn(),
  courierHeartbeatAction: vi.fn(),
}));

vi.mock('../actions', () => ({
  setAvailabilityAction: mocks.setAvailabilityAction,
  courierHeartbeatAction: mocks.courierHeartbeatAction,
}));

vi.mock('@/ui/notify', () => {
  throw new Error('notify chunk failed');
});

describe('PR87-R06: AvailabilitySwitch no depende de notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it('revierte el switch cuando la action falla aunque notify no cargue', async () => {
    mocks.setAvailabilityAction.mockResolvedValue({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    render(<AvailabilitySwitch initialAvailable={false} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('false');
      expect((toggle as HTMLButtonElement).disabled).toBe(false);
    });
  });

  it('conserva el éxito funcional cuando notify no cargue', async () => {
    mocks.setAvailabilityAction.mockResolvedValue({
      ok: true,
      data: { courierId: 'courier-1', available: true },
    });
    const onAvailabilityChange = vi.fn();

    render(
      <AvailabilitySwitch initialAvailable={false} onAvailabilityChange={onAvailabilityChange} />
    );

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('true');
      expect(onAvailabilityChange).toHaveBeenCalledWith(true);
      expect((toggle as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

describe('T-415: el interruptor manda la señal de presencia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.courierHeartbeatAction.mockResolvedValue({ ok: true, data: { lastSeenAt: '2026-10-26T12:00:00.000000Z' } });
  });
  afterEach(cleanup);

  it('disponible al entrar: manda la señal; no disponible: no', () => {
    render(<AvailabilitySwitch initialAvailable />);
    expect(mocks.courierHeartbeatAction).toHaveBeenCalledTimes(1);
    cleanup();
    vi.clearAllMocks();
    render(<AvailabilitySwitch initialAvailable={false} />);
    expect(mocks.courierHeartbeatAction).not.toHaveBeenCalled();
  });

  it('al prender «Disponible» manda la señal enseguida', async () => {
    mocks.setAvailabilityAction.mockResolvedValue({ ok: true, data: { courierId: 'c1', available: true } });
    render(<AvailabilitySwitch initialAvailable={false} />);
    fireEvent.click(screen.getByRole('switch'));
    await waitFor(() => expect(mocks.courierHeartbeatAction).toHaveBeenCalledTimes(1));
  });
});
