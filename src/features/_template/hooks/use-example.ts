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
    queryFn: async (): Promise<ExampleItem[]> => {
      // En features reales: fetch a un route handler o llamada a Server Action.
      // NO devolver initialData desde acá: la query nunca se actualizaría en un refetch.
      throw new Error('Implementar la lectura real en la feature que copie este template');
    },
    initialData,
  });
}
