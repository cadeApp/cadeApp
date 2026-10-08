import { describe, it, expect } from 'vitest';
import { DOMAIN_ERROR_CODES } from '@/domain/errors';
import { DOMAIN_ERROR_MESSAGES, getDomainErrorMessage } from './error-messages';

describe('error-messages dictionary and resolver', () => {
  it('covers every DomainErrorCode defined in DOMAIN_ERROR_CODES', () => {
    for (const code of DOMAIN_ERROR_CODES) {
      expect(DOMAIN_ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof DOMAIN_ERROR_MESSAGES[code]).toBe('string');
      expect(DOMAIN_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it('includes CC-021 messages for FIXED_PRICE_REQUEST and NO_FIXED_PRICE', () => {
    expect(DOMAIN_ERROR_MESSAGES.FIXED_PRICE_REQUEST).toBe(
      'Este envío tiene precio fijo: tomalo desde el botón'
    );
    expect(DOMAIN_ERROR_MESSAGES.NO_FIXED_PRICE).toBe(
      'Este envío no tiene precio fijo: hacé tu oferta'
    );
    expect(getDomainErrorMessage('FIXED_PRICE_REQUEST')).toBe(
      'Este envío tiene precio fijo: tomalo desde el botón'
    );
    expect(getDomainErrorMessage('NO_FIXED_PRICE')).toBe(
      'Este envío no tiene precio fijo: hacé tu oferta'
    );
  });

  it('passes through unknown custom messages unmodified', () => {
    expect(getDomainErrorMessage('Mensaje customizado')).toBe('Mensaje customizado');
  });
});
