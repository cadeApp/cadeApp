import { describe, expect, it } from 'vitest';
import { liveFeedResponseSchema } from '@/lib/live-contracts';
import {
  assertNoPrivateFieldsInRawPayload,
  findRawPayloadPrivacyViolations,
  FORBIDDEN_PRIVATE_KEYS,
} from './privacy-checker';

describe('H12: Oráculo de privacidad sobre payloads crudos de red', () => {
  const legitimatePublicItem = {
    id: '30000000-0000-4000-8000-000000003700',
    pickupZoneName: 'Centro Aguilares',
    dropoffZoneName: 'Barrio Norte',
    packageType: 'mediano',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    approxDistanceKm: '2.5 km',
    publishedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
    hasMyOffer: false,
    myOfferAmountArs: null,
    dropsCount: 3,
    drops: [
      {
        id: 'drop-1',
        position: 1,
        dropoffZoneName: 'Barrio Norte',
        packageType: 'mediano',
        recipientPaymentMethod: 'cash',
        needsChange: true,
        approxDistanceM: 1200,
      },
      {
        id: 'drop-2',
        position: 2,
        dropoffZoneName: 'Barrio Sur',
        packageType: 'grande',
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        approxDistanceM: 1800,
      },
      {
        id: 'drop-3',
        position: 3,
        dropoffZoneName: 'Zona Industrial',
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        approxDistanceM: 2500,
      },
    ],
  };

  const legitimateFeed = {
    data: [legitimatePublicItem],
    nextCursor: null,
  };

  it('GREEN: payload público legítimo no contiene ninguna clave privada ni valores prohibidos', () => {
    const forbiddenValues = [
      'Destinatario Uno MD',
      'Timbre blanco drop 1',
      '3865111111',
      'Av. Sarmiento 100',
      '5000',
    ];

    expect(() => {
      assertNoPrivateFieldsInRawPayload(legitimatePublicItem, forbiddenValues);
    }).not.toThrow();

    expect(() => {
      assertNoPrivateFieldsInRawPayload(legitimateFeed, forbiddenValues);
    }).not.toThrow();
  });

  it('RED ADVERSARIAL: Zod strip oculta campos PII desconocidos, pero el detector crudo los intercepta y falla', () => {
    // Payload con inyección adversarial de PII
    const rawPayloadWithPii = {
      ...legitimatePublicItem,
      recipientPhone: '3865111111',
      notes: 'PII_TEST_NOTAS',
      recipient_name: 'Juan Perez',
      dropoff_address: 'Av. Sarmiento 100',
      cash_change_amount: 5000,
    };

    const feedWithPii = {
      data: [rawPayloadWithPii],
      nextCursor: null,
    };

    // 1. Demostración de vulnerabilidad de Zod strip:
    // liveFeedResponseSchema.parse() elimina silenciosamente los campos extra
    const parsedFeed = liveFeedResponseSchema.parse(feedWithPii);
    const parsedItem = parsedFeed.data[0]!;
    // El objeto parseado NO tiene recipientPhone ni notes en sus propiedades directas
    expect((parsedItem as Record<string, unknown>).recipientPhone).toBeUndefined();
    expect((parsedItem as Record<string, unknown>).notes).toBeUndefined();
    expect((parsedItem as Record<string, unknown>).dropoff_address).toBeUndefined();
    // JSON.stringify del ítem parseado NO contendría el teléfono inyectado:
    expect(JSON.stringify(parsedItem)).not.toContain('3865111111');
    expect(JSON.stringify(parsedItem)).not.toContain('PII_TEST_NOTAS');

    // 2. Comprobación del NUEVO detector crudo (RED para el payload contaminado):
    // El detector sobre el JSON crudo intercepta inmediatamente todas las claves y valores
    const violations = findRawPayloadPrivacyViolations(rawPayloadWithPii, [
      '3865111111',
      'PII_TEST_NOTAS',
      'Av. Sarmiento 100',
    ]);
    expect(violations.length).toBeGreaterThanOrEqual(5);

    expect(() => {
      assertNoPrivateFieldsInRawPayload(rawPayloadWithPii, [
        '3865111111',
        'PII_TEST_NOTAS',
      ]);
    }).toThrow(/Fuga de privacidad detectada en payload crudo/i);
  });

  it('RED ADVERSARIAL: detecta claves privadas anidadas dentro del array drops[]', () => {
    const rawPayloadWithNestedPii = {
      ...legitimatePublicItem,
      drops: [
        {
          ...legitimatePublicItem.drops[0],
          recipientPhone: '3865111111',
          deliveryNotes: 'Dejar en timbre 1',
        },
        legitimatePublicItem.drops[1],
        {
          ...legitimatePublicItem.drops[2],
          cashChangeAmount: 2000,
          dropoffAddress: 'Mitre 300',
        },
      ],
    };

    const violations = findRawPayloadPrivacyViolations(rawPayloadWithNestedPii, [
      '3865111111',
      'Dejar en timbre 1',
      'Mitre 300',
    ]);

    expect(violations.some((v) => v.detail.includes('recipientPhone'))).toBe(true);
    expect(violations.some((v) => v.detail.includes('deliveryNotes'))).toBe(true);
    expect(violations.some((v) => v.detail.includes('cashChangeAmount'))).toBe(true);
    expect(violations.some((v) => v.detail.includes('dropoffAddress'))).toBe(true);

    expect(() => {
      assertNoPrivateFieldsInRawPayload(rawPayloadWithNestedPii);
    }).toThrow(/Fuga de privacidad detectada en payload crudo/i);
  });

  it('Verifica cobertura exhaustiva de todas las claves prohibidas en FORBIDDEN_PRIVATE_KEYS', () => {
    for (const forbiddenKey of FORBIDDEN_PRIVATE_KEYS) {
      const payloadWithSingleKey = {
        id: 'some-id',
        [forbiddenKey]: 'valor-sensible',
      };
      expect(() => {
        assertNoPrivateFieldsInRawPayload(payloadWithSingleKey);
      }).toThrow(new RegExp(forbiddenKey, 'i'));
    }
  });
});
