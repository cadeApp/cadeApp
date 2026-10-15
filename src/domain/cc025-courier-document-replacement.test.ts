import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';
import {
  type FakePlatformSettings,
  createFakeRpcClient,
} from './testing/rpc-fake';

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

const COURIER_ID = '20000000-0000-4000-8000-0000000025c1';
const OTHER_COURIER_ID = '20000000-0000-4000-8000-0000000025c2';
const ADMIN_ID = '90000000-0000-4000-8000-0000000025a1';
const DOC_REJECTED_ID = '30000000-0000-4000-8000-0000000025d1';
const DOC_VERIFIED_ID = '30000000-0000-4000-8000-0000000025d2';

function setupClient(actorUserId = COURIER_ID, role: 'courier' | 'merchant' | 'admin' | null = 'courier') {
  return createFakeRpcClient({
    settings: SETTINGS,
    initialActor: { userId: actorUserId, role, aal: role === 'admin' ? 'aal2' : 'aal1' },
    initialCouriers: [
      {
        courierId: COURIER_ID,
        status: 'pending',
        available: false,
        licenseStatus: 'rejected',
        insuranceStatus: 'verified',
      },
    ],
    initialDocuments: [
      {
        documentId: DOC_REJECTED_ID,
        courierId: COURIER_ID,
        kind: 'license',
        status: 'rejected',
        isCurrent: true,
        rejectionCode: 'illegible',
        storagePath: `courier/${COURIER_ID}/license_old.jpg`,
      },
      {
        documentId: DOC_VERIFIED_ID,
        courierId: COURIER_ID,
        kind: 'insurance',
        status: 'verified',
        isCurrent: true,
        storagePath: `courier/${COURIER_ID}/insurance_valid.jpg`,
      },
    ],
  });
}

describe('CC-025 — Contratos RPC de reemplazo transaccional de documentos', () => {
  it('registra replace_courier_document en ALL_RPC_NAMES con sus errorCodes canónicos', () => {
    expect(ALL_RPC_NAMES).toContain('replace_courier_document');
    expect(RPC_CONTRACTS.replace_courier_document.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'INVALID_STATE_TRANSITION',
      'VALIDATION_ERROR',
    ]);
  });

  it('valida input schemas para replace_courier_document', () => {
    const valid = RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse({
      kind: 'license',
      storagePath: `courier/${COURIER_ID}/license_123.jpg`,
    });
    expect(valid.success).toBe(true);

    const invalidKind = RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse({
      kind: 'passport',
      storagePath: `courier/${COURIER_ID}/passport.jpg`,
    });
    expect(invalidKind.success).toBe(false);

    const emptyPath = RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse({
      kind: 'license',
      storagePath: '',
    });
    expect(emptyPath.success).toBe(false);
  });

  it('valida input y output schemas para admin_verify_document con rejectionCode', () => {
    const validReject = RPC_CONTRACTS.admin_verify_document.inputSchema.safeParse({
      documentId: DOC_REJECTED_ID,
      decision: 'rejected',
      reason: 'Borroso',
      rejectionCode: 'illegible',
    });
    expect(validReject.success).toBe(true);

    const invalidCode = RPC_CONTRACTS.admin_verify_document.inputSchema.safeParse({
      documentId: DOC_REJECTED_ID,
      decision: 'rejected',
      reason: 'Borroso',
      rejectionCode: 'invalid_code',
    });
    expect(invalidCode.success).toBe(false);
  });
});

