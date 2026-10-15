import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import { formatArs } from '@/lib/format';
import { MapPin, ArrowRight } from 'lucide-react';
import { OFFERS_COPY } from '../copy';
import type { ActiveTripSummary } from '../schemas';

export interface ActiveTripCardProps {
  trip: ActiveTripSummary;
}

export function ActiveTripCard({ trip }: ActiveTripCardProps) {
  const isMultiDrop = trip.dropsCount > 1;
  const statusLabel = OFFERS_COPY.activeTripStatus[trip.status];
  const badgeVariant = trip.status === 'in_transit' ? 'in_transit' : 'matched';

  return (
    <Card className="border border-border p-4 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-0">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={badgeVariant} className="text-sm">
            {statusLabel}
          </Badge>
          <div className="flex items-baseline gap-1.5 font-display text-base font-bold text-foreground">
            <span>{formatArs(trip.amountArs)}</span>
            {isMultiDrop && (
              <span className="text-sm font-normal text-muted-foreground">
                {OFFERS_COPY.perDropSuffix}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-foreground">
          <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-semibold">{trip.pickupZoneName}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          {isMultiDrop ? (
            <span className="font-medium text-muted-foreground">
              {OFFERS_COPY.multiDropSummary(trip.dropsCount)}
            </span>
          ) : (
            <span className="font-semibold">{trip.dropoffZoneName ?? 'Aguilares'}</span>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Link
            href={`/trips/${trip.id}`}
            className={cn(buttonVariants({ variant: 'default', size: 'sm' }), 'w-full sm:w-auto')}
          >
            {OFFERS_COPY.viewTripButton}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
