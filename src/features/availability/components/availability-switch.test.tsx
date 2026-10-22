// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AvailabilitySwitch } from './availability-switch';

const mocks = vi.hoisted(() => ({
  setAvailabilityAction: vi.fn(),
}));

vi.mock('../actions', () => ({
  setAvailabilityAction: mocks.setAvailabilityAction,
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
