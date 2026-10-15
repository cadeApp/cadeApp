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

  describe('buildNotifyCustomerWhatsAppMessage ("Avisar a mi cliente" [T-361])', () => {
    describe('Remitente: courier (primera persona)', () => {
      it('en estado matched (pre-retiro): 1ª persona, asignado por retirar, nunca afirma en camino', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'courier',
          tripStatus: 'matched',
        });

        expect(msg).toBe(
          '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Ya tengo asignado tu pedido y en breve voy a retirarlo para llevártelo. ¡Nos vemos pronto!'
        );
        expect(msg).toContain('Soy Carlos Benítez');
        expect(msg).toContain('Ya tengo asignado tu pedido');
        expect(msg.toLowerCase()).not.toContain('en camino');
        expect(msg).not.toContain('REQ-');
      });

      it('en estado in_transit (reparto/recorrido): 1ª persona, describe recorrido sin asegurar llegada inmediata', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'courier',
          tripStatus: 'in_transit',
          dropStatus: 'pending',
        });

        expect(msg).toBe(
          '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Ya retiré tu pedido y estoy en recorrido para la entrega. ¡Nos vemos pronto!'
        );
        expect(msg).toContain('Soy Carlos Benítez');
        expect(msg).toMatch(/recorrido|reparto/i);
        expect(msg).not.toContain('ya fue entregado');
        expect(msg).not.toContain('no se pudo completar');
      });

      it('en estado delivered (drop delivered o single drop delivered): 1ª persona, confirmación cortés de entrega', () => {
        const msgMulti = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'courier',
          tripStatus: 'in_transit',
          dropStatus: 'delivered',
        });
        expect(msgMulti).toBe(
          '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Tu pedido ya fue entregado. ¡Muchas gracias!'
        );
        expect(msgMulti).toContain('Soy Carlos Benítez');
        expect(msgMulti).toContain('ya fue entregado');
        expect(msgMulti.toLowerCase()).not.toContain('en camino');

        const msgSingle = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'courier',
          tripStatus: 'delivered',
        });
        expect(msgSingle).toBe(
          '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Tu pedido ya fue entregado. ¡Muchas gracias!'
        );
      });

      it('en estado failed (drop failed): 1ª persona, aviso honesto de no entrega', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'courier',
          tripStatus: 'in_transit',
          dropStatus: 'failed',
        });

        expect(msg).toBe(
          '¡Hola! Soy Carlos Benítez, el repartidor de tu entrega. Quería avisarte que no se pudo completar la entrega de tu pedido. ¡Saludos!'
        );
        expect(msg).toContain('Soy Carlos Benítez');
        expect(msg).toContain('no se pudo completar la entrega');
        expect(msg.toLowerCase()).not.toContain('en camino');
        expect(msg).not.toContain('ya fue entregado');
      });
    });

    describe('Remitente: merchant (tercera persona)', () => {
      it('en estado matched (pre-retiro): 3ª persona, jamás dice "Soy Carlos", asignado por retirar', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'merchant',
          tripStatus: 'matched',
        });

        expect(msg).toBe(
          '¡Hola! Te escribo del comercio. Carlos Benítez es el repartidor asignado a tu pedido y en breve va a retirarlo. ¡Saludos!'
        );
        expect(msg).not.toMatch(/soy\s+carlos/i);
        expect(msg).toContain('Carlos Benítez es el repartidor asignado');
        expect(msg.toLowerCase()).not.toContain('en camino');
      });

      it('en estado in_transit (reparto/recorrido): 3ª persona, pedido retirado en recorrido', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'merchant',
          tripStatus: 'in_transit',
          dropStatus: 'pending',
        });

        expect(msg).toBe(
          '¡Hola! Te escribo del comercio. Carlos Benítez ya retiró tu pedido y está en recorrido para la entrega. ¡Saludos!'
        );
        expect(msg).not.toMatch(/soy\s+carlos/i);
        expect(msg).toContain('Carlos Benítez ya retiró tu pedido y está en recorrido');
        expect(msg).not.toContain('ya fue entregado');
      });

      it('en estado delivered: 3ª persona, entregado por el repartidor', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'merchant',
          tripStatus: 'in_transit',
          dropStatus: 'delivered',
        });

        expect(msg).toBe(
          '¡Hola! Te escribo del comercio. Tu pedido ya fue entregado por Carlos Benítez. ¡Muchas gracias por tu compra!'
        );
        expect(msg).not.toMatch(/soy\s+carlos/i);
        expect(msg).toContain('ya fue entregado por Carlos Benítez');
        expect(msg.toLowerCase()).not.toContain('en camino');
      });

      it('en estado failed: 3ª persona, aviso honesto de no entrega por parte del repartidor', () => {
        const msg = buildNotifyCustomerWhatsAppMessage({
          courierName: 'Carlos Benítez',
          sender: 'merchant',
          tripStatus: 'in_transit',
          dropStatus: 'failed',
        });

        expect(msg).toBe(
          '¡Hola! Te escribo del comercio. Quería avisarte que Carlos Benítez no pudo completar la entrega de tu pedido. Por favor avisanos para coordinar. ¡Saludos!'
        );
        expect(msg).not.toMatch(/soy\s+carlos/i);
        expect(msg).toContain('Carlos Benítez no pudo completar la entrega');
        expect(msg.toLowerCase()).not.toContain('en camino');
        expect(msg).not.toContain('ya fue entregado');
      });
    });

    describe('Invariante de Privacidad (Allowlist estricta y Sentinelas)', () => {
      it('H04 & T-361: no contiene teléfono del repartidor, patente, DNI, ids técnicos, importes ni sentinelas (courier)', () => {
        const wideParams = {
          courierName: 'Carlos Benítez',
          sender: 'courier' as const,
          tripStatus: 'in_transit' as const,
          dropStatus: 'pending' as const,
          courierPhone: SENTINEL_PHONE,
          dropoffAddress: SENTINEL_ADDR,
          deliveryNotes: SENTINEL_NOTE,
          coords: SENTINEL_COORDS,
          requestId: SENTINEL_ID,
          requestCode: 'REQ-9999',
          dni: SENTINEL_DNI,
          licensePlate: 'AB 123 CD',
          amountArs: 1800,
          recipientPaymentMethod: 'cash',
        } as unknown as NotifyCustomerMessageParams;

        const msg = buildNotifyCustomerWhatsAppMessage(wideParams);

        expect(msg).toContain('Carlos Benítez');
        expect(msg).not.toContain(SENTINEL_PHONE);
        expect(msg).not.toContain(SENTINEL_ADDR);
        expect(msg).not.toContain(SENTINEL_NOTE);
        expect(msg).not.toContain(SENTINEL_COORDS);
        expect(msg).not.toContain(SENTINEL_ID);
        expect(msg).not.toContain('REQ-9999');
        expect(msg).not.toContain(SENTINEL_DNI);
        expect(msg).not.toContain('1800');
        expect(msg).not.toContain('$');
        expect(msg.toLowerCase()).not.toContain('efectivo');
        expect(msg.toLowerCase()).not.toContain('patente');
        expect(msg.toLowerCase()).not.toContain('dni');
        expect(msg.toLowerCase()).not.toContain('uuid');
        expect(msg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
      });

      it('H04 & T-361: no contiene datos privados ni técnicos para merchant', () => {
        const wideMerchantParams = {
          courierName: 'Carlos Benítez',
          sender: 'merchant' as const,
          tripStatus: 'matched' as const,
          courierPhone: SENTINEL_PHONE,
          requestId: SENTINEL_ID,
          requestCode: 'REQ-9999',
          amountArs: 2500,
        } as unknown as NotifyCustomerMessageParams;

        const msg = buildNotifyCustomerWhatsAppMessage(wideMerchantParams);

        expect(msg).toContain('Carlos Benítez');
        expect(msg).not.toContain(SENTINEL_PHONE);
        expect(msg).not.toContain(SENTINEL_ID);
        expect(msg).not.toContain('REQ-9999');
        expect(msg).not.toContain('2500');
        expect(msg).not.toContain('$');
      });
    });
  });

  describe('buildWhatsAppUrl (H12: Validación estricta a 10 dígitos nacionales)', () => {
    it('construye la URL de wa.me con prefijo internacional 549 y texto codificado para 10 dígitos', () => {
      const url = buildWhatsAppUrl('3865123456', 'Hola, voy en camino');
      expect(url).toBe('https://wa.me/5493865123456?text=Hola%2C%20voy%20en%20camino');
    });

    it('codifica correctamente caracteres especiales, tildes, signos de puntuación y emojis', () => {
      const specialMsg = '¡Hola! ¿Cómo estás? Pedido listo 🚀 — San Martín & Belgrano';
      const url = buildWhatsAppUrl('3865123456', specialMsg);
      expect(url).toBe(`https://wa.me/5493865123456?text=${encodeURIComponent(specialMsg)}`);
      expect(decodeURIComponent(new URL(url).searchParams.get('text') ?? '')).toBe(specialMsg);
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

    it('rechaza números con caracteres alfabéticos o símbolos prohibidos', () => {
      expect(() => buildWhatsAppUrl('3865123456abc', 'Hola')).toThrow(/letras/i);
      expect(() => buildWhatsAppUrl('3865@123456', 'Hola')).toThrow();
    });
  });
});
