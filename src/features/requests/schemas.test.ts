import { describe, expect, it } from 'vitest';
import { createDeliveryRequestSchema } from './schemas';

describe('T-112: createDeliveryRequestSchema', () => {
  const validPickupZoneId = '11111111-1111-4111-8111-111111111111';
  const validDropoffZoneId = '22222222-2222-4222-8222-222222222222';

  const baseValidInput = {
    pickupZoneId: validPickupZoneId,
    pickupAddress: 'Av. Sarmiento 120',
    pickupLat: -27.43,
    pickupLng: -65.61,
    dropoffZoneId: validDropoffZoneId,
    dropoffAddress: 'San Martín 450',
    dropoffLat: -27.435,
    dropoffLng: -65.615,
    recipientName: 'Juan Pérez',
    recipientPhone: '3815551234',
    recipientConsentDeclared: true as const,
    packageType: 'mediano' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: true,
    cashChangeAmount: 5000,
    notes: 'Tocar timbre blanco',
  };

  it('acepta un input válido completo con coordenadas y cambio en efectivo', () => {
    const result = createDeliveryRequestSchema.safeParse(baseValidInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cashChangeAmount).toBe(5000);
      expect(result.data.packageType).toBe('mediano');
      expect(result.data.recipientPaymentMethod).toBe('cash');
      expect(result.data.recipientConsentDeclared).toBe(true);
    }
  });

  it('acepta solicitud sin coordenadas (null o undefined), usando fallback a zonas', () => {
    const withoutCoords = {
      ...baseValidInput,
      pickupLat: null,
      pickupLng: null,
      dropoffLat: null,
      dropoffLng: null,
    };

    const result = createDeliveryRequestSchema.safeParse(withoutCoords);
    expect(result.success).toBe(true);
  });

  it('rechaza coordenadas fuera del bounding box de Aguilares', () => {
    const invalidCoordsInput = {
      ...baseValidInput,
      dropoffLat: -34.6037, // Buenos Aires
      dropoffLng: -58.3816,
    };

    const result = createDeliveryRequestSchema.safeParse(invalidCoordsInput);
    expect(result.success).toBe(false);
  });

  it('rechaza si se envía latitud sin longitud en el retiro', () => {
    const partialCoords = {
      ...baseValidInput,
      pickupLat: -27.43,
      pickupLng: null,
    };

    const result = createDeliveryRequestSchema.safeParse(partialCoords);
    expect(result.success).toBe(false);
  });

  it('rechaza si se envía latitud sin longitud en la entrega', () => {
    const partialCoords = {
      ...baseValidInput,
      dropoffLat: -27.435,
      dropoffLng: null,
    };

    const result = createDeliveryRequestSchema.safeParse(partialCoords);
    expect(result.success).toBe(false);
  });

  it('exige recipientConsentDeclared = true obligatorio', () => {
    const missingConsent = {
      ...baseValidInput,
      recipientConsentDeclared: false,
    };

    const result = createDeliveryRequestSchema.safeParse(missingConsent);
    expect(result.success).toBe(false);
  });

  it('rechaza si el método de pago es cash, needsChange es true pero cashChangeAmount no es positivo o falta', () => {
    const missingChangeAmount = {
      ...baseValidInput,
      recipientPaymentMethod: 'cash' as const,
      needsChange: true,
      cashChangeAmount: null,
    };

    const result = createDeliveryRequestSchema.safeParse(missingChangeAmount);
    expect(result.success).toBe(false);

    const nonPositiveChangeAmount = {
      ...baseValidInput,
      recipientPaymentMethod: 'cash' as const,
      needsChange: true,
      cashChangeAmount: 0,
    };
    const resultZero = createDeliveryRequestSchema.safeParse(nonPositiveChangeAmount);
    expect(resultZero.success).toBe(false);
  });

  it('permite cashChangeAmount nulo si needsChange es false', () => {
    const noChangeNeeded = {
      ...baseValidInput,
      recipientPaymentMethod: 'cash' as const,
      needsChange: false,
      cashChangeAmount: null,
    };

    const result = createDeliveryRequestSchema.safeParse(noChangeNeeded);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cashChangeAmount).toBeNull();
    }
  });

  it('permite cashChangeAmount nulo si el método de pago no es cash', () => {
    const transferInput = {
      ...baseValidInput,
      recipientPaymentMethod: 'transfer' as const,
      needsChange: false,
      cashChangeAmount: null,
    };

    const result = createDeliveryRequestSchema.safeParse(transferInput);
    expect(result.success).toBe(true);
  });

  it('valida que packageType pertenezca a [sobre, chico, mediano, grande]', () => {
    const validPackages = ['sobre', 'chico', 'mediano', 'grande'] as const;
    for (const pkg of validPackages) {
      const res = createDeliveryRequestSchema.safeParse({
        ...baseValidInput,
        packageType: pkg,
      });
      expect(res.success).toBe(true);
    }

    const invalidPackage = {
      ...baseValidInput,
      packageType: 'enorme',
    };
    const resInvalid = createDeliveryRequestSchema.safeParse(invalidPackage);
    expect(resInvalid.success).toBe(false);
  });
});
