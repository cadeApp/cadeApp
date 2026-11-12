// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import DisputesPage from './page';

const mocks = vi.hoisted(() => ({
  getDisputeCandidates: vi.fn(),
  DisputeCandidates: vi.fn((_props: Record<string, unknown>) => <div data-testid="dispute-candidates" />),
}));

vi.mock('@/features/admin/server', () => ({ getDisputeCandidates: mocks.getDisputeCandidates }));
vi.mock('@/features/admin', () => ({ DisputeCandidates: mocks.DisputeCandidates }));

describe('CC-050 (D4-B): /admin/applicants/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin q no busca y pasa result null', async () => {
    render(await DisputesPage({ searchParams: Promise.resolve({}) }));
    expect(mocks.getDisputeCandidates).not.toHaveBeenCalled();
    expect(mocks.DisputeCandidates.mock.calls[0]?.[0]).toMatchObject({ lookup: null, result: null });
  });

  it('con q busca en el servidor y pasa el resultado', async () => {
    const result = { ok: true, data: { candidates: [] } };
    mocks.getDisputeCandidates.mockResolvedValue(result);

    render(await DisputesPage({ searchParams: Promise.resolve({ q: ' 3815551234 ' }) }));

    expect(mocks.getDisputeCandidates).toHaveBeenCalledWith('3815551234');
    expect(mocks.DisputeCandidates.mock.calls[0]?.[0]).toMatchObject({ lookup: '3815551234', result });
  });
});
