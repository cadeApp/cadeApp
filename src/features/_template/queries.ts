import 'server-only';
import type { ExampleItem } from './schemas';

export async function getExampleItems(): Promise<ExampleItem[]> {
  // En features reales: consulta al cliente Supabase server respetando RLS
  return [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Item de ejemplo 1',
      createdAt: new Date().toISOString(),
    },
  ];
}
