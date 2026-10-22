export const requestKeys = {
  all: ['requests'] as const,
  lists: () => [...requestKeys.all, 'list'] as const,
  list: (merchantId?: string) => [...requestKeys.lists(), { merchantId }] as const,
  details: () => [...requestKeys.all, 'detail'] as const,
  detail: (requestId: string) => [...requestKeys.details(), requestId] as const,
  offers: (requestId: string) => [...requestKeys.detail(requestId), 'offers'] as const,
};

export const requestsKeys = requestKeys;
