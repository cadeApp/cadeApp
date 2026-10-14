import { describe, expect, it } from 'vitest';
import { createDeliveryRequestSchema, dropSchema } from './schemas';

describe('T-340: createDeliveryRequestSchema y dropSchema', () => {
  const validPickupZoneId = '11111111-1111-4111-8111-111111111111';
  const validDropoffZoneId1 = '22222222-2222-4222-8222-222222222222';
  const validDropoffZoneId2 = '33333333-3333-4333-8333-333333333333';
  const validDropoffZoneId3 = '44444444-4444-4444-8444-444444444444';

  const validDrop1 = {
    dropoffZoneId: validDropoffZoneId1,
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

  const validDrop2 = {
    dropoffZoneId: validDropoffZoneId2,
    dropoffAddress: 'Av. Sarmiento 800',
    dropoffLat: -27.432,
    dropoffLng: -65.612,
    recipientName: 'María López',
    recipientPhone: '3815559876',
    recipientConsentDeclared: true as const,
    packageType: 'chico' as const,
    recipientPaymentMethod: 'transfer' as const,
    needsChange: false,
    cashChangeAmount: null,
    notes: 'Piso 2 Depto B',
  };

  const validDrop3 = {
    dropoffZoneId: validDropoffZoneId3,
    dropoffAddress: 'Mitre 210',
    dropoffLat: null,
    dropoffLng: null,
    recipientName: 'Carlos Gómez',
    recipientPhone: '3815554321',
    recipientConsentDeclared: true as const,
    packageType: 'grande' as const,
    recipientPaymentMethod: 'cash' as const,
    needsChange: false,
    cashChangeAmount: null,
    notes: null,
  };

  const baseValidInput = {
    pickupZoneId: validPickupZoneId,
    pickupAddress: 'Av. Sarmiento 120',
    pickupLat: -27.43,
    pickupLng: -65.61,
    fixedPriceArs: null,
    autoAssign: false,
    drops: [validDrop1],
  };

  it('acepta un input válido completo con 1 drop, coordenadas y cambio en efectivo', () => {
    const result = createDeliveryRequestSchema.safeParse(baseValidInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drops).toHaveLength(1);
      const drop = result.data.drops[0];
      if (!drop) throw new Error('Drop 0 missing');
      expect(drop.cashChangeAmount).toBe(5000);
      expect(drop.packageType).toBe('mediano');
      expect(drop.recipientPaymentMethod).toBe('cash');
      expect(drop.recipientConsentDeclared).toBe(true);
      expect(drop.notes).toBe('Tocar timbre blanco');
    }
  });

  it('acepta un input válido con 3 drops con diferentes métodos de pago y paquetes', () => {
    const inputWith3Drops = {
      ...baseValidInput,
      drops: [validDrop1, validDrop2, validDrop3],
    };

    const result = createDeliveryRequestSchema.safeParse(inputWith3Drops);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drops).toHaveLength(3);
      const d0 = result.data.drops[0];
      const d1 = result.data.drops[1];
      const d2 = result.data.drops[2];
      if (!d0 || !d1 || !d2) throw new Error('Drops missing');
      expect(d0.recipientPaymentMethod).toBe('cash');
      expect(d0.cashChangeAmount).toBe(5000);
      expect(d1.recipientPaymentMethod).toBe('transfer');
      expect(d1.cashChangeAmount).toBeNull();
      expect(d2.packageType).toBe('grande');
      expect(d2.cashChangeAmount).toBeNull();
    }
  });

  it('rechaza si se envía 0 drops', () => {
    const emptyDropsInput = {
      ...baseValidInput,
      drops: [],
    };

    const result = createDeliveryRequestSchema.safeParse(emptyDropsInput);
    expect(result.success).toBe(false);
  });

  it('rechaza error de destinatario (nombre o teléfono) en drop 2 o drop 3', () => {
    const invalidDrop2Recipient = {
      ...baseValidInput,
      drops: [
        validDrop1,
        {
          ...validDrop2,
          recipientName: '',
        },
      ],
    };
    const resName = createDeliveryRequestSchema.safeParse(invalidDrop2Recipient);
    expect(resName.success).toBe(false);

    const invalidDrop3Phone = {
      ...baseValidInput,
      drops: [
        validDrop1,
        validDrop2,
        {
          ...validDrop3,
          recipientPhone: '123', // < 8 chars
        },
      ],
    };
    const resPhone = createDeliveryRequestSchema.safeParse(invalidDrop3Phone);
    expect(resPhone.success).toBe(false);
  });

  it('rechaza si falta recipientConsentDeclared en drop 2 o drop 3', () => {
    const missingConsentDrop2 = {
      ...baseValidInput,
      drops: [
        validDrop1,
        {
          ...validDrop2,
          recipientConsentDeclared: false,
        },
      ],
    };

    const result = createDeliveryRequestSchema.safeParse(missingConsentDrop2);
    expect(result.success).toBe(false);
  });

  it('rechaza coordenadas incompletas (latitud sin longitud o viceversa) en drop', () => {
    const partialDropCoords = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          dropoffLat: -27.435,
          dropoffLng: null,
        },
      ],
    };

    const result = createDeliveryRequestSchema.safeParse(partialDropCoords);
    expect(result.success).toBe(false);
  });

  it('rechaza coordenadas fuera del bounding box de Aguilares en drop', () => {
    const outOfBoundsDrop = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          dropoffLat: -34.6037, // Buenos Aires
          dropoffLng: -58.3816,
        },
      ],
    };

    const result = createDeliveryRequestSchema.safeParse(outOfBoundsDrop);
    expect(result.success).toBe(false);
  });

  it('rechaza si se envía latitud sin longitud en el retiro', () => {
    const partialPickup = {
      ...baseValidInput,
      pickupLat: -27.43,
      pickupLng: null,
    };

    const result = createDeliveryRequestSchema.safeParse(partialPickup);
    expect(result.success).toBe(false);
  });

  it('rechaza si el método de pago es cash, needsChange es true pero cashChangeAmount no es positivo o falta', () => {
    const missingChangeAmount = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
          cashChangeAmount: null,
        },
      ],
    };

    const resultMissing = createDeliveryRequestSchema.safeParse(missingChangeAmount);
    expect(resultMissing.success).toBe(false);

    const zeroChangeAmount = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
          cashChangeAmount: 0,
        },
      ],
    };

    const resultZero = createDeliveryRequestSchema.safeParse(zeroChangeAmount);
    expect(resultZero.success).toBe(false);
  });

  it('rechaza si el método de pago es transfer o to_agree y needsChange es true', () => {
    const transferWithChange = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          recipientPaymentMethod: 'transfer' as const,
          needsChange: true,
          cashChangeAmount: 2000,
        },
      ],
    };

    const resultTransfer = createDeliveryRequestSchema.safeParse(transferWithChange);
    expect(resultTransfer.success).toBe(false);

    const toAgreeWithChange = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          recipientPaymentMethod: 'to_agree' as const,
          needsChange: true,
          cashChangeAmount: 2000,
        },
      ],
    };

    const resultToAgree = createDeliveryRequestSchema.safeParse(toAgreeWithChange);
    expect(resultToAgree.success).toBe(false);
  });

  it('normaliza cashChangeAmount a null si needsChange es false', () => {
    const noChangeNeeded = {
      ...baseValidInput,
      drops: [
        {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: false,
          cashChangeAmount: 5000, // Debe normalizarse a null
        },
      ],
    };

    const result = createDeliveryRequestSchema.safeParse(noChangeNeeded);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drops[0]?.cashChangeAmount).toBeNull();
    }
  });

  it('normaliza cashChangeAmount a null si el método de pago no es cash', () => {
    const transferInput = {
      ...baseValidInput,
      drops: [validDrop2],
    };

    const result = createDeliveryRequestSchema.safeParse(transferInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.drops[0]?.cashChangeAmount).toBeNull();
    }
  });

  it('rechaza autoAssign=true sin fixedPriceArs positivo', () => {
    const autoAssignWithoutPrice = {
      ...baseValidInput,
      autoAssign: true,
      fixedPriceArs: null,
    };

    const result = createDeliveryRequestSchema.safeParse(autoAssignWithoutPrice);
    expect(result.success).toBe(false);
  });

  it('acepta autoAssign=true con fixedPriceArs positivo', () => {
    const autoAssignWithPrice = {
      ...baseValidInput,
      autoAssign: true,
      fixedPriceArs: 2500,
    };

    const result = createDeliveryRequestSchema.safeParse(autoAssignWithPrice);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.autoAssign).toBe(true);
      expect(result.data.fixedPriceArs).toBe(2500);
    }
  });

  it('valida que packageType pertenezca a [sobre, chico, mediano, grande]', () => {
    const validPackages = ['sobre', 'chico', 'mediano', 'grande'] as const;
    for (const pkg of validPackages) {
      const res = dropSchema.safeParse({
        ...validDrop1,
        packageType: pkg,
      });
      expect(res.success).toBe(true);
    }

    const invalidPackage = {
      ...validDrop1,
      packageType: 'enorme',
    };
    const resInvalid = dropSchema.safeParse(invalidPackage);
    expect(resInvalid.success).toBe(false);
  });
});
