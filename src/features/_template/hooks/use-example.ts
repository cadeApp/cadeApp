'use client';

import { useQuery } from '@tanstack/react-query';
import { exampleKeys } from '../query-keys';
import type { ExampleItem } from '../schemas';

export function useExampleItems(initialData?: ExampleItem[]) {
  return useQuery({
    queryKey: exampleKeys.lists(),
    queryFn: async () => {
      // Llamada a endpoint o Server Action en features reales
      return initialData ?? [];
    },
    initialData,
  });
}