describe('CC-025 — FakeRpcClient replace_courier_document', () => {
  it('rechaza llamadas no autenticadas', async () => {
    const client = createFakeRpcClient({
      settings: SETTINGS,
      initialActor: { userId: '', role: null },
    });
    const res = await client.replace_courier_document({
      kind: 'license',
      storagePath: `courier/${COURIER_ID}/license_1.jpg`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('UNAUTHENTICATED');
  });

  it('rechaza llamadas de actores sin rol courier', async () => {
    const client = setupClient(ADMIN_ID, 'admin');
    const res = await client.replace_courier_document({
      kind: 'license',
      storagePath: `courier/${ADMIN_ID}/license_1.jpg`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('UNAUTHORIZED_ACTOR');
  });

  it('rechaza path con path traversal (..) o de otro courier', async () => {
    const client = setupClient();
    const traversalRes = await client.replace_courier_document({
      kind: 'license',
      storagePath: `courier/${COURIER_ID}/../other/license_1.jpg`,
    });
    expect(traversalRes.ok).toBe(false);
    if (!traversalRes.ok) expect(traversalRes.code).toBe('VALIDATION_ERROR');

    const foreignRes = await client.replace_courier_document({
      kind: 'license',
      storagePath: `courier/${OTHER_COURIER_ID}/license_1.jpg`,
    });
    expect(foreignRes.ok).toBe(false);
    if (!foreignRes.ok) expect(foreignRes.code).toBe('VALIDATION_ERROR');
  });

  it('rechaza reemplazar documentos inexistentes con NOT_FOUND', async () => {
    const client = setupClient();
    const res = await client.replace_courier_document({
      kind: 'dni_front',
      storagePath: `courier/${COURIER_ID}/dni_front_1.jpg`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('NOT_FOUND');
  });

  it('rechaza reemplazar documentos en estado verified con INVALID_STATE_TRANSITION', async () => {
    const client = setupClient();
    const res = await client.replace_courier_document({
      kind: 'insurance',
      storagePath: `courier/${COURIER_ID}/insurance_new.jpg`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('reemplaza exitosamente un documento rejected: desactiva el anterior con 30 días de retención y promueve el nuevo', async () => {
    const client = setupClient();
    const newPath = `courier/${COURIER_ID}/license_new_v2.jpg`;

    const res = await client.replace_courier_document({
      kind: 'license',
      storagePath: newPath,
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.data.status).toBe('submitted');
    expect(res.data.isCurrent).toBe(true);
    expect(res.data.replacedDocumentId).toBe(DOC_REJECTED_ID);
    expect(res.data.idempotent).toBe(false);

    // Documento previo desactivado con retención de 30 días
    const oldDoc = client.getDocument(DOC_REJECTED_ID);
    expect(oldDoc).toBeDefined();
    expect(oldDoc?.isCurrent).toBe(false);
    expect(oldDoc?.purgeAfter).not.toBeNull();

    // Nuevo documento vigente
    const newDoc = client.getDocument(res.data.documentId);
    expect(newDoc).toBeDefined();
    expect(newDoc?.isCurrent).toBe(true);
    expect(newDoc?.status).toBe('submitted');
    expect(newDoc?.rejectionCode).toBeNull();

    // Estado del repartidor actualizado a submitted
    const courier = client.getCourier(COURIER_ID);
    expect(courier?.licenseStatus).toBe('submitted');
  });

  it('es idempotente ante reintento con el mismo storagePath sobre el documento recién promovido', async () => {
    const client = setupClient();
    const newPath = `courier/${COURIER_ID}/license_new_v2.jpg`;

    const first = await client.replace_courier_document({
      kind: 'license',
      storagePath: newPath,
    });
    expect(first.ok).toBe(true);

    const retry = await client.replace_courier_document({
      kind: 'license',
      storagePath: newPath,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok) return;
    expect(retry.data.idempotent).toBe(true);
    if (first.ok) {
      expect(retry.data.documentId).toBe(first.data.documentId);
    }
  });

  it('admin no puede verificar ni decidir sobre documentos con isCurrent = false', async () => {
    const client = setupClient(ADMIN_ID, 'admin');

    // Desactivamos el documento simulando una versión obsoleta
    const doc = client.getDocument(DOC_REJECTED_ID);
    if (doc) doc.isCurrent = false;

    const res = await client.admin_verify_document({
      documentId: DOC_REJECTED_ID,
      decision: 'verified',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('INVALID_STATE_TRANSITION');
    }
  });

  it('admin_verify_document asigna other_safe por defecto al rechazar sin código explícito', async () => {
    const client = setupClient(ADMIN_ID, 'admin');
    const docId = '30000000-0000-4000-8000-0000000025d3';
    client.seedDocument({
      documentId: docId,
      courierId: COURIER_ID,
      kind: 'dni_back',
      status: 'submitted',
      isCurrent: true,
    });

    const res = await client.admin_verify_document({
      documentId: docId,
      decision: 'rejected',
      reason: 'Rechazo genérico',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.rejectionCode).toBe('other_safe');
  });

  it('reemplaza exitosamente un documento rejected de tipo insurance actualizando insuranceStatus', async () => {
    const client = setupClient();
    const insDocId = '30000000-0000-4000-8000-0000000025d4';
    client.seedDocument({
      documentId: insDocId,
      courierId: COURIER_ID,
      kind: 'insurance',
      status: 'rejected',
      isCurrent: true,
      storagePath: `courier/${COURIER_ID}/insurance_old.jpg`,
    });

    const res = await client.replace_courier_document({
      kind: 'insurance',
      storagePath: `courier/${COURIER_ID}/insurance_new.jpg`,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe('submitted');

    const courier = client.getCourier(COURIER_ID);
    expect(courier?.insuranceStatus).toBe('submitted');
  });

  it('reemplaza exitosamente un documento rejected de tipo dni_front sin alterar licenseStatus ni insuranceStatus', async () => {
    const client = setupClient();
    const dniDocId = '30000000-0000-4000-8000-0000000025d5';
    client.seedDocument({
      documentId: dniDocId,
      courierId: COURIER_ID,
      kind: 'dni_front',
      status: 'rejected',
      isCurrent: true,
      storagePath: `courier/${COURIER_ID}/dni_front_old.jpg`,
    });

    const res = await client.replace_courier_document({
      kind: 'dni_front',
      storagePath: `courier/${COURIER_ID}/dni_front_new.jpg`,
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe('submitted');
  });

  it('replace_courier_document devuelve NOT_FOUND si el courier no existe en couriers', async () => {
    const client = setupClient();
    client.deleteCourier(COURIER_ID);

    const res = await client.replace_courier_document({
      kind: 'license',
      storagePath: `courier/${COURIER_ID}/license_orphan.jpg`,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('NOT_FOUND');
    }
  });
});
