import { z } from 'zod';
import { requiredError } from '@/lib/zod-messages';

export const setAvailabilitySchema = z.object({
  available: z.boolean(
    requiredError('El estado de disponibilidad es obligatorio.', 'El valor de disponibilidad debe ser verdadero o falso.'),
  ),
});

export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
