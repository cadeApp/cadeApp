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
      defaultPickupLat: -26.82, // Tucumán capital (fuera de [-27.455, -27.41])
      defaultPickupLng: -65.61,
    };
    const latResult = merchantOnboardingSchema.safeParse(outsideLat);
    expect(latResult.success).toBe(false);

    const outsideLng = {
      ...validPayload,
      defaultPickupLat: -27.43,
      defaultPickupLng: -65.1, // Fuera de [-65.64, -65.595]
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
});
