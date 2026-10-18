// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CourierProfileData, DocumentReviewStatus } from '@/features/courier-onboarding';

const mocks = vi.hoisted(() => ({
  CourierProfileView: vi.fn((_props: { profile: CourierProfileData | null }) => null),
  getCourierApprovedAvatarUrl: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  vehicleType: 'motorcycle' as string | null,
  courierStatus: 'pending' as string,
  documents: [] as Array<{ kind: string; status: DocumentReviewStatus }>,
}));

vi.mock('@/features/courier-onboarding', () => ({
  CourierProfileView: mocks.CourierProfileView,
  combineDniDocumentStatus: vi.fn(() => 'none'),
}));
vi.mock('@/features/courier-onboarding/server', () => ({
  getCourierApprovedAvatarUrl: mocks.getCourierApprovedAvatarUrl,
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
    mocks.vehicleType = 'motorcycle';
    mocks.courierStatus = 'pending';
    mocks.getCourierApprovedAvatarUrl.mockResolvedValue(
      'https://test-storage.local/courier-docs/avatar.jpg?token=valid'
    );
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
                  vehicle_type: mocks.vehicleType,
                  vehicle_plate: null,
                  license_status: 'none',
                  insurance_status: 'none',
                  status: mocks.courierStatus,
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
      onboardingComplete: true,
      licenseStatus: 'submitted',
      insuranceStatus: 'submitted',
    });
  });

  it('T-334: vehicle_type null indica onboarding incompleto', async () => {
    mocks.vehicleType = null;

    expect(await renderPage()).toMatchObject({ onboardingComplete: false });
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

  describe('T-356 / CC-025: Proyección de vigentes y motivos de rechazo', () => {
    it('ignora versiones históricas con is_current === false y proyecta la vigente', async () => {
      mocks.documents = [
        { kind: 'license', status: 'rejected', rejection_code: 'expired', is_current: false } as any,
        { kind: 'license', status: 'submitted', is_current: true } as any,
      ];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        licenseStatus: 'submitted',
        licenseRejectionMessage: null,
      });
    });

    it('proyecta dniFrontStatus y dniBackStatus de forma independiente', async () => {
      mocks.documents = [
        { kind: 'dni_front', status: 'verified', is_current: true } as any,
        { kind: 'dni_back', status: 'rejected', rejection_code: 'illegible', is_current: true } as any,
      ];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        dniFrontStatus: 'verified',
        dniFrontRejectionMessage: null,
        dniBackStatus: 'rejected',
        dniBackRejectionMessage: 'Documento borroso, ilegible o cortado.',
      });
    });

    it('proyecta mensaje seguro del catálogo y courierId', async () => {
      mocks.documents = [
        { kind: 'license', status: 'rejected', rejection_code: 'expired', is_current: true } as any,
      ];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        courierId: 'courier-123',
        licenseStatus: 'rejected',
        licenseRejectionMessage: 'Documento vencido o no vigente.',
      });
    });
  });

  describe('T-367: Proyección de avatar autorizado del repartidor', () => {
    it('proyecta avatarUrl firmada cuando el repartidor está aprobado y su avatar verificado', async () => {
      mocks.courierStatus = 'approved';
      mocks.documents = [{ kind: 'avatar', status: 'verified', is_current: true } as any];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        avatarUrl: 'https://test-storage.local/courier-docs/avatar.jpg?token=valid',
        avatarStatus: 'verified',
      });
      expect(mocks.getCourierApprovedAvatarUrl).toHaveBeenCalledWith('courier-123', expect.any(Object));
    });

    it('proyecta avatarUrl null cuando el repartidor está en estado pendiente', async () => {
      mocks.courierStatus = 'pending';
      mocks.documents = [{ kind: 'avatar', status: 'verified', is_current: true } as any];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        avatarUrl: null,
        avatarStatus: 'verified',
      });
      expect(mocks.getCourierApprovedAvatarUrl).not.toHaveBeenCalled();
    });

    it('proyecta avatarUrl null cuando el avatar está rechazado', async () => {
      mocks.courierStatus = 'approved';
      mocks.documents = [{ kind: 'avatar', status: 'rejected', is_current: true } as any];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        avatarUrl: null,
        avatarStatus: 'rejected',
      });
      expect(mocks.getCourierApprovedAvatarUrl).not.toHaveBeenCalled();
    });

    it('invariante de seguridad: jamás proyecta selfie ni DNI como avatarUrl ante ausencia de avatar', async () => {
      mocks.courierStatus = 'approved';
      mocks.documents = [
        { kind: 'selfie', status: 'verified', is_current: true } as any,
        { kind: 'dni_front', status: 'verified', is_current: true } as any,
      ];

      const profile = await renderPage();
      expect(profile).toMatchObject({
        avatarUrl: null,
        avatarStatus: 'none',
      });
      expect(mocks.getCourierApprovedAvatarUrl).not.toHaveBeenCalled();
    });

    it('proyecta avatarUrl null sin romper la página si getCourierApprovedAvatarUrl falla', async () => {
      mocks.courierStatus = 'approved';
      mocks.documents = [{ kind: 'avatar', status: 'verified', is_current: true } as any];
      mocks.getCourierApprovedAvatarUrl.mockRejectedValueOnce(new Error('Storage failure'));

      const profile = await renderPage();
      expect(profile).toMatchObject({
        avatarUrl: null,
        avatarStatus: 'verified',
      });
    });
  });
});

