import { describe, expect, it } from 'vitest';
import { cancelMerchantRequestSchema } from './schemas';

describe('T-416: cancelación con Zod 4', () => {
  it('acepta un id 8-4-4-4-12 que no es UUID RFC y conserva el mensaje del id inválido', () => {
    const reason = 'Se canceló';
    const requestId = '11111111-1111-1111-1111-111111111111';
    expect(cancelMerchantRequestSchema.safeParse({ requestId, reason }).success).toBe(true);
    expect(cancelMerchantRequestSchema.safeParse({ requestId: 'x', reason }).error?.issues[0]?.message).toBe(
      'Identificador de solicitud inválido',
    );
  });
});
