import * as React from 'react';
import type { IncidentStatus } from '@/domain';
import { Badge, type BadgeProps } from '@/ui/badge';
import { INCIDENTS_COPY } from '../copy';

const STATUS_VARIANT: Record<IncidentStatus, BadgeProps['variant']> = {
  open: 'in_transit',
  reviewing: 'secondary',
  resolved: 'delivered',
  dismissed: 'expired',
};

export function IncidentStatusBadge({ status }: { readonly status: IncidentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{INCIDENTS_COPY.statuses[status]}</Badge>;
}
