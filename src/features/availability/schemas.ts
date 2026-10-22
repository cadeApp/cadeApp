import { z } from 'zod';

export const setAvailabilitySchema = z.object({
  available: z.boolean({
    required_error: 'El estado de disponibilidad es obligatorio.',
    invalid_type_error: 'El valor de disponibilidad debe ser verdadero o falso.',
  }),
});

export type SetAvailabilityInput = z.infer<typeof setAvailabilitySchema>;
