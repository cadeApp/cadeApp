import { describe, expect, it } from 'vitest';
import {
  ARGENTINA_PLATE_REGEX,
  DNI_REGEX,
  dniSchema,
  vehiclePlateSchema,
  courierOnboardingSchema,
  courierUpdateVehicleSchema,
} from './schemas';

describe('T-353: Matriz Zod de validación para DNI y patentes argentinas', () => {
  describe('Matriz de DNI (7 u 8 dígitos numéricos)', () => {
    const validDnis = [
      '1234567', // 7 dígitos directo
      '12345678', // 8 dígitos directo
      '1.234.567', // 7 dígitos con puntos
      '12.345.678', // 8 dígitos con puntos
      '98765432',
      '40123456',
    ];

    it.each(validDnis)('acepta DNI válido: %s', (validDni) => {
      expect(DNI_REGEX.test(validDni)).toBe(true);
      const res = dniSchema.safeParse(validDni);
      expect(res.success).toBe(true);
    });

    const invalidDnis = [
      '123456', // 6 dígitos (demasiado corto)
      '123456789', // 9 dígitos (demasiado largo)
      '1234567A', // Letra al final
      'A1234567', // Letra al inicio
      '1234 5678', // Espacios en medio
      '12-345-678', // Guiones
      'abcdefgh', // Solo letras
      '!@#$%^&*', // Símbolos
      '<script>', // Inyección HTML
      '12.34.5678', // Formato de puntos incorrecto
      '   ', // Solo espacios
      '', // Vacío
    ];

    it.each(invalidDnis)('rechaza DNI inválido: %s', (invalidDni) => {
      expect(DNI_REGEX.test(invalidDni)).toBe(false);
      const res = dniSchema.safeParse(invalidDni);
      expect(res.success).toBe(false);
    });
  });

  describe('Matriz de patentes argentinas (Mercosur y anteriores)', () => {
    const validPlates = [
      'AA123AA', // Mercosur auto (sin espacio)
      'AA 123 AA', // Mercosur auto (con espacio)
      'AB 456 CD',
      'ABC123', // Nacional auto anterior (sin espacio)
      'ABC 123', // Nacional auto anterior (con espacio)
      'ELA666', // Caso QA explícito ELA666
      'ELA 666', // Caso QA explícito ELA 666
      'A123BCD', // Mercosur moto (sin espacio)
      'A 123 BCD', // Mercosur moto (con espacio)
      '123ABC', // Nacional moto anterior (sin espacio)
      '123 ABC', // Nacional moto anterior (con espacio)
      '666ELA',
      '666 ELA',
    ];

    it.each(validPlates)('acepta patente argentina válida: %s', (validPlate) => {
      expect(ARGENTINA_PLATE_REGEX.test(validPlate)).toBe(true);
      const res = vehiclePlateSchema.safeParse(validPlate);
      expect(res.success).toBe(true);
    });

    const invalidPlates = [
      'ABCDEFG', // 7 letras arbitrarias
      'AAAAAAA', // Letras repetidas sin números
      '123456', // 6 números sin letras
      'AA123AA!', // Con símbolo
      'AB-123-CD', // Con guiones no autorizados
      '<script>', // Inyección
      'A12', // Demasiado corta
      'AA1234AA', // Demasiados dígitos
      'AA 1234 AA',
      'PATENTE', // Letras arbitrarias
      '   ', // Solo espacios
      '', // Vacío
    ];

    it.each(invalidPlates)('rechaza patente argentina inválida: %s', (invalidPlate) => {
      expect(ARGENTINA_PLATE_REGEX.test(invalidPlate)).toBe(false);
      const res = vehiclePlateSchema.safeParse(invalidPlate);
      expect(res.success).toBe(false);
    });
  });

  describe('courierOnboardingSchema: coherencia entre vehículo y patente', () => {
    const baseCourierInput = {
      dni: '12345678',
      vehicleType: 'moto' as const,
      vehiclePlate: 'A 123 BCD',
      documents: {
        dni_front: 'docs/dni_front.jpg',
        dni_back: 'docs/dni_back.jpg',
        selfie: 'docs/selfie.jpg',
        avatar: 'docs/avatar.jpg',
      },
      consents: {
        tos: true as const,
        privacy: true as const,
        courierContract: true as const,
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
      },
    };

    it('acepta moto con patente Mercosur válida', () => {
      const res = courierOnboardingSchema.safeParse(baseCourierInput);
      expect(res.success).toBe(true);
    });

    it('acepta auto con patente nacional anterior ELA 666', () => {
      const res = courierOnboardingSchema.safeParse({
        ...baseCourierInput,
        vehicleType: 'car',
        vehiclePlate: 'ELA 666',
      });
      expect(res.success).toBe(true);
    });

    it('rechaza moto o auto con patente inválida o con símbolos', () => {
      const res = courierOnboardingSchema.safeParse({
        ...baseCourierInput,
        vehicleType: 'moto',
        vehiclePlate: 'MOTO123!!!',
      });
      expect(res.success).toBe(false);
    });

    it('rechaza moto o auto con patente vacía', () => {
      const res = courierOnboardingSchema.safeParse({
        ...baseCourierInput,
        vehicleType: 'car',
        vehiclePlate: '   ',
      });
      expect(res.success).toBe(false);
    });

    it.each(['walk', 'bike'] as const)(
      'acepta vehículo %s y normaliza vehiclePlate a null con patente arbitraria/inválida, válida u omitida',
      (vehicle) => {
        // Con patente inválida / arbitraria
        const withInvalidPlate = {
          ...baseCourierInput,
          vehicleType: vehicle,
          vehiclePlate: 'TEXTO_ARBITRARIO_QUE_NO_DEBERIA_PERSISTIR',
        };
        const resInvalid = courierOnboardingSchema.safeParse(withInvalidPlate);
        expect(resInvalid.success).toBe(true);
        if (resInvalid.success) {
          expect(resInvalid.data.vehiclePlate).toBeNull();
        }

        // Con patente válida
        const withValidPlate = {
          ...baseCourierInput,
          vehicleType: vehicle,
          vehiclePlate: 'AB 123 CD',
        };
        const resValid = courierOnboardingSchema.safeParse(withValidPlate);
        expect(resValid.success).toBe(true);
        if (resValid.success) {
          expect(resValid.data.vehiclePlate).toBeNull();
        }

        // Sin patente (null u omitida)
        const withoutPlate = {
          ...baseCourierInput,
          vehicleType: vehicle,
          vehiclePlate: null,
        };
        const resOmitted = courierOnboardingSchema.safeParse(withoutPlate);
        expect(resOmitted.success).toBe(true);
        if (resOmitted.success) {
          expect(resOmitted.data.vehiclePlate).toBeNull();
        }
      }
    );
  });

  describe('T-357: Validación de actualización de vehículo (courierUpdateVehicleSchema)', () => {
    it('acepta moto con patente Mercosur o nacional válida y la formatea a mayúsculas', () => {
      const res = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'moto',
        vehiclePlate: 'ab 123 cd',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.vehicleType).toBe('moto');
        expect(res.data.vehiclePlate).toBe('AB 123 CD');
      }
    });

    it('rechaza moto o auto sin patente o con patente vacía', () => {
      const withoutPlate = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'moto',
      });
      expect(withoutPlate.success).toBe(false);

      const emptyPlate = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'car',
        vehiclePlate: '   ',
      });
      expect(emptyPlate.success).toBe(false);
    });

    it('rechaza moto o auto con formato de patente inválido', () => {
      const res = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'moto',
        vehiclePlate: 'INVALIDA',
      });
      expect(res.success).toBe(false);
    });

    it('acepta walk y bike sin patente y normaliza patente residual a null', () => {
      const walkRes = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'walk',
      });
      expect(walkRes.success).toBe(true);
      if (walkRes.success) {
        expect(walkRes.data.vehiclePlate).toBeNull();
      }

      const bikeWithPlate = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'bike',
        vehiclePlate: 'AB 123 CD',
      });
      expect(bikeWithPlate.success).toBe(true);
      if (bikeWithPlate.success) {
        expect(bikeWithPlate.data.vehiclePlate).toBeNull();
      }
    });

    it('rechaza documentos extras y campos desconocidos en edición (2-A)', () => {
      const docs = courierUpdateVehicleSchema.safeParse({
        vehicleType: 'moto', vehiclePlate: 'AB 123 CD',
        documents: { license: 'courier/docs/license.jpg' },
      });
      expect(docs.success).toBe(false);
      expect(courierUpdateVehicleSchema.safeParse({ vehicleType: 'bike', status: 'approved' }).success).toBe(false);
    });
  });
});

