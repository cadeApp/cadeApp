import type { VehicleType, RecipientPaymentMethod } from '@/domain';

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  walk: 'A pie',
  bike: 'Bicicleta',
  moto: 'Moto',
  car: 'Auto',
} as const;

export function formatVehicleType(type: string | null | undefined): string {
  if (!type) return 'Repartidor';
  if (type in VEHICLE_TYPE_LABELS) {
    return VEHICLE_TYPE_LABELS[type as VehicleType];
  }
  return 'Repartidor';
}

export const RECIPIENT_PAYMENT_METHOD_LABELS: Record<RecipientPaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  to_agree: 'A coordinar',
} as const;

export function formatRecipientPaymentMethod(method: RecipientPaymentMethod | string | null | undefined): string {
  if (!method) return 'A coordinar';
  if (method in RECIPIENT_PAYMENT_METHOD_LABELS) {
    return RECIPIENT_PAYMENT_METHOD_LABELS[method as RecipientPaymentMethod];
  }
  return 'A coordinar';
}
