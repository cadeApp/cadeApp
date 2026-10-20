import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import { createFakeRpcClient, type FakePlatformSettings } from './testing/rpc-fake';

const SETTINGS: FakePlatformSettings = {
  minOfferArs: 1200,
  maxOffersPerMin: 10,
  maxRequestPublicationsPerMin: 10,
  maxIncidentsPerMin: 5,
  requestTtlMinutes: 25,
  pilotActive: true,
  pilotTermsVersion: 'v1.0',
  subscriptionGraceDays: 3,
};

const COURIER_ID = '20000000-0000-4000-8000-0000000033c1';

describe('CC-033 — contrato de alta posterior de documentos opcionales', () => {
  it('registra add_courier_optional_document y limita el alta a licencia o seguro', () => {
    expect(ALL_RPC_NAMES).toContain('add_courier_optional_document');
    expect(RPC_CONTRACTS).toHaveProperty('add_courier_optional_document');
  });
});

describe('CC-033 — FakeRpcClient add_courier_optional_document', () => {
  it('permite a un courier con onboarding completo dar de alta una licencia y la deja submitted', async () => {
    const storagePath = `courier/${COURIER_ID}/license_1730000000000.jpg`;
    const client = createFakeRpcClient({
      settings: SETTINGS,
      initialActor: { userId: COURIER_ID, role: 'courier', aal: 'aal1' },
      initialCouriers: [
        {
          courierId: COURIER_ID,
          status: 'pending',
          available: false,
          vehicleType: 'moto',
          licenseStatus: 'none',
        },
      ],
      initialStoragePaths: [storagePath],
    });

    const result = await client.add_courier_optional_document({
      kind: 'license',
      storagePath,
    });

    expect(result).toMatchObject({
      ok: true,
      data: {
        kind: 'license',
        status: 'submitted',
        isCurrent: true,
        idempotent: false,
      },
    });
    expect(client.getCourier(COURIER_ID)?.licenseStatus).toBe('submitted');
  });
});
