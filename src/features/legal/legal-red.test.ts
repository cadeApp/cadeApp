import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  getLegalDocument,
  type LegalDocumentName,
  type LegalDocumentDescriptor,
  type LegalSection,
} from './documents';
import { isCurrentLegalVersion } from './consent';
import { registerSchema } from '@/features/auth';
import { merchantOnboardingSchema } from '@/features/merchants';

describe('T-311 · DoD de rutas, versiones y consistencia con schemas reales (H12)', () => {
  it.each([
    ['Términos y Condiciones', 'src/app/(public)/legal/terms/page.tsx'],
    ['Política de Privacidad', 'src/app/(public)/legal/privacy/page.tsx'],
    ['Condiciones de repartidores', 'src/app/(public)/legal/courier/page.tsx'],
    ['Términos del piloto', 'src/app/(public)/legal/pilot/page.tsx'],
  ])('la ruta pública de %s existe', (_label, filePath) => {
    expect(existsSync(resolve(process.cwd(), filePath))).toBe(true);
  });

  it('registra una versión vigente y una ruta para cada documento legal persistible', () => {
    const documentNames: readonly LegalDocumentName[] = [
      'tos',
      'privacy',
      'courier_contract',
      'pilot_terms',
    ];

    for (const docName of documentNames) {
      const descriptor: LegalDocumentDescriptor = getLegalDocument(docName);
      expect(descriptor).toBeDefined();
      expect(descriptor.document).toBe(docName);
      expect(descriptor.version).toMatch(/^\d+\.\d+$/);
      expect(descriptor.href).toMatch(/^\/legal\//);
    }
  });

  it('rechaza como no vigente una aceptación cuya versión no coincide con el documento publicado', () => {
    expect(isCurrentLegalVersion('tos', '0.9')).toBe(false);
    expect(isCurrentLegalVersion('tos', '1.0')).toBe(true);
  });

  describe('Validación de schemas reales contra la Política de Privacidad (H11 / H12)', () => {
    it('registerSchema: displayName y phone son facultativos; email, password, role y versiones son obligatorios', () => {
      // Válido sin displayName ni phone
      const validWithoutOptional = registerSchema.safeParse({
        email: 'usuario@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });
      expect(validWithoutOptional.success).toBe(true);

      // Inválido sin campos obligatorios
      const invalidWithoutRequired = registerSchema.safeParse({
        role: 'merchant',
        acceptTerms: true,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });
      expect(invalidWithoutRequired.success).toBe(false);

      // Inválido con acceptTerms = false
      const invalidConsent = registerSchema.safeParse({
        email: 'usuario@test.com',
        password: 'password123',
        role: 'merchant',
        acceptTerms: false,
        acceptedTermsVersion: '1.0',
        acceptedPrivacyVersion: '1.0',
      });
      expect(invalidConsent.success).toBe(false);
    });

    it('merchantOnboardingSchema: defaultPickupZoneId, coords y notes son facultativos; businessName, phone, defaultPickupAddress y pilotTerms son obligatorios', () => {
      // Válido sin zona, coordenadas ni notas
      const validWithoutOptional = merchantOnboardingSchema.safeParse({
        businessName: 'Comercio Test',
        phone: '3815551234',
        defaultPickupAddress: 'Calle San Martín 123',
        acceptPilotTerms: true,
        pilotTermsVersion: '1.0',
      });
      expect(validWithoutOptional.success).toBe(true);

      // Inválido sin defaultPickupAddress
      const invalidWithoutAddress = merchantOnboardingSchema.safeParse({
        businessName: 'Comercio Test',
        phone: '3815551234',
        acceptPilotTerms: true,
        pilotTermsVersion: '1.0',
      });
      expect(invalidWithoutAddress.success).toBe(false);
    });

    it('courierOnboardingSchema: vehiclePlate es condicional (requerido para moto/auto, no para bike); license y insurance son facultativos', async () => {
      const { courierOnboardingSchema } = await import('@/features/courier-onboarding/schemas');
      const baseDocs = {
        dni_front: 'path/dni_front.jpg',
        dni_back: 'path/dni_back.jpg',
        selfie: 'path/selfie.jpg',
        avatar: 'path/avatar.jpg',
      };
      const baseConsents = {
        tos: true,
        privacy: true,
        courierContract: true,
        tosVersion: '1.0',
        privacyVersion: '1.0',
        courierContractVersion: '1.0',
      };

      // Bici sin patente: válido (y sin license/insurance)
      const validBike = courierOnboardingSchema.safeParse({
        dni: '38123456',
        vehicleType: 'bike',
        documents: baseDocs,
        consents: baseConsents,
      });
      expect(validBike.success).toBe(true);

      // Moto sin patente: inválido
      const invalidMoto = courierOnboardingSchema.safeParse({
        dni: '38123456',
        vehicleType: 'moto',
        documents: baseDocs,
        consents: baseConsents,
      });
      expect(invalidMoto.success).toBe(false);

      // Auto sin patente: inválido
      const invalidCar = courierOnboardingSchema.safeParse({
        dni: '38123456',
        vehicleType: 'car',
        documents: baseDocs,
        consents: baseConsents,
      });
      expect(invalidCar.success).toBe(false);

      // Moto con patente válida: válido
      const validMoto = courierOnboardingSchema.safeParse({
        dni: '38123456',
        vehicleType: 'moto',
        vehiclePlate: 'A 123 BCD',
        documents: baseDocs,
        consents: baseConsents,
      });
      expect(validMoto.success).toBe(true);
    });

    it('createDeliveryRequestSchema: coords y notes son facultativos; cashChangeAmount es condicional a needsChange en efectivo', async () => {
      const { createDeliveryRequestSchema } = await import('@/features/requests/schemas');
      const baseRequest = {
        pickupZoneId: '11111111-1111-1111-1111-111111111111',
        pickupAddress: 'Dirección retiro 123',
        dropoffZoneId: '22222222-2222-2222-2222-222222222222',
        dropoffAddress: 'Dirección entrega 456',
        recipientName: 'Juan Pérez',
        recipientPhone: '3815559876',
        recipientConsentDeclared: true,
        packageType: 'chico' as const,
        recipientPaymentMethod: 'transfer' as const,
        needsChange: false,
      };

      // Válido sin coords ni notes
      const validWithoutCoords = createDeliveryRequestSchema.safeParse(baseRequest);
      expect(validWithoutCoords.success).toBe(true);

      // Pago en efectivo con needsChange=true sin cashChangeAmount: inválido
      const invalidCashChange = createDeliveryRequestSchema.safeParse({
        ...baseRequest,
        recipientPaymentMethod: 'cash',
        needsChange: true,
      });
      expect(invalidCashChange.success).toBe(false);

      // Pago en efectivo con needsChange=true con cashChangeAmount válido: válido
      const validCashChange = createDeliveryRequestSchema.safeParse({
        ...baseRequest,
        recipientPaymentMethod: 'cash',
        needsChange: true,
        cashChangeAmount: 5000,
      });
      expect(validCashChange.success).toBe(true);
    });

    it('la Política de Privacidad describe textualmente la obligatoriedad y facultatividad de los esquemas sin ningún type cast "any" (H11 / H12)', () => {
      const privacy: LegalDocumentDescriptor = getLegalDocument('privacy');
      expect(privacy).toBeDefined();

      const section: LegalSection | undefined = privacy.sections.find(
        (s: LegalSection) => s.id === 'obligatoriedad-consecuencias'
      );
      expect(section).toBeDefined();
      const text = section?.paragraphs?.join(' ') ?? '';

      // Describe registro
      expect(text).toMatch(/displayName.*facultativo/i);
      expect(text).toMatch(/teléfono.*facultativo/i);

      // Describe comercio
      expect(text).toMatch(/businessName/);
      expect(text).toMatch(/defaultPickupAddress/);
      expect(text).toMatch(/defaultPickupZoneId.*facultativ/i);

      // Describe repartidor
      expect(text).toMatch(/vehicleType/);
      expect(text).toMatch(/patente.*moto o auto.*condicional/i);
      expect(text).toMatch(/licencia.*seguro.*facultativ/i);

      // Describe solicitud
      expect(text).toMatch(/pickupZoneId.*pickupAddress/);
      expect(text).toMatch(/recipientConsentDeclared/);
      expect(text).toMatch(/needsChange/);
    });
  });
});
