import { describe, expect, it } from 'vitest';
import {
  extractValidArgentineTenDigits,
  isValidArgentinePhone,
} from './whatsapp';

describe('T-353: Validación semántica y normalización estricta de teléfonos argentinos', () => {
  describe('extractValidArgentineTenDigits', () => {
    it('normaliza correctamente teléfonos de 10 dígitos nacionales directos', () => {
      expect(extractValidArgentineTenDigits('3865123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('1123456789')).toBe('1123456789');
      expect(extractValidArgentineTenDigits('3814123456')).toBe('3814123456');
    });

    it('normaliza teléfonos con espacios, guiones y paréntesis', () => {
      expect(extractValidArgentineTenDigits('3865 12-3456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('(3865) 12-3456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('11 2345-6789')).toBe('1123456789');
      expect(extractValidArgentineTenDigits('(011) 2345-6789')).toBe('1123456789');
    });

    it('normaliza teléfonos con prefijo 0 local y 15 móvil intermedio', () => {
      // Área 4 dígitos (ej: Aguilares/Concepción 3865)
      expect(extractValidArgentineTenDigits('03865 15 123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('0386515123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('(03865) 15-123456')).toBe('3865123456');

      // Área 3 dígitos (ej: Tucumán 381)
      expect(extractValidArgentineTenDigits('0381 15 4123456')).toBe('3814123456');
      expect(extractValidArgentineTenDigits('(0381) 15-4123456')).toBe('3814123456');

      // Área 2 dígitos (ej: Buenos Aires 11)
      expect(extractValidArgentineTenDigits('011 15 23456789')).toBe('1123456789');
      expect(extractValidArgentineTenDigits('(011) 15-2345-6789')).toBe('1123456789');
    });

    it('normaliza teléfonos con prefijo internacional +54 y +549', () => {
      expect(extractValidArgentineTenDigits('+54 3865 123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('+54 9 3865 123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('+5493865123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('5493865123456')).toBe('3865123456');
      expect(extractValidArgentineTenDigits('+54 9 11 2345-6789')).toBe('1123456789');
    });

    it('rechaza teléfonos que contienen letras (rechazo semántico estricto)', () => {
      expect(() => extractValidArgentineTenDigits('3865123456abc')).toThrow(/letras/i);
      expect(() => extractValidArgentineTenDigits('abc3865123456')).toThrow(/letras/i);
      expect(() => extractValidArgentineTenDigits('11 2345 abcd')).toThrow(/letras/i);
      expect(() => extractValidArgentineTenDigits('telefono123')).toThrow(/letras/i);
    });

    it('rechaza teléfonos con caracteres y símbolos arbitrarios no telefónicos', () => {
      expect(() => extractValidArgentineTenDigits('3865#123456*')).toThrow();
      expect(() => extractValidArgentineTenDigits('<script>alert(1)</script>')).toThrow();
      expect(() => extractValidArgentineTenDigits('3865!123456$')).toThrow();
      expect(() => extractValidArgentineTenDigits('3865@123456%')).toThrow();
    });

    it('rechaza teléfonos con longitud nacional insuficiente (< 10 dígitos)', () => {
      expect(() => extractValidArgentineTenDigits('1234567')).toThrow(/10 dígitos/i);
      expect(() => extractValidArgentineTenDigits('38651234')).toThrow(/10 dígitos/i);
      expect(() => extractValidArgentineTenDigits('386512345')).toThrow(/10 dígitos/i);
    });

    it('rechaza teléfonos con longitud nacional excesiva (> 10 dígitos tras normalizar)', () => {
      expect(() => extractValidArgentineTenDigits('38651234567')).toThrow(/10 dígitos/i);
      expect(() => extractValidArgentineTenDigits('03865151234567')).toThrow(/10 dígitos/i);
      expect(() => extractValidArgentineTenDigits('11223344556677')).toThrow(/10 dígitos/i);
    });

    it('rechaza cadenas vacías, espacios o tipos inválidos', () => {
      expect(() => extractValidArgentineTenDigits('')).toThrow();
      expect(() => extractValidArgentineTenDigits('   ')).toThrow();
      expect(() => extractValidArgentineTenDigits(null as unknown as string)).toThrow();
      expect(() => extractValidArgentineTenDigits(undefined as unknown as string)).toThrow();
    });
  });

  describe('isValidArgentinePhone', () => {
    it('devuelve true para formatos válidos y false para inválidos', () => {
      expect(isValidArgentinePhone('3865123456')).toBe(true);
      expect(isValidArgentinePhone('+54 9 3865 123456')).toBe(true);
      expect(isValidArgentinePhone('(0381) 15-4123456')).toBe(true);

      expect(isValidArgentinePhone('3865123456abc')).toBe(false);
      expect(isValidArgentinePhone('12345')).toBe(false);
      expect(isValidArgentinePhone('')).toBe(false);
      expect(isValidArgentinePhone('palabra')).toBe(false);
      expect(isValidArgentinePhone('<script>')).toBe(false);
    });
  });
});
