import { describe, expect, it } from 'vitest';
import {
  liveAvailableRequestItemSchema,
  liveFeedResponseSchema,
  liveMerchantOfferItemSchema,
  liveOffersResponseSchema,
  liveTripResponseSchema,
  liveTripStateSchema,
  liveErrorResponseSchema,
} from './live-contracts';

describe('T-204: live-contracts client-safe schemas', () => {
  const validRequest = {
    id: 'a0000000-0000-0000-0000-000000000001',
    pickupZoneName: 'Centro',
    dropoffZoneName: 'Aguilares',
    approxDistanceKm: '1,5',
    packageType: 'small',
    recipientPaymentMethod: 'cash',
    needsChange: false,
    cashChangeAmount: null,
    notes: null,
    publishedAt: '2026-09-26T12:00:00Z',
    expiresAt: null,
    hasMyOffer: true,
    myOfferAmountArs: 1500,
  };

  const validOffer = {
    id: 'b0000000-0000-0000-0000-000000000002',
    courierId: 'c0000000-0000-0000-0000-000000000003',
    courierName: 'Carlos Repartidor',
    vehicleType: 'motorcycle',
    amountArs: 1800,
    etaMinutes: 20,
    message: 'En 20 llego',
    licenseStatus: 'verified',
    insuranceStatus: 'none',
    docLevel: 1,
    createdAt: '2026-09-26T12:05:00Z',
    status: 'pending',
  };

  const validTrip = {
    id: 'd0000000-0000-0000-0000-000000000004',
    status: 'in_transit',
  };

  it('valida un feed response válido con solicitudes', () => {
    const parsed = liveFeedResponseSchema.safeParse({ data: [validRequest] });
    expect(parsed.success).toBe(true);
  });

  it('valida un feed response vacío', () => {
    const parsed = liveFeedResponseSchema.safeParse({ data: [] });
    expect(parsed.success).toBe(true);
  });

  it('falla feed response si un campo requerido falta o es inválido', () => {
    const invalidRequest = { ...validRequest, packageType: 'extra_large' };
    const parsed = liveFeedResponseSchema.safeParse({ data: [invalidRequest] });
    expect(parsed.success).toBe(false);

    const missingId = { ...validRequest, id: 'not-a-uuid' };
    expect(liveAvailableRequestItemSchema.safeParse(missingId).success).toBe(false);
  });

  it('valida offers response válido', () => {
    const parsed = liveOffersResponseSchema.safeParse({ data: [validOffer] });
    expect(parsed.success).toBe(true);
  });

  it('falla offer si amountArs es negativo o docLevel no es 0, 1, 2', () => {
    expect(
      liveMerchantOfferItemSchema.safeParse({ ...validOffer, amountArs: -50 }).success
    ).toBe(false);
    expect(
      liveMerchantOfferItemSchema.safeParse({ ...validOffer, docLevel: 5 }).success
    ).toBe(false);
    expect(
      liveMerchantOfferItemSchema.safeParse({ ...validOffer, licenseStatus: 'invalid' }).success
    ).toBe(false);
  });

  it('valida trip response cuando hay viaje activo y cuando es null', () => {
    const withTrip = liveTripResponseSchema.safeParse({ data: validTrip });
    expect(withTrip.success).toBe(true);

    const withoutTrip = liveTripResponseSchema.safeParse({ data: null });
    expect(withoutTrip.success).toBe(true);
  });

  it('falla trip si el status no es matched, in_transit o delivered', () => {
    expect(
      liveTripStateSchema.safeParse({ id: validTrip.id, status: 'cancelled' }).success
    ).toBe(false);
    expect(
      liveTripStateSchema.safeParse({ id: 'bad-uuid', status: 'matched' }).success
    ).toBe(false);
  });

  it('valida error response', () => {
    const parsed = liveErrorResponseSchema.safeParse({ error: 'UNAUTHORIZED' });
    expect(parsed.success).toBe(true);
    expect(liveErrorResponseSchema.safeParse({}).success).toBe(false);
  });
});
