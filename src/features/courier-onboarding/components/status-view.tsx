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
    <div className="w-full max-w-[390px] mx-auto min-h-screen flex flex-col items-center justify-between bg-background p-4 pb-12">
      <div className="w-full flex flex-col items-center pt-6">
        {/* Status Tracker Pill */}
        <Badge
          variant="outline"
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border-amber-500/30 text-amber-600 text-sm font-semibold mb-6"
        >
          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
          <span>{COURIER_ONBOARDING_COPY.underReviewBadge}</span>
        </Badge>

        {/* Brand Delivery and Clock Motif */}
        <div className="relative w-28 h-28 flex items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6 text-primary">
          <Clock className="w-14 h-14 animate-pulse" aria-hidden="true" />
        </div>

        {/* Text Block */}
        <div className="text-center w-full px-2 mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2 leading-tight">
            {COURIER_ONBOARDING_COPY.underReviewTitle}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {COURIER_ONBOARDING_COPY.underReviewSubtitle}
          </p>
        </div>

        {/* Verification Bento / Checklist Card */}
        <Card className="w-full mb-6 shadow-sm bg-card border-border">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-sm font-bold text-foreground">
              {COURIER_ONBOARDING_COPY.checklistTitle}
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground">
              {COURIER_ONBOARDING_COPY.checklistSubtitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2.5">
            {checklistItems.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0"
              >
                <div className="flex items-center gap-2.5">
                  {item.status === 'uploaded' ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
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
      <div className="w-full space-y-2">
        <Button
          type="button"
          onClick={handleNavigate}
          className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2"
        >
          <span>{COURIER_ONBOARDING_COPY.btnGoToFeed}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
