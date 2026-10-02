'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Clock, CheckCircle2, ShieldAlert, ArrowRight, FileText } from 'lucide-react';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { COURIER_ONBOARDING_COPY } from '../copy';
import type { CourierDocumentMetadata } from '../queries';

export interface StatusViewProps {
  readonly documents: readonly CourierDocumentMetadata[];
  readonly onGoToFeed?: () => void;
}

type ItemStatus = 'uploaded' | 'rejected' | 'pending' | 'optional_missing';

function getItemPresentation(status: ItemStatus) {
  switch (status) {
    case 'uploaded':
      return {
        label: 'Listo',
        icon: <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />,
        textClass: 'text-muted-foreground',
      };
    case 'rejected':
      return {
        label: 'Observado',
        icon: <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />,
        textClass: 'text-destructive font-medium',
      };
    case 'pending':
      return {
        label: 'Pendiente',
        icon: <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
        textClass: 'text-muted-foreground',
      };
    case 'optional_missing':
      return {
        label: 'No cargado (opcional)',
        icon: <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />,
        textClass: 'text-muted-foreground',
      };
  }
}

export function StatusView({ documents, onGoToFeed }: StatusViewProps) {
  const router = useRouter();

  const handleNavigate = () => {
    if (onGoToFeed) {
      onGoToFeed();
    } else {
      router.push('/courier/feed');
    }
  };

  const dniFront = documents.find((d) => d.kind === 'dni_front');
  const dniBack = documents.find((d) => d.kind === 'dni_back');

  let dniStatus: ItemStatus = 'pending';
  if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
    dniStatus = 'rejected';
  } else if (
    dniFront &&
    dniBack &&
    (dniFront.status === 'submitted' || dniFront.status === 'verified') &&
    (dniBack.status === 'submitted' || dniBack.status === 'verified')
  ) {
    dniStatus = 'uploaded';
  }

  const selfie = documents.find((d) => d.kind === 'selfie');
  let selfieStatus: ItemStatus = 'pending';
  if (selfie) {
    if (selfie.status === 'rejected') {
      selfieStatus = 'rejected';
    } else if (selfie.status === 'submitted' || selfie.status === 'verified') {
      selfieStatus = 'uploaded';
    }
  }

  const avatar = documents.find((d) => d.kind === 'avatar');
  let avatarStatus: ItemStatus = 'pending';
  if (avatar) {
    if (avatar.status === 'rejected') {
      avatarStatus = 'rejected';
    } else if (avatar.status === 'submitted' || avatar.status === 'verified') {
      avatarStatus = 'uploaded';
    }
  }

  const license = documents.find((d) => d.kind === 'license');
  let licenseStatus: ItemStatus = 'optional_missing';
  if (license) {
    if (license.status === 'rejected') {
      licenseStatus = 'rejected';
    } else if (license.status === 'submitted' || license.status === 'verified') {
      licenseStatus = 'uploaded';
    }
  }

  const insurance = documents.find((d) => d.kind === 'insurance');
  let insuranceStatus: ItemStatus = 'optional_missing';
  if (insurance) {
    if (insurance.status === 'rejected') {
      insuranceStatus = 'rejected';
    } else if (insurance.status === 'submitted' || insurance.status === 'verified') {
      insuranceStatus = 'uploaded';
    }
  }

  const checklistItems: Array<{ title: string; status: ItemStatus }> = [
    { title: 'DNI frente y dorso', status: dniStatus },
    { title: 'Selfie de seguridad', status: selfieStatus },
    { title: 'Foto de perfil para comercios', status: avatarStatus },
    { title: 'Vehículo y consentimientos', status: 'uploaded' },
    { title: 'Licencia de conducir (opcional)', status: licenseStatus },
    { title: 'Seguro (opcional)', status: insuranceStatus },
  ];

  return (
    <Card className="mx-auto w-full max-w-lg space-y-6 p-6 sm:p-8">
      <div className="flex w-full flex-col items-center">
        {/* Status Tracker Pill */}
        <Badge
          variant="outline"
          className="mb-6 inline-flex items-center gap-1.5 rounded-full border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-600"
        >
          <span className="h-2 w-2 rounded-full bg-amber-600" />
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
            {checklistItems.map((item, idx) => {
              const presentation = getItemPresentation(item.status);
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 last:pb-0"
                >
                  <div className="flex items-center gap-2.5">
                    {presentation.icon}
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                  </div>
                  <span className={`text-sm ${presentation.textClass}`}>
                    {presentation.label}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Botón hacia el feed */}
      <Button type="button" size="lg" onClick={handleNavigate} className="w-full font-bold">
        <span>{COURIER_ONBOARDING_COPY.btnGoToFeed}</span>
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </Card>
  );
}
