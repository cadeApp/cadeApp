import { describe, expect, it } from 'vitest';
import { formatArs, formatDate, formatPhone, whatsappLink } from './index';

describe('T-008 · DoD Formateadores únicos en src/lib/format/', () => {
  describe('formatArs (montos en pesos argentinos enteros sin decimales)', () => {
    it('formatea enteros con signo $, espacio y separador de miles con punto sin decimales', () => {
      expect(formatArs(0)).toBe('$ 0');
      expect(formatArs(1000)).toBe('$ 1.000');
      expect(formatArs(1500)).toBe('$ 1.500');
      expect(formatArs(125000)).toBe('$ 125.000');
      expect(formatArs(1250000)).toBe('$ 1.250.000');
    });

    it('nunca incluye coma decimal ni centavos y rechaza NaN/infinitos o negativos inválidos', () => {
      const formatted = formatArs(2500);
      expect(formatted).not.toContain(',');
      expect(formatted).toBe('$ 2.500');
      expect(() => formatArs(Number.NaN)).toThrow();
      expect(() => formatArs(-500)).toThrow();
      expect(() => formatArs(1500.5)).toThrow();
    });
  });

  describe('formatDate (fechas siempre en zona America/Argentina/Buenos_Aires)', () => {
    it('convierte un timestamp UTC de madrugada a la hora local argentina (UTC-3)', () => {
      // 2026-09-23T01:30:00.000Z son las 22:30 del 22/09/2026 en Argentina (UTC-3)
      const isoUtc = '2026-09-23T01:30:00.000Z';
      expect(formatDate(isoUtc, 'dateTime')).toBe('22/09/2026 22:30');
      expect(formatDate(isoUtc, 'date')).toBe('22/09/2026');
      expect(formatDate(isoUtc, 'time')).toBe('22:30');
    });

    it('acepta instancias Date y números epoch y rechaza fechas inválidas', () => {
      const dateObj = new Date('2026-09-22T15:05:00.000Z');
      expect(formatDate(dateObj, 'dateTime')).toBe('22/09/2026 12:05');
      expect(() => formatDate('not-a-valid-date')).toThrow();
    });
  });

  describe('formatPhone y whatsappLink (teléfonos de Aguilares / Tucumán)', () => {
    it('normaliza teléfonos móviles argentinos para lectura clara en pantalla', () => {
      expect(formatPhone('+5493865123456')).toBe('3865 12-3456');
      expect(formatPhone('3865123456')).toBe('3865 12-3456');
      expect(formatPhone('03865 15-123456')).toBe('3865 12-3456');
    });

    it('genera enlaces wa.me válidos con código de país 549 y texto codificado opcional', () => {
      expect(whatsappLink('3865123456')).toBe('https://wa.me/5493865123456');
      expect(whatsappLink('+54 9 3865 12-3456', 'Hola, soy el repartidor de cadeApp')).toBe(
        'https://wa.me/5493865123456?text=Hola%2C%20soy%20el%20repartidor%20de%20cadeApp'
      );
    });
  });
});
