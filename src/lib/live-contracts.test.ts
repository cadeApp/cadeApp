import { describe, expect, it } from 'vitest';
import {
  liveAvailableRequestItemSchema,
  liveFeedResponseSchema,
  liveMerchantOfferItemSchema,
  liveOffersResponseSchema,
  liveTripResponseSchema,
  liveTripStateSchema,
  liveErrorResponseSchema,
  livePageCursorSchema,
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

  const validCursor = {
    createdAt: '2026-09-26T12:05:00.000Z',
    id: 'e0000000-0000-0000-0000-000000000005',
  };

  const validTrip = {
    id: 'd0000000-0000-0000-0000-000000000004',
    status: 'in_transit',
  };

  it('valida cursor schema con valores correctos', () => {
    expect(livePageCursorSchema.safeParse(validCursor).success).toBe(true);
  });

  it('falla cursor si createdAt es inválido o id no es UUID', () => {
    expect(
      livePageCursorSchema.safeParse({ ...validCursor, createdAt: 'not-a-datetime' }).success
    ).toBe(false);
    expect(
      livePageCursorSchema.safeParse({ ...validCursor, id: 'not-a-uuid' }).success
    ).toBe(false);
  });

  it('valida un feed response válido con solicitudes y nextCursor', () => {
    const parsedWithCursor = liveFeedResponseSchema.safeParse({
      data: [validRequest],
      nextCursor: validCursor,
    });
    expect(parsedWithCursor.success).toBe(true);

    const parsedTerminal = liveFeedResponseSchema.safeParse({
      data: [validRequest],
      nextCursor: null,
    });
    expect(parsedTerminal.success).toBe(true);
  });

  it('valida un feed response vacío terminal', () => {
    const parsed = liveFeedResponseSchema.safeParse({ data: [], nextCursor: null });
    expect(parsed.success).toBe(true);
  });

  it('falla feed response si falta nextCursor (no es opcional)', () => {
    const parsed = liveFeedResponseSchema.safeParse({ data: [validRequest] });
    expect(parsed.success).toBe(false);
  });

  it('falla feed response si un campo requerido falta o es inválido', () => {
    const invalidRequest = { ...validRequest, packageType: 'extra_large' };
    const parsed = liveFeedResponseSchema.safeParse({ data: [invalidRequest], nextCursor: null });
    expect(parsed.success).toBe(false);

    const missingId = { ...validRequest, id: 'not-a-uuid' };
    expect(liveAvailableRequestItemSchema.safeParse(missingId).success).toBe(false);
  });

  it('valida offers response válido con y sin cursor', () => {
    const parsedWithCursor = liveOffersResponseSchema.safeParse({
      data: [validOffer],
      nextCursor: validCursor,
    });
    expect(parsedWithCursor.success).toBe(true);

    const parsedTerminal = liveOffersResponseSchema.safeParse({
      data: [validOffer],
      nextCursor: null,
    });
    expect(parsedTerminal.success).toBe(true);
  });

  it('falla offers response si falta nextCursor', () => {
    const parsed = liveOffersResponseSchema.safeParse({ data: [validOffer] });
    expect(parsed.success).toBe(false);
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
