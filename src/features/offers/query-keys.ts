export const offerKeys = {
  all: ['offers'] as const,
  availableRequests: (filters?: Record<string, unknown>) =>
    [...offerKeys.all, 'available-requests', filters] as const,
  myOffers: (courierId?: string) => [...offerKeys.all, 'my-offers', courierId] as const,
  forRequest: (requestId: string) => [...offerKeys.all, 'for-request', requestId] as const,
};

export const offersKeys = offerKeys;
