import { describe, expect, it, vi } from 'vitest';
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
  function createOptionalDocumentClient(options?: {
    readonly role?: 'courier' | 'merchant';
    readonly consentStatus?: 'active' | 'reconsent_required';
    readonly status?: 'pending' | 'approved' | 'rejected' | 'suspended';
    readonly vehicleType?: 'moto' | null;
    readonly documents?: Parameters<ReturnType<typeof createFakeRpcClient>['seedDocument']>[0][];
    readonly storagePaths?: readonly string[];
  }) {
    return createFakeRpcClient({
      settings: SETTINGS,
      initialActor: {
        userId: COURIER_ID,
        role: options?.role ?? 'courier',
        consentStatus: options?.consentStatus ?? 'active',
        aal: 'aal1',
      },
      initialCouriers: [
        {
          courierId: COURIER_ID,
          status: options?.status ?? 'pending',
          available: false,
          vehicleType: options?.vehicleType === undefined ? 'moto' : options.vehicleType,
          licenseStatus: 'none',
          insuranceStatus: 'none',
        },
      ],
      initialDocuments: options?.documents,
      initialStoragePaths: options?.storagePaths,
    });
  }

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

  it.each(['license', 'insurance'] as const)(
    'persiste una alta %s de courier approved y conserva la idempotencia en el reintento',
    async (kind) => {
      const storagePath = `courier/${COURIER_ID}/${kind}_1730000000011.jpg`;
      const documentId = '20000000-0000-4000-8000-0000000033d4';
      const client = createOptionalDocumentClient({
        status: 'approved',
        vehicleType: 'moto',
        storagePaths: [storagePath],
      });
      const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(documentId);

      try {
        const first = await client.add_courier_optional_document({ kind, storagePath });
        if (!first.ok) throw new Error('La primera alta de approved debe crear el documento');

        expect(first.data).toMatchObject({ documentId, kind, status: 'submitted', isCurrent: true, idempotent: false });
        expect(client.getDocument(documentId)).toMatchObject({
          courierId: COURIER_ID,
          kind,
          status: 'submitted',
          isCurrent: true,
          storagePath,
        });
        expect(client.getCourier(COURIER_ID)).toMatchObject(
          kind === 'license' ? { licenseStatus: 'submitted' } : { insuranceStatus: 'submitted' },
        );

        await expect(client.add_courier_optional_document({ kind, storagePath })).resolves.toMatchObject({
          ok: true,
          data: { documentId, idempotent: true },
        });
        expect(randomUuid).toHaveBeenCalledTimes(1);
      } finally {
        randomUuid.mockRestore();
      }
    },
  );

  it.each([
    { label: 'onboarding incompleto', status: 'pending' as const, vehicleType: null, code: 'INVALID_STATE_TRANSITION' },
    { label: 'repartidor rechazado', status: 'rejected' as const, vehicleType: 'moto' as const, code: 'UNAUTHORIZED_ACTOR' },
    { label: 'repartidor suspendido', status: 'suspended' as const, vehicleType: 'moto' as const, code: 'UNAUTHORIZED_ACTOR' },
  ])('rechaza $label sin crear el documento', async ({ status, vehicleType, code }) => {
    const storagePath = `courier/${COURIER_ID}/insurance_1730000000001.jpg`;
    const client = createOptionalDocumentClient({ status, vehicleType, storagePaths: [storagePath] });

    await expect(client.add_courier_optional_document({ kind: 'insurance', storagePath })).resolves.toMatchObject({
      ok: false,
      code,
    });
    expect(client.getCourier(COURIER_ID)?.insuranceStatus).toBe('none');
  });

  it.each([
    { label: 'merchant', role: 'merchant' as const, consentStatus: 'active' as const },
    { label: 'courier con reconsent requerido', role: 'courier' as const, consentStatus: 'reconsent_required' as const },
  ])('rechaza $label sin cambiar el courier ni crear un documento', async ({ role, consentStatus }) => {
    const storagePath = `courier/${COURIER_ID}/insurance_1730000000012.jpg`;
    const documentId = '20000000-0000-4000-8000-0000000033d5';
    const client = createOptionalDocumentClient({ role, consentStatus, storagePaths: [storagePath] });
    const randomUuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(documentId);

    try {
      await expect(client.add_courier_optional_document({ kind: 'insurance', storagePath })).resolves.toMatchObject({
        ok: false,
        code: 'UNAUTHORIZED_ACTOR',
      });
      expect(randomUuid).not.toHaveBeenCalled();
      expect(client.getDocument(documentId)).toBeUndefined();
      expect(client.getCourier(COURIER_ID)?.insuranceStatus).toBe('none');
    } finally {
      randomUuid.mockRestore();
    }
  });

  it('valida el path, comprueba Storage y conserva los códigos observables', async () => {
    const validPath = `courier/${COURIER_ID}/insurance_1730000000002.jpg`;
    const uppercasePath = `courier/${COURIER_ID}/insurance_1730000000002.PNG`;
    const client = createOptionalDocumentClient({ storagePaths: [uppercasePath] });

    await expect(
      client.add_courier_optional_document({ kind: 'insurance', storagePath: `courier/other/insurance_1730000000002.jpg` }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    await expect(
      client.add_courier_optional_document({ kind: 'insurance', storagePath: `courier/${COURIER_ID}/insurance_../x.jpg` }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    await expect(
      client.add_courier_optional_document({ kind: 'insurance', storagePath: `courier/${COURIER_ID}/insurance_1730000000002.exe` }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    await expect(
      client.add_courier_optional_document({ kind: 'insurance', storagePath: uppercasePath }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    await expect(client.add_courier_optional_document({ kind: 'insurance', storagePath: validPath })).resolves.toMatchObject({
      ok: false,
      code: 'NOT_FOUND',
    });
    expect(client.getCourier(COURIER_ID)?.insuranceStatus).toBe('none');
  });

  it('es idempotente con la misma clave o el mismo path submitted, sin aceptar otro path', async () => {
    const storagePath = `courier/${COURIER_ID}/insurance_1730000000003.jpg`;
    const otherPath = `courier/${COURIER_ID}/insurance_1730000000004.jpg`;
    const idempotencyKey = '20000000-0000-4000-8000-0000000033d1';
    const client = createOptionalDocumentClient({ storagePaths: [storagePath, otherPath] });

    const first = await client.add_courier_optional_document({ kind: 'insurance', storagePath, idempotencyKey });
    if (!first.ok) throw new Error('La primera alta debe crear el documento');
    const retry = await client.add_courier_optional_document({ kind: 'insurance', storagePath, idempotencyKey });

    expect(retry).toMatchObject({ ok: true, data: { documentId: first.data.documentId, idempotent: true } });
    await expect(
      client.add_courier_optional_document({ kind: 'insurance', storagePath: otherPath, idempotencyKey }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });

    const noKeyRetry = await client.add_courier_optional_document({ kind: 'insurance', storagePath });
    expect(noKeyRetry).toMatchObject({ ok: true, data: { documentId: first.data.documentId, idempotent: true } });
  });

  it.each(['submitted', 'verified', 'rejected'] as const)(
    'rechaza un documento vigente %s de otro path',
    async (status) => {
      const currentPath = `courier/${COURIER_ID}/license_1730000000005.jpg`;
      const nextPath = `courier/${COURIER_ID}/license_1730000000006.jpg`;
      const client = createOptionalDocumentClient({
        documents: [
          {
            documentId: '20000000-0000-4000-8000-0000000033d2',
            courierId: COURIER_ID,
            kind: 'license',
            status,
            isCurrent: true,
            storagePath: currentPath,
          },
        ],
        storagePaths: [currentPath, nextPath],
      });

      await expect(client.add_courier_optional_document({ kind: 'license', storagePath: nextPath })).resolves.toMatchObject({
        ok: false,
        code: 'INVALID_STATE_TRANSITION',
      });
    },
  );
});
