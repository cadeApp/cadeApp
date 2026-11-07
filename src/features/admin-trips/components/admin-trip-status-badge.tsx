import * as React from 'react';
import type { DeliveryRequestStatus } from '@/domain';
import { Badge, type BadgeProps } from '@/ui/badge';
import { ADMIN_TRIPS_COPY } from '../copy';

const VARIANT: Record<DeliveryRequestStatus, NonNullable<BadgeProps['variant']>> = {
  draft: 'outline',
  published: 'published',
  matched: 'matched',
  in_transit: 'in_transit',
  delivered: 'delivered',
  cancelled: 'cancelled',
  expired: 'expired',
};

/** Estado de la solicitud en «Viajes», con texto propio (nunca solo color). */
export function AdminTripStatusBadge({ status }: { status: DeliveryRequestStatus }) {
  return (
    <Badge variant={VARIANT[status]} className="text-sm">
      {ADMIN_TRIPS_COPY.status[status]}
    </Badge>
  );
}
