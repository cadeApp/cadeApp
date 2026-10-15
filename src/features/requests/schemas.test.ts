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

  it('acepta y preserva requestId cuando es un UUID válido (CC-024)', () => {
    const validUuid = '12345678-1234-4234-8234-123456789abc';
    const result = createDeliveryRequestSchema.safeParse({
      ...baseValidInput,
      requestId: validUuid,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requestId).toBe(validUuid);
    }
  });

  it('rechaza requestId que no sea un UUID válido', () => {
    const result = createDeliveryRequestSchema.safeParse({
      ...baseValidInput,
      requestId: 'invalid-uuid-string',
    });
    expect(result.success).toBe(false);
  });

  describe('T-353: Validación semántica integral de solicitudes de envío y multi-drop', () => {
    describe('recipientName', () => {
      it('acepta nombres legítimos de personas con acentos, ñ, guiones y apóstrofes', () => {
        const legitimateNames = [
          'Juan Pérez',
          'María Belén Gómez-López',
          "Esteban O'Connor",
          'Dr. Carlos Menéndez',
          'Ana Sofía Núñez',
        ];
        for (const name of legitimateNames) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientName: name });
          expect(res.success, `Falló para nombre legítimo: ${name}`).toBe(true);
        }
      });

      it('rechaza inyecciones HTML en el nombre del destinatario', () => {
        const malicious = ['<script>alert(1)</script>', 'Destinatario <img src=x>'];
        for (const name of malicious) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientName: name });
          expect(res.success, `Debería rechazar: ${name}`).toBe(false);
        }
      });

      it('rechaza nombres que son solo números o símbolos sin letras', () => {
        const invalidNames = ['12345678', '---', '!@#$%^&*', '...'];
        for (const name of invalidNames) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientName: name });
          expect(res.success, `Debería rechazar: ${name}`).toBe(false);
        }
      });

      it('rechaza caracteres de control en el nombre del destinatario', () => {
        const withControl = 'Juan\x00Pérez';
        const res = dropSchema.safeParse({ ...validDrop1, recipientName: withControl });
        expect(res.success).toBe(false);
      });
    });

    describe('recipientPhone (teléfono argentino plausible y normalización canónica)', () => {
      it('acepta teléfonos argentinos válidos con formatos normalizables y los canoniza a 10 dígitos', () => {
        const validPhones = [
          '3865123456',
          '3865 123456',
          '03865 15-123456',
          '+54 9 3865 123456',
          '+5493865123456',
          '11 2345-6789',
          '(011) 15-2345-6789',
        ];
        for (const phone of validPhones) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientPhone: phone });
          expect(res.success, `Falló para teléfono válido: ${phone}`).toBe(true);
        }

        // PR362-H02: Verificar transformación a 10 dígitos nacionales
        const resIntl = dropSchema.safeParse({ ...validDrop1, recipientPhone: '+54 9 3865 123456' });
        expect(resIntl.success).toBe(true);
        if (resIntl.success) {
          expect(resIntl.data.recipientPhone).toBe('3865123456');
        }

        const resLocal = dropSchema.safeParse({ ...validDrop1, recipientPhone: '03865 15-123456' });
        expect(resLocal.success).toBe(true);
        if (resLocal.success) {
          expect(resLocal.data.recipientPhone).toBe('3865123456');
        }
      });

      it('rechaza teléfonos que contienen letras o palabras', () => {
        const withLetters = ['abcdefgh', '3865123456abc', 'telefono123', 'N/A'];
        for (const phone of withLetters) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientPhone: phone });
          expect(res.success, `Debería rechazar letras: ${phone}`).toBe(false);
        }
      });

      it('rechaza teléfonos con caracteres, símbolos arbitrarios o prefijos mal ubicados', () => {
        const withSymbols = [
          '3865#123456',
          '<script>',
          '3865@123456',
          '3865!123456',
          '++54 9 3865 123456',
          '3865 +123456',
          '(3865 123456',
          '3865) 123456',
          ')3865( 123456',
        ];
        for (const phone of withSymbols) {
          const res = dropSchema.safeParse({ ...validDrop1, recipientPhone: phone });
          expect(res.success, `Debería rechazar símbolos: ${phone}`).toBe(false);
        }
      });
    });

    describe('dropoffAddress y pickupAddress', () => {
      it('rechaza inyecciones HTML en direcciones de retiro y entrega', () => {
        const badPickup = { ...baseValidInput, pickupAddress: '<script>alert(1)</script>' };
        expect(createDeliveryRequestSchema.safeParse(badPickup).success).toBe(false);

        const badDrop = { ...validDrop1, dropoffAddress: '<script>alert(1)</script>' };
        expect(dropSchema.safeParse(badDrop).success).toBe(false);
      });

      it('rechaza direcciones que son únicamente símbolos sin calle ni números', () => {
        const onlySymbols = '---';
        const badPickup = { ...baseValidInput, pickupAddress: onlySymbols };
        expect(createDeliveryRequestSchema.safeParse(badPickup).success).toBe(false);

        const badDrop = { ...validDrop1, dropoffAddress: onlySymbols };
        expect(dropSchema.safeParse(badDrop).success).toBe(false);
      });

      it('rechaza caracteres de control en las direcciones', () => {
        const withControl = 'San Martín 450\x00Aguilares';
        const badPickup = { ...baseValidInput, pickupAddress: withControl };
        expect(createDeliveryRequestSchema.safeParse(badPickup).success).toBe(false);

        const badDrop = { ...validDrop1, dropoffAddress: withControl };
        expect(dropSchema.safeParse(badDrop).success).toBe(false);
      });
    });

    describe('fixedPriceArs (monto entero ARS, desbordes y precisión - Decisión 1B)', () => {
      it('acepta precios enteros válidos razonables y hasta el límite SQL INTEGER de 2.147.483.647', () => {
        const withPrice = { ...baseValidInput, fixedPriceArs: 2500 };
        expect(createDeliveryRequestSchema.safeParse(withPrice).success).toBe(true);

        const overTenMillion = { ...baseValidInput, fixedPriceArs: 10_000_001 };
        expect(createDeliveryRequestSchema.safeParse(overTenMillion).success).toBe(true);

        const maxIntPrice = { ...baseValidInput, fixedPriceArs: 2_147_483_647 };
        expect(createDeliveryRequestSchema.safeParse(maxIntPrice).success).toBe(true);
      });

      it('rechaza precios con decimales/flotantes (ARS no fraccionario)', () => {
        const withFloat = { ...baseValidInput, fixedPriceArs: 1500.5 };
        expect(createDeliveryRequestSchema.safeParse(withFloat).success).toBe(false);
      });

      it('rechaza precios negativos, cero o no finitos', () => {
        expect(createDeliveryRequestSchema.safeParse({ ...baseValidInput, fixedPriceArs: -500 }).success).toBe(false);
        expect(createDeliveryRequestSchema.safeParse({ ...baseValidInput, fixedPriceArs: 0 }).success).toBe(false);
        expect(createDeliveryRequestSchema.safeParse({ ...baseValidInput, fixedPriceArs: Infinity }).success).toBe(false);
        expect(createDeliveryRequestSchema.safeParse({ ...baseValidInput, fixedPriceArs: NaN }).success).toBe(false);
      });

      it('rechaza precios que superen el límite SQL INTEGER (> 2.147.483.647)', () => {
        const overflowPrice = { ...baseValidInput, fixedPriceArs: 2_147_483_648 };
        expect(createDeliveryRequestSchema.safeParse(overflowPrice).success).toBe(false);

        const extremeOverflow = { ...baseValidInput, fixedPriceArs: 999_999_999_999 };
        expect(createDeliveryRequestSchema.safeParse(extremeOverflow).success).toBe(false);
      });
    });

    describe('cashChangeAmount (monto de cambio entero ARS y desbordes - Decisión 1B)', () => {
      it('acepta montos de cambio válidos hasta el límite SQL INTEGER de 2.147.483.647', () => {
        const withValidChange = {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
          cashChangeAmount: 5000,
        };
        expect(dropSchema.safeParse(withValidChange).success).toBe(true);

        const withOverTenMillionChange = {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
          cashChangeAmount: 10_000_001,
        };
        expect(dropSchema.safeParse(withOverTenMillionChange).success).toBe(true);

        const withMaxIntChange = {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
          cashChangeAmount: 2_147_483_647,
        };
        expect(dropSchema.safeParse(withMaxIntChange).success).toBe(true);
      });

      it('rechaza montos de cambio con decimales, negativos, cero o no finitos', () => {
        const baseChangeDrop = {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
        };
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: 2000.5 }).success).toBe(false);
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: -500 }).success).toBe(false);
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: 0 }).success).toBe(false);
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: Infinity }).success).toBe(false);
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: NaN }).success).toBe(false);
      });

      it('rechaza montos de cambio que superen el límite SQL INTEGER (> 2.147.483.647)', () => {
        const baseChangeDrop = {
          ...validDrop1,
          recipientPaymentMethod: 'cash' as const,
          needsChange: true,
        };
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: 2_147_483_648 }).success).toBe(false);
        expect(dropSchema.safeParse({ ...baseChangeDrop, cashChangeAmount: 999_999_999_999 }).success).toBe(false);
      });
    });

    describe('notes (multilínea legítima y control de caracteres - PR362-H04)', () => {
      it('acepta saltos de línea y tabulaciones legítimas en las indicaciones del drop', () => {
        const multilineNotes = [
          'Portón azul\nPiso 2',
          'Tocar timbre blanco.\r\nDejar paquete en recepción.\tPiso 3',
        ];
        for (const note of multilineNotes) {
          const res = dropSchema.safeParse({ ...validDrop1, notes: note });
          expect(res.success, `Falló para nota multilínea: ${JSON.stringify(note)}`).toBe(true);
        }
      });

      it('rechaza caracteres de control no imprimibles (NUL, etc.) en las notas del drop', () => {
        const withControl = { ...validDrop1, notes: 'Indicación\x00peligrosa' };
        expect(dropSchema.safeParse(withControl).success).toBe(false);

        const withBell = { ...validDrop1, notes: 'Indicación\x07con alarma' };
        expect(dropSchema.safeParse(withBell).success).toBe(false);
      });
    });
  });
});

