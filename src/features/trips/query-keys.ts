export const tripKeys = {
  all: ['trips'] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (tripId: string) => [...tripKeys.details(), tripId] as const,
  activeTrip: (userId?: string) => [...tripKeys.all, 'active', userId] as const,
};

export const tripsKeys = tripKeys;
