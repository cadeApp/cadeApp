import { describe, expect, it } from 'vitest';
import { submitOfferFormSchema } from './schemas';

describe('T-416: formulario de oferta con Zod 4', () => {
  const requestId = '11111111-1111-1111-1111-111111111111';

  it('acepta un id 8-4-4-4-12 que no es UUID RFC', () => {
    expect(submitOfferFormSchema.safeParse({ requestId, amountArs: 1500, etaMinutes: 15 }).success).toBe(true);
  });

  it('conserva los mensajes propios de obligatorio, tipo inválido y entero', () => {
    const missing = submitOfferFormSchema.safeParse({ requestId, etaMinutes: 15 });
    expect(missing.error?.issues[0]?.message).toBe('Ingresá el monto de tu oferta.');
    const wrongType = submitOfferFormSchema.safeParse({ requestId, amountArs: 'mil', etaMinutes: 15 });
    expect(wrongType.error?.issues[0]?.message).toBe('El monto debe ser un número entero.');
    const decimal = submitOfferFormSchema.safeParse({ requestId, amountArs: 10.5, etaMinutes: 15 });
    expect(decimal.error?.issues[0]?.message).toBe('El monto debe ser un número entero en pesos.');
  });
});
