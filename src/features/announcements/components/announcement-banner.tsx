'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Megaphone, X } from 'lucide-react';
import type { AnnouncementBanner as AnnouncementBannerData, AnnouncementCta } from '@/domain';
import { Badge } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
import { cn } from '@/ui/cn';
import { notify } from '@/ui/notify';
import { dismissAnnouncementAction, setPromotionsOptInAction } from '../actions';
import { ANNOUNCEMENTS_COPY } from '../copy';
import { ANNOUNCEMENT_CTA_HREFS } from '../schemas';

const COPY = ANNOUNCEMENTS_COPY.banner;

export interface AnnouncementBannerViewProps {
  readonly title: string;
  readonly body: string;
  readonly cta: AnnouncementCta;
  /** Sin handlers (vista previa del admin), cerrar, el botón y la baja quedan deshabilitados. */
  readonly onDismiss?: () => void;
  readonly onOptOut?: () => void;
  readonly linkEnabled?: boolean;
}

/** T-414: banner de novedad (diseño Stitch C02b del comercio), en las home del comercio y del repartidor. */
export function AnnouncementBannerView({
  title,
  body,
  cta,
  onDismiss,
  onOptOut,
  linkEnabled = false,
}: AnnouncementBannerViewProps) {
  const ctaLabel = cta === 'none' ? null : ANNOUNCEMENTS_COPY.cta[cta];
  const ctaHref = cta === 'none' ? null : ANNOUNCEMENT_CTA_HREFS[cta];
  const ctaContent = (
    <>
      <span>{ctaLabel}</span>
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </>
  );

  return (
    <section
      aria-label={COPY.regionLabel}
      className="relative rounded-xl border border-primary/30 bg-primary/10 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3 pr-10">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-card text-primary-dark">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 space-y-1">
          <Badge className="px-2 py-0.5 text-xs font-bold uppercase tracking-wide">{COPY.tag}</Badge>
          <h2 className="font-display text-base font-bold leading-snug text-foreground">
            {title}
          </h2>
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={COPY.close}
        onClick={onDismiss}
        disabled={!onDismiss}
        className="absolute right-1 top-1 text-muted-foreground"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </Button>

      {ctaLabel && ctaHref ? (
        linkEnabled ? (
          <Link
            href={ctaHref}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 w-full gap-2 font-semibold text-primary-dark')}
          >
            {ctaContent}
          </Link>
        ) : (
          <Button type="button" variant="outline" disabled className="mt-3 w-full gap-2 font-semibold">
            {ctaContent}
          </Button>
        )
      ) : null}

      <div className="mt-1 flex justify-center">
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onOptOut}
          disabled={!onOptOut}
          className="text-xs font-medium text-muted-foreground underline"
        >
          {COPY.optOut}
        </Button>
      </div>
    </section>
  );
}

export interface AnnouncementBannerProps {
  readonly announcement: AnnouncementBannerData;
}

/**
 * T-414: banner con sus acciones. Cerrar y darse de baja lo ocultan al instante y lo guardan en la cuenta; si no se
 * pudo guardar, vuelve a aparecer y se avisa.
 */
export function AnnouncementBanner({ announcement }: AnnouncementBannerProps) {
  const [hidden, setHidden] = React.useState(false);

  async function runHidden(action: () => Promise<{ ok: boolean }>, successMessage?: string) {
    setHidden(true);
    try {
      const result = await action();
      if (!result.ok) throw new Error('announcement action failed');
      if (successMessage) notify.success(successMessage);
    } catch {
      setHidden(false);
      notify.error(COPY.error);
    }
  }

  if (hidden) return null;

  return (
    <AnnouncementBannerView
      title={announcement.title}
      body={announcement.body}
      cta={announcement.cta}
      linkEnabled
      onDismiss={() => void runHidden(() => dismissAnnouncementAction(announcement.id))}
      onOptOut={() => void runHidden(() => setPromotionsOptInAction(false), COPY.optOutDone)}
    />
  );
}
