import { describe, expect, it } from 'vitest';
import {
  buildTripCoordinationWhatsAppMessage,
  buildNotifyCustomerWhatsAppMessage,
  buildWhatsAppUrl,
  type CoordinationMessageParams,
  type NotifyCustomerMessageParams,
} from '@/lib/whatsapp';

describe('T-115 DoD: Unit de los mensajes de WhatsApp (monto aceptado, sin datos de más)', () => {
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

      // Código de envío
      expect(msg).toContain('REQ-4821');
      // Barrios
      expect(msg).toContain('Centro');
      expect(msg).toContain('Barrio San Martín');
      // Monto acordado
      expect(msg).toContain('$ 1.500');
      // Medio de pago y cambio
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

    it('invariante "sin datos de más": no filtra teléfono del destinatario, DNI ni datos personales innecesarios', () => {
      const msg = buildTripCoordinationWhatsAppMessage(baseParams);

      // No debe contener números de teléfono
      expect(msg).not.toMatch(/(?:\+54|549)?\d{10,13}/);
      // No debe contener campos sensibles no autorizados
      expect(msg.toLowerCase()).not.toContain('dni');
      expect(msg.toLowerCase()).not.toContain('cuit');
      expect(msg.toLowerCase()).not.toContain('token');
      expect(msg.toLowerCase()).not.toContain('password');
    });
  });

  describe('buildNotifyCustomerWhatsAppMessage ("Avisar a mi cliente": comercio ↔ destinatario)', () => {
    const baseCustomerParams: NotifyCustomerMessageParams = {
      amountArs: 1800,
      courierName: 'Carlos Benítez',
      recipientPaymentMethod: 'cash',
      needsChange: true,
      cashChangeAmount: 2000,
    };

    it('incluye el costo del envío acordado, nombre del repartidor y medio de pago', () => {
      const msg = buildNotifyCustomerWhatsAppMessage(baseCustomerParams);

      // Costo acordado
      expect(msg).toContain('$ 1.800');
      // Nombre del repartidor
      expect(msg).toContain('Carlos Benítez');
      // Medio de pago
      expect(msg).toContain('Efectivo');
      expect(msg).toContain('$ 2.000');
    });

    it('invariante "sin datos de más": no contiene teléfono del repartidor, patente, DNI ni ids técnicos', () => {
      const msg = buildNotifyCustomerWhatsAppMessage(baseCustomerParams);

      // Solo datos necesarios para el cliente
      expect(msg.toLowerCase()).not.toContain('patente');
      expect(msg.toLowerCase()).not.toContain('dni');
      expect(msg.toLowerCase()).not.toContain('uuid');
      expect(msg.toLowerCase()).not.toContain('id:');
      expect(msg).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('construye la URL de wa.me con prefijo internacional 549 y texto codificado', () => {
      const url = buildWhatsAppUrl('3865123456', 'Hola, voy en camino');
      expect(url).toBe('https://wa.me/5493865123456?text=Hola%2C%20voy%20en%20camino');
    });

    it('limpia prefijos 0 y 15 para números argentinos', () => {
      const url = buildWhatsAppUrl('03865 15-123456', 'Hola');
      expect(url).toBe('https://wa.me/5493865123456?text=Hola');
    });

    it('lanza error o rechaza teléfonos inválidos de menos de 8 dígitos', () => {
      expect(() => buildWhatsAppUrl('123', 'Hola')).toThrow();
    });
  });
});
