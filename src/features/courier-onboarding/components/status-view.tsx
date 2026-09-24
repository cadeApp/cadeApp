'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, ShieldAlert, ArrowRight } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { COURIER_ONBOARDING_COPY } from '../copy';

export interface StatusViewProps {
  onGoToFeed?: () => void;
}

export function StatusView({ onGoToFeed }: StatusViewProps) {
  const router = useRouter();

  const handleNavigate = () => {
    if (onGoToFeed) {
      onGoToFeed();
    } else {
      router.push('/courier/feed');
    }
  };

  const checklistItems = [
    { title: 'DNI frente y dorso', status: 'uploaded' },
    { title: 'Selfie de seguridad', status: 'uploaded' },
    { title: 'Foto de perfil para comercios', status: 'uploaded' },
    { title: 'Vehículo y consentimientos', status: 'uploaded' },
    { title: 'Licencia y seguro (opcional)', status: 'optional' },
  ];

  return (
    <Card className="mx-auto w-full max-w-lg space-y-6 p-6 sm:p-8">
      <div className="flex w-full flex-col items-center">
        {/* Status Tracker Pill */}
        <Badge
          variant="outline"
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-600"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-600" />
          <span>{COURIER_ONBOARDING_COPY.underReviewBadge}</span>
        </Badge>

        {/* Brand Delivery and Clock Motif */}
        <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-border bg-muted/40 text-primary-dark">
          <Clock className="h-7 w-7" aria-hidden="true" />
        </div>

        {/* Text Block */}
        <div className="mb-6 w-full px-2 text-center">
          <h1 className="mb-2 font-display text-2xl font-bold leading-tight text-foreground">
            {COURIER_ONBOARDING_COPY.underReviewTitle}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {COURIER_ONBOARDING_COPY.underReviewSubtitle}
          </p>
        </div>

        {/* Verification Bento / Checklist Card */}
        <Card className="w-full border-border bg-muted/20 shadow-none">
          <CardHeader className="border-b border-border/50 pb-3">
            <CardTitle className="text-sm font-bold text-foreground">
              {COURIER_ONBOARDING_COPY.checklistTitle}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {COURIER_ONBOARDING_COPY.checklistSubtitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-3">
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  {item.status === 'uploaded' ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium text-foreground">{item.title}</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {item.status === 'uploaded' ? 'Listo' : 'Pendiente'}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Botón hacia el feed */}
      <Button
        type="button"
        size="lg"
        onClick={handleNavigate}
        className="w-full font-bold"
      >
        <span>{COURIER_ONBOARDING_COPY.btnGoToFeed}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
