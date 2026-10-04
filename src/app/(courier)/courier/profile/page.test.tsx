// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CourierProfileData, DocumentReviewStatus } from '@/features/courier-onboarding';

const mocks = vi.hoisted(() => ({
  CourierProfileView: vi.fn((_props: { profile: CourierProfileData | null }) => null),
  getUser: vi.fn(),
  from: vi.fn(),
  documents: [] as Array<{ kind: string; status: DocumentReviewStatus }>,
}));

vi.mock('@/features/courier-onboarding', () => ({
  CourierProfileView: mocks.CourierProfileView,
  combineDniDocumentStatus: vi.fn(() => 'none'),
}));
vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  })),
}));

import CourierProfilePage from './page';

async function renderPage() {
  render(await CourierProfilePage());
  expect(mocks.CourierProfileView).toHaveBeenCalledTimes(1);
  return mocks.CourierProfileView.mock.calls[0]?.[0].profile;
}

describe('Hotfix T-325: /courier/profile usa los documentos persistidos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documents = [];
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'courier-123', email: 'courier@example.test' } },
      error: null,
    });
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data:
            table === 'profiles'
              ? { display_name: 'Repartidor de prueba', role: 'courier' }
              : {
                  vehicle_type: 'motorcycle',
                  vehicle_plate: null,
                  license_status: 'none',
                  insurance_status: 'none',
                  status: 'pending',
                },
          error: null,
        }),
      };
      if (table === 'courier_documents') {
        query.eq.mockResolvedValue({ data: mocks.documents, error: null });
      } else if (table !== 'profiles' && table !== 'couriers') {
        throw new Error(`Tabla inesperada: ${table}`);
      }
      return query;
    });
  });
  afterEach(cleanup);

  it('licencia y seguro enviados llegan como submitted aunque el legajo siga en none', async () => {
    mocks.documents = [
      { kind: 'license', status: 'submitted' },
      { kind: 'insurance', status: 'submitted' },
    ];

    expect(await renderPage()).toMatchObject({
      licenseStatus: 'submitted',
      insuranceStatus: 'submitted',
    });
  });

  it('sin licencia ni seguro persistidos ambos estados son none', async () => {
    mocks.documents = [{ kind: 'selfie', status: 'submitted' }];

    expect(await renderPage()).toMatchObject({
      licenseStatus: 'none',
      insuranceStatus: 'none',
    });
  });

  it('una licencia verificada llega como verified', async () => {
    mocks.documents = [{ kind: 'license', status: 'verified' }];

    expect(await renderPage()).toMatchObject({ licenseStatus: 'verified' });
  });

  it('un seguro rechazado llega como rejected', async () => {
    mocks.documents = [{ kind: 'insurance', status: 'rejected' }];

    expect(await renderPage()).toMatchObject({ insuranceStatus: 'rejected' });
  });
});
