import { describe, expect, it } from 'vitest';
import { AGUILARES_BOUNDS } from '@/domain/schemas';
import { merchantOnboardingSchema } from './schemas';

describe('T-111: Validaciones de schemas de onboarding de comercio', () => {
  const validPayload = {
    businessName: 'Panadería La Espiga',
    phone: '3815550123',
    defaultPickupAddress: 'San Martín 450',
    defaultPickupZoneId: '11111111-1111-1111-1111-111111111111',
    defaultPickupLat: -27.43,
    defaultPickupLng: -65.61,
    notes: 'Portón verde al lado de la farmacia',
    acceptPilotTerms: true,
    pilotTermsVersion: '1.0',
  };

  it('valida exitosamente un alta completa con coordenadas dentro de Aguilares', () => {
    const result = merchantOnboardingSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.businessName).toBe('Panadería La Espiga');
      expect(result.data.defaultPickupLat).toBe(-27.43);
      expect(result.data.defaultPickupLng).toBe(-65.61);
      expect(result.data.acceptPilotTerms).toBe(true);
    }
  });

  it('permite alta sin coordenadas (fallback a solo texto con notas/referencias)', () => {
    const withoutCoords = {
      ...validPayload,
      defaultPickupLat: null,
      defaultPickupLng: null,
    };
    const result = merchantOnboardingSchema.safeParse(withoutCoords);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultPickupLat).toBeNull();
      expect(result.data.defaultPickupLng).toBeNull();
    }
  });

  it('rechaza coordenadas fuera de los límites urbanos de Aguilares', () => {
    // Coordenadas de San Miguel de Tucumán o fuera de Aguilares
    const outsideLat = {
      ...validPayload,
      defaultPickupLat: -26.82, // Tucumán capital (fuera de [-27.48, -27.38], CC-019)
      defaultPickupLng: -65.61,
    };
    const latResult = merchantOnboardingSchema.safeParse(outsideLat);
    expect(latResult.success).toBe(false);

    const outsideLng = {
      ...validPayload,
      defaultPickupLat: -27.43,
      defaultPickupLng: -65.1, // Fuera de [-65.645, -65.58], CC-019
    };
    const lngResult = merchantOnboardingSchema.safeParse(outsideLng);
    expect(lngResult.success).toBe(false);
  });

  it('rechaza si se envía solo latitud o solo longitud', () => {
    const onlyLat = {
      ...validPayload,
      defaultPickupLat: -27.43,
      defaultPickupLng: null,
    };
    const onlyLatResult = merchantOnboardingSchema.safeParse(onlyLat);
    expect(onlyLatResult.success).toBe(false);

    const onlyLng = {
      ...validPayload,
      defaultPickupLat: null,
      defaultPickupLng: -65.61,
    };
    const onlyLngResult = merchantOnboardingSchema.safeParse(onlyLng);
    expect(onlyLngResult.success).toBe(false);
  });

  it('rechaza campos obligatorios vacíos o ausentes', () => {
    expect(merchantOnboardingSchema.safeParse({ ...validPayload, businessName: '' }).success).toBe(
      false
    );

    expect(merchantOnboardingSchema.safeParse({ ...validPayload, phone: '' }).success).toBe(false);

    expect(
      merchantOnboardingSchema.safeParse({ ...validPayload, defaultPickupAddress: '' }).success
    ).toBe(false);
  });

  it('exige la aceptación de los Términos del piloto (acceptPilotTerms === true)', () => {
    expect(
      merchantOnboardingSchema.safeParse({ ...validPayload, acceptPilotTerms: false }).success
    ).toBe(false);

    expect(
      merchantOnboardingSchema.safeParse({
        ...validPayload,
        acceptPilotTerms: undefined,
      }).success
    ).toBe(false);
  });

  describe('T-353: Validación semántica integral de entradas del comercio', () => {
    describe('businessName', () => {
      it('acepta nombres de comercio legítimos con acentos, números, espacios y caracteres comerciales', () => {
        const legitimateNames = [
          'Panadería & Confitería Don Pepe',
          'Librería 9 de Julio',
          'M&M Calzados S.R.L.',
          'Café & Bar "El Rincón"',
          "O'Higgins 123",
          'Ferretería (Casa Central)',
          'Verdulería La Nueva - Sucursal 2',
        ];
        for (const name of legitimateNames) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, businessName: name });
          expect(res.success, `Falló para nombre legítimo: ${name}`).toBe(true);
        }
      });

      it('rechaza inyecciones HTML o scripts en el nombre del comercio', () => {
        const malicious = [
          '<script>alert(1)</script>',
          'Comercio <img src=x onerror=alert(1)>',
          '<style>body{display:none}</style>',
        ];
        for (const name of malicious) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, businessName: name });
          expect(res.success, `Debería rechazar: ${name}`).toBe(false);
        }
      });

      it('rechaza caracteres de control en el nombre del negocio', () => {
        const withControl = 'Panadería\x00DonPepe';
        const res = merchantOnboardingSchema.safeParse({ ...validPayload, businessName: withControl });
        expect(res.success).toBe(false);
      });

      it('rechaza nombres que son únicamente símbolos o puntuación sin letras ni números', () => {
        const onlySymbols = ['...', '---', '&&&', '***', '###'];
        for (const sym of onlySymbols) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, businessName: sym });
          expect(res.success, `Debería rechazar solo símbolos: ${sym}`).toBe(false);
        }
      });

      it('rechaza nombres de comercio con longitud excesiva (> 100 caracteres)', () => {
        const longName = 'A'.repeat(101);
        const res = merchantOnboardingSchema.safeParse({ ...validPayload, businessName: longName });
        expect(res.success).toBe(false);
      });
    });

    describe('phone (teléfono argentino plausible)', () => {
      it('acepta teléfonos argentinos válidos en diferentes formatos', () => {
        const validPhones = [
          '3865123456',
          '3865 123456',
          '03865 15-123456',
          '(03865) 15-123456',
          '+54 9 3865 123456',
          '+54 3865 123456',
          '11 2345-6789',
          '(011) 15 2345-6789',
          '381 4123456',
        ];
        for (const phone of validPhones) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, phone });
          expect(res.success, `Falló para teléfono válido: ${phone}`).toBe(true);
        }
      });

      it('rechaza teléfonos que contienen letras', () => {
        const withLetters = ['abcdefghij', '3865123456abc', 'tel-3865123456', 'N/A'];
        for (const phone of withLetters) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, phone });
          expect(res.success, `Debería rechazar letras: ${phone}`).toBe(false);
        }
      });

      it('rechaza teléfonos con símbolos no telefónicos o inyecciones', () => {
        const withSymbols = ['3865#123456', '<script>', '3865@555', '3865$123456'];
        for (const phone of withSymbols) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, phone });
          expect(res.success, `Debería rechazar símbolos: ${phone}`).toBe(false);
        }
      });

      it('rechaza teléfonos con longitud insuficiente o excesiva', () => {
        const wrongLengths = ['12345', '12345678', '38651234567890123'];
        for (const phone of wrongLengths) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, phone });
          expect(res.success, `Debería rechazar longitud: ${phone}`).toBe(false);
        }
      });
    });

    describe('defaultPickupAddress', () => {
      it('acepta direcciones reales con números, acentos y símbolos urbanos', () => {
        const validAddresses = [
          'San Martín 450',
          'Av. 25 de Mayo 123, 1° B',
          'Pje. Gutiérrez s/n',
          'Ruta 38 km 728',
          'Barrio San Alberto, Manzana 4 Lote 12',
          'Calle 9 de Julio #1234',
        ];
        for (const addr of validAddresses) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, defaultPickupAddress: addr });
          expect(res.success, `Falló para dirección legítima: ${addr}`).toBe(true);
        }
      });

      it('rechaza inyecciones HTML en la dirección de retiro', () => {
        const malicious = ['<script>alert(1)</script>', '<img src=x> San Martín 123'];
        for (const addr of malicious) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, defaultPickupAddress: addr });
          expect(res.success, `Debería rechazar: ${addr}`).toBe(false);
        }
      });

      it('rechaza direcciones que son únicamente símbolos sin calle ni números', () => {
        const onlySymbols = ['---', '...', '###'];
        for (const sym of onlySymbols) {
          const res = merchantOnboardingSchema.safeParse({ ...validPayload, defaultPickupAddress: sym });
          expect(res.success, `Debería rechazar solo símbolos: ${sym}`).toBe(false);
        }
      });

      it('rechaza caracteres de control en la dirección', () => {
        const withControl = 'San Martín 450\x00Aguilares';
        const res = merchantOnboardingSchema.safeParse({ ...validPayload, defaultPickupAddress: withControl });
        expect(res.success).toBe(false);
      });
    });

    describe('notes', () => {
      it('rechaza caracteres de control en las notas', () => {
        const withControl = 'Nota válida\x00con byte nulo';
        const res = merchantOnboardingSchema.safeParse({ ...validPayload, notes: withControl });
        expect(res.success).toBe(false);
      });
    });
  });
});

