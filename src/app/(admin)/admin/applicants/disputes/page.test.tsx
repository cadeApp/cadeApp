// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from '@testing-library/react';
import DisputesPage from './page';

const mocks = vi.hoisted(() => ({
  DisputeCandidates: vi.fn((_props: Record<string, unknown>) => <div data-testid="dispute-candidates" />),
}));

vi.mock('@/features/admin', () => ({ DisputeCandidates: mocks.DisputeCandidates }));

describe('CC-050 (D4-B, PR711-H02): /admin/applicants/disputes', () => {
  it('dibuja las búsquedas sin props: nada sale de la URL', () => {
    render(<DisputesPage />);
    expect(mocks.DisputeCandidates).toHaveBeenCalledTimes(1);
    expect(mocks.DisputeCandidates.mock.calls[0]?.[0]).toEqual({});
  });

  it('la página no lee searchParams', () => {
    const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
    expect(source).not.toMatch(/searchParams/);
  });
});
