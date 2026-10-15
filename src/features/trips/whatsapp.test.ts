import { describe, expect, it } from 'vitest';
import {
  buildTripCoordinationWhatsAppMessage,
  buildNotifyCustomerWhatsAppMessage,
  buildWhatsAppUrl,
  type CoordinationMessageParams,
  type NotifyCustomerMessageParams,
} from '@/lib/whatsapp';

describe('T-115 DoD: Unit de los mensajes de WhatsApp (monto aceptado, sin datos de más)', () => {
  const SENTINEL_ADDR = 'DIRECCION_RESTRINGIDA_OCULTA_123';
  const SENTINEL_NOTE = 'TIMBRE_SECRETO_NO_DIFUNDIR';
  const SENTINEL_COORDS = '-27.4321,-65.6123';
  const SENTINEL_ID = 'UUID-INTERNO-BASE-DE-DATOS-999';
  const SENTINEL_DNI = 'DNI-CONFIDENCIAL-12345678';
  const SENTINEL_PHONE = '3819999999';

  describe('buildTripCoordinationWhatsAppMessage (comercio ↔ repartidor)', () => {
    const baseParams: CoordinationMessageParams = {
      requestCode: 'REQ-4821',
      pickupZoneName: 'Centro',
      dropoffZoneName: 'Barrio San Martín',
      amountArs: 1500,
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: 5000,
    };

    it('incluye el código del envío, barrios, monto acordado en ARS y medio de pago', () => {
      const msg = buildTripCoordinationWhatsAppMessage(baseParams);

      expect(msg).toContain('REQ-4821');
      expect(msg).toContain('Centro');
      expect(msg).toContain('Barrio San Martín');
      expect(msg).toContain('$ 1.500');
      expect(msg).toContain('Efectivo');
      expect(msg).toContain('$ 5.000');
    });

    it('soporta medio de pago transferencia y a coordinar sin cambio', () => {
      const transferMsg = buildTripCoordinationWhatsAppMessage({
        ...baseParams,
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        cashChangeAmount: null,
      });
      expect(transferMsg).toContain('Transferencia');
      expect(transferMsg).not.toContain('cambio');

      const toAgreeMsg = buildTripCoordinationWhatsAppMessage({
        ...baseParams,
        recipientPaymentMethod: 'to_agree',
        needsChange: false,
        cashChangeAmount: null,
      });
      expect(toAgreeMsg).toContain('A coordinar');
    });

    it('H04: invariante "sin datos de más" usando allowlist estricta y verificando sentinelas', () => {
      const wideParams = {
        ...baseParams,
        recipientAddress: SENTINEL_ADDR,
        deliveryNotes: SENTINEL_NOTE,
        coordinates: SENTINEL_COORDS,
        requestId: SENTINEL_ID,
        dni: SENTINEL_DNI,
        courierPhone: SENTINEL_PHONE,
      } as unknown as CoordinationMessageParams;

      const msg = buildTripCoordinationWhatsAppMessage(wideParams);

      // Aserciones positivas: solo campos permitidos
      expect(msg).toContain('REQ-4821');
      expect(msg).toContain('Centro');
      expect(msg).toContain('Barrio San Martín');
      expect(msg).toContain('$ 1.500');

      // Aserciones de privacidad: NINGÚN sentinela debe filtrarse
      expect(msg).not.toContain(SENTINEL_ADDR);
      expect(msg).not.toContain(SENTINEL_NOTE);
      expect(msg).not.toContain(SENTINEL_COORDS);
      expect(msg).not.toContain(SENTINEL_ID);
      expect(msg).not.toContain(SENTINEL_DNI);
      expect(msg).not.toContain(SENTINEL_PHONE);
      expect(msg).not.toMatch(/(?:\+54|549)?\d{10,13}/);
      expect(msg.toLowerCase()).not.toContain('token');
      expect(msg.toLowerCase()).not.toContain('password');
    });
  });

  describe('buildNotifyCustomerWhatsAppMessage ("Avisar a mi cliente": repartidor ↔ destinatario [T-361])', () => {
    const baseCustomerParams: NotifyCustomerMessageParams = {
      courierName: 'Carlos Benítez',
      status: 'in_transit',
      amountArs: 1800,
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: 2000,
    };

    it('en estado in_transit: genera texto claro, humano y natural avisando que está en camino', () => {
      const msg = buildNotifyCustomerWhatsAppMessage(baseCustomerParams);

      expect(msg).toBe(
        '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Te aviso que estoy en camino. ¡Nos vemos pronto!'
      );
      expect(msg).toContain('Carlos Benítez');
      expect(msg).toContain('estoy en camino');
      expect(msg).not.toContain('REQ-');
      expect(msg).not.toContain('Costo de envío:');
      expect(msg).not.toContain('Medio de pago:');
    });

    it('en estado matched (antes del retiro): no afirma "en camino" y avisa pedido asignado por retirar', () => {
      const prePickupMsg = buildNotifyCustomerWhatsAppMessage({
        ...baseCustomerParams,
        status: 'matched',
      });

      expect(prePickupMsg).toBe(
        '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Ya tengo asignado tu pedido y en breve voy a retirarlo para llevártelo. ¡Nos vemos pronto!'
      );
      expect(prePickupMsg).toContain('Carlos Benítez');
      expect(prePickupMsg.toLowerCase()).not.toContain('en camino');
      expect(prePickupMsg).not.toContain('REQ-');
    });

    it('en estado delivered: avisa entrega completada con cortesía', () => {
      const deliveredMsg = buildNotifyCustomerWhatsAppMessage({
        ...baseCustomerParams,
        status: 'delivered',
      });

      expect(deliveredMsg).toBe(
        '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Tu pedido ya fue entregado. ¡Muchas gracias!'
      );
      expect(deliveredMsg.toLowerCase()).not.toContain('en camino');
    });

    it('H04 & T-361: invariante "sin datos de más": no contiene teléfono del repartidor, patente, DNI, ids técnicos ni sentinelas', () => {
      const wideCustomerParams = {
        ...baseCustomerParams,
        courierPhone: SENTINEL_PHONE,
        dropoffAddress: SENTINEL_ADDR,
        deliveryNotes: SENTINEL_NOTE,
        coords: SENTINEL_COORDS,
        requestId: SENTINEL_ID,
        requestCode: 'REQ-9999',
        dni: SENTINEL_DNI,
        licensePlate: 'AB 123 CD',
      } as unknown as NotifyCustomerMessageParams;

      const msg = buildNotifyCustomerWhatsAppMessage(wideCustomerParams);

      expect(msg).toContain('Carlos Benítez');
      expect(msg).not.toContain(SENTINEL_PHONE);
      expect(msg).not.toContain(SENTINEL_ADDR);
      expect(msg).not.toContain(SENTINEL_NOTE);
      expect(msg).not.toContain(SENTINEL_COORDS);
      expect(msg).not.toContain(SENTINEL_ID);
      expect(msg).not.toContain('REQ-9999');
      expect(msg).not.toContain(SENTINEL_DNI);
      expect(msg.toLowerCase()).not.toContain('patente');
      expect(msg.toLowerCase()).not.toContain('dni');
      expect(msg.toLowerCase()).not.toContain('uuid');
      expect(msg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    });
  });

  describe('buildWhatsAppUrl (H12: Validación estricta a 10 dígitos nacionales)', () => {
    it('construye la URL de wa.me con prefijo internacional 549 y texto codificado para 10 dígitos', () => {
      const url = buildWhatsAppUrl('3865123456', 'Hola, voy en camino');
      expect(url).toBe('https://wa.me/5493865123456?text=Hola%2C%20voy%20en%20camino');
    });

    it('limpia prefijos 0 y 15 para números argentinos manteniendo exactamente 10 dígitos', () => {
      const url = buildWhatsAppUrl('03865 15-123456', 'Hola');
      expect(url).toBe('https://wa.me/5493865123456?text=Hola');
    });

    it('limpia prefijos internacionales +54 y 549 manteniendo 10 dígitos nacionales', () => {
      const urlWith54 = buildWhatsAppUrl('+54 3865 123456', 'Hola');
      expect(urlWith54).toBe('https://wa.me/5493865123456?text=Hola');

      const urlWith549 = buildWhatsAppUrl('+54 9 3865 123456', 'Hola');
      expect(urlWith549).toBe('https://wa.me/5493865123456?text=Hola');
    });

    it('H12: rechaza números con menos de 10 dígitos nacionales (7, 8, 9 dígitos)', () => {
      expect(() => buildWhatsAppUrl('1234567', 'Hola')).toThrow(/10 dígitos/i);
      expect(() => buildWhatsAppUrl('38651234', 'Hola')).toThrow(/10 dígitos/i);
      expect(() => buildWhatsAppUrl('386512345', 'Hola')).toThrow(/10 dígitos/i);
    });

    it('H12: rechaza números con más de 10 dígitos nacionales (11 o más dígitos)', () => {
      expect(() => buildWhatsAppUrl('38651234567', 'Hola')).toThrow(/10 dígitos/i);
      expect(() => buildWhatsAppUrl('03865151234567', 'Hola')).toThrow(/10 dígitos/i);
    });

    it('H12: rechaza cadenas vacías o solo espacios', () => {
      expect(() => buildWhatsAppUrl('', 'Hola')).toThrow();
      expect(() => buildWhatsAppUrl('   ', 'Hola')).toThrow();
    });
  });
});
