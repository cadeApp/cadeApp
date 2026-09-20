'use client';

import { useQuery } from '@tanstack/react-query';
import { exampleKeys } from '../query-keys';
import type { ExampleItem } from '../schemas';

export interface UseExampleItemsOptions {
  filters?: Record<string, unknown>;
  initialData?: ExampleItem[];
}

export function useExampleItems({ filters = {}, initialData }: UseExampleItemsOptions = {}) {
  return useQuery({
    // La clave incluye los filtros para evitar colisiones de caché entre pantallas
    queryKey: exampleKeys.list(filters),
    queryFn: async () => {
      // En features reales: fetch a un route handler o llamada a Server Action
      return initialData ?? [];
    },
    initialData,
  });
}
