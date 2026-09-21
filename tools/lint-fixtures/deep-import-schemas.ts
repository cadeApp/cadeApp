// Fixture: Import profundo a schemas.ts de una feature en vez de index.ts (Hallazgo 8)
// Debe fallar con boundaries/entry-point
import { exampleItemSchema } from '@/features/_template/schemas';

export const testSchema = exampleItemSchema;
