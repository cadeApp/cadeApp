import { z } from 'zod';

export const exampleItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'El nombre es obligatorio'),
  createdAt: z.string().datetime(),
});

export type ExampleItem = z.infer<typeof exampleItemSchema>;

export const createExampleSchema = exampleItemSchema.pick({
  name: true,
});

export type CreateExampleInput = z.infer<typeof createExampleSchema>;
