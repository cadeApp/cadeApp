'use server';

import { createExampleSchema } from './schemas';

export type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createExampleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createExampleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Datos inválidos',
    };
  }

  // En features reales: llamada a RPC de src/server y revalidatePath/revalidateTag
  return {
    success: true,
    data: { id: '00000000-0000-0000-0000-000000000002' },
  };
}
