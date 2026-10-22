import { describe, expect, it } from 'vitest';
import { ALL_RPC_NAMES, RPC_CONTRACTS } from './index';

const item = {
  id: '00000000-0000-4000-8000-000000370001',
  code: 'REQ-00000000',
  status: 'delivered',
  createdAt: '2026-10-22T03:00:00.000000Z',
  publishedAt: '2026-10-22T03:00:00.000000Z',
  deliveredAt: '2026-10-22T04:00:00.000000Z',
  cancelledAt: null,
  merchantId: '00000000-0000-4000-8000-0000000370b1',
  merchantName: 'Comercio',
  courierId: '00000000-0000-4000-8000-0000000370c1',
  courierName: 'Repartidor',
  dropsCount: 2,
  deliveredDrops: 1,
  failedDrops: 1,
  courierReleases: 0,
  noShowReports: 0,
  cancelled: false,
  incidents: 0,
  openIncidents: 0,
};

describe('CC-037: contrato de admin_list_trips', () => {
  const contract = RPC_CONTRACTS.admin_list_trips;

  it('está registrado con los errores canónicos de las RPC admin', () => {
    expect(ALL_RPC_NAMES).toContain('admin_list_trips');
    expect(contract.errorCodes).toEqual([
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'AAL2_REQUIRED',
      'VALIDATION_ERROR',
    ]);
  });

  it('acepta los filtros problems y all, con cursor completo y límite 1–50', () => {
    expect(contract.inputSchema.safeParse({ filter: 'problems' }).success).toBe(true);
    expect(
      contract.inputSchema.safeParse({
        filter: 'all',
        cursor: { createdAt: '2026-10-22T03:00:00.123456Z', id: item.id },
        limit: 50,
      }).success
    ).toBe(true);
  });

  it('rechaza un filtro desconocido, un cursor incompleto y límites fuera de rango', () => {
    expect(contract.inputSchema.safeParse({ filter: 'open' }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', cursor: { id: item.id } }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', limit: 0 }).success).toBe(false);
    expect(contract.inputSchema.safeParse({ filter: 'all', limit: 51 }).success).toBe(false);
  });

  it('parsea la salida de la RPC con su nextCursor', () => {
    const parsed = contract.outputSchema.safeParse({
      items: [item],
      nextCursor: { createdAt: item.createdAt, id: item.id },
    });
    expect(parsed.success).toBe(true);
    expect(contract.outputSchema.safeParse({ items: [], nextCursor: null }).success).toBe(true);
  });

  it('es estricto: una clave extra (por ejemplo un dato del destinatario) invalida la salida', () => {
    for (const extra of ['recipientName', 'recipientPhone', 'dropoffAddress', 'cashChangeAmount', 'failedReason']) {
      expect(
        contract.outputSchema.safeParse({ items: [{ ...item, [extra]: 'x' }], nextCursor: null }).success,
        extra
      ).toBe(false);
    }
  });

  it('exige el formato de código REQ- y un estado de solicitud válido', () => {
    expect(contract.outputSchema.safeParse({ items: [{ ...item, code: 'REQ-abc' }], nextCursor: null }).success).toBe(
      false
    );
    expect(
      contract.outputSchema.safeParse({ items: [{ ...item, status: 'lost' }], nextCursor: null }).success
    ).toBe(false);
  });
});
