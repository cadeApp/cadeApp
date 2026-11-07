import { describe, expect, it } from 'vitest';
import { buildSupportWhatsAppHref } from './support-whatsapp';

describe('T-412: WhatsApp del soporte', () => {
  it('arma wa.me con el número configurado y el mensaje codificado', () => {
    expect(buildSupportWhatsAppHref('+54 9 3865 123456', 'Quiero el plan «Plan 40» & más')).toBe(
      'https://wa.me/5493865123456?text=Quiero%20el%20plan%20%C2%ABPlan%2040%C2%BB%20%26%20m%C3%A1s'
    );
    expect(buildSupportWhatsAppHref('3865 123456', 'Hola')).toBe('https://wa.me/5493865123456?text=Hola');
  });

  it.each([undefined, '', 'numero-mal-formado', '+54 9 3865 123', '5493865123', '+54 9 3865 12345'])(
    'sin número válido (%s) devuelve null',
    (number) => {
      expect(buildSupportWhatsAppHref(number, 'Hola')).toBeNull();
    }
  );
});
