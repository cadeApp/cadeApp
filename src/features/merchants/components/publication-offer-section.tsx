import * as React from 'react';
import { AlertCircle, BadgePercent, MessageCircle } from 'lucide-react';
import type { ActionResult, DomainErrorCode, PublicationOffer, PublicationOfferPlan } from '@/domain';
import { formatArs } from '@/lib/format';
import { Button, buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { publicationOfferCopy as COPY } from '../copy';
import { buildSupportWhatsAppHref } from '../support-whatsapp';

export interface PublicationOfferSectionProps {
  readonly result: ActionResult<PublicationOffer, DomainErrorCode>;
  /** Número de soporte del servidor (`CADEAPP_SUPPORT_WHATSAPP_NUMBER`), el mismo de «Hablar con cadeApp». */
  readonly supportPhone: string | undefined;
}

/**
 * CC-039 (T-412): planes activos, crédito suelto y descuento de primera compra, leídos con `get_publication_offer`.
 * Cada opción abre el WhatsApp del soporte con lo elegido: el pago es fuera de la app y el admin registra el plan.
 */
export function PublicationOfferSection({ result, supportPhone }: PublicationOfferSectionProps) {
  return (
    <section aria-labelledby="publication-offer-title" className="space-y-3 pt-1">
      <div className="space-y-1">
        <h2 id="publication-offer-title" className="font-display text-lg font-bold tracking-tight text-foreground">
          {COPY.sectionTitle}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{COPY.description}</p>
      </div>
      {result.ok ? <OfferDetails offer={result.data} supportPhone={supportPhone} /> : <OfferError />}
    </section>
  );
}

function OfferError() {
  return (
    <Card role="alert" className="flex items-start gap-3 p-5 sm:p-6">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold text-foreground">{COPY.errorTitle}</h3>
        <p className="text-sm text-muted-foreground">{COPY.errorDescription}</p>
      </div>
    </Card>
  );
}

function OfferDetails({
  offer,
  supportPhone,
}: {
  readonly offer: PublicationOffer;
  readonly supportPhone: string | undefined;
}) {
  const loosePrice = offer.looseCreditReferencePriceArs;
  // PR528-H02: el descuento se avisa siempre que corresponda, haya o no opciones publicadas.
  const discount =
    offer.launchDiscountPct !== null ? (
      <p className="flex items-center gap-2 rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-foreground">
        <BadgePercent className="h-4 w-4 shrink-0 text-primary-dark" aria-hidden="true" />
        {COPY.discount(offer.launchDiscountPct)}
      </p>
    ) : null;

  if (offer.plans.length === 0 && loosePrice === null) {
    return (
      <div className="space-y-3">
        {discount}
        <Card className="p-5 text-sm text-muted-foreground sm:p-6">
          <p>{COPY.empty}</p>
        </Card>
      </div>
    );
  }

  // Los wa.me se arman antes del JSX: cada opción recibe su enlace ya resuelto (o null sin número válido).
  const creditsHref = buildSupportWhatsAppHref(supportPhone, COPY.creditsMessage);
  const planOptions = offer.plans.map((plan) => ({
    plan,
    whatsappHref: buildSupportWhatsAppHref(supportPhone, COPY.planMessage(plan.name)),
  }));
  const whatsappAvailable = creditsHref !== null;

  return (
    <div className="space-y-3">
      {discount}

      <ul aria-label={COPY.listLabel} className="space-y-3">
        {planOptions.map(({ plan, whatsappHref }) => (
          <li key={plan.planId}>
            <OfferOption
              title={plan.name}
              detail={plan.kind === 'quota' && plan.monthlyCredits !== null ? COPY.quota(plan.monthlyCredits) : COPY.unlimited}
              price={planPrice(plan)}
              actionLabel={COPY.choosePlan}
              actionNameSuffix={COPY.choosePlanFor(plan.name)}
              whatsappHref={whatsappHref}
            />
          </li>
        ))}
        {loosePrice !== null ? (
          <li>
            <OfferOption
              title={COPY.looseTitle}
              detail={null}
              price={COPY.loosePrice(formatArs(loosePrice))}
              actionLabel={COPY.buyCredits}
              actionNameSuffix={null}
              whatsappHref={creditsHref}
            />
          </li>
        ) : null}
      </ul>

      {whatsappAvailable ? null : (
        <p role="status" className="text-sm text-muted-foreground">
          {COPY.whatsappUnavailable}
        </p>
      )}
    </div>
  );
}

function planPrice(plan: PublicationOfferPlan): string {
  return plan.referencePriceArs === null ? COPY.priceOnRequest : COPY.pricePerMonth(formatArs(plan.referencePriceArs));
}

function OfferOption({
  title,
  detail,
  price,
  actionLabel,
  actionNameSuffix,
  whatsappHref: href,
}: {
  readonly title: string;
  readonly detail: string | null;
  readonly price: string;
  readonly actionLabel: string;
  readonly actionNameSuffix: string | null;
  readonly whatsappHref: string | null;
}) {
  // El nombre accesible empieza con el texto visible y suma el plan, para distinguir botones iguales.
  const accessibleName = actionNameSuffix ? `${actionLabel}${actionNameSuffix}` : undefined;
  const label = (
    <>
      <MessageCircle className={cn('h-5 w-5', href ? 'text-success' : undefined)} aria-hidden="true" />
      <span>{actionLabel}</span>
    </>
  );

  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="space-y-1">
        <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
        <p className="text-sm font-semibold text-foreground">{price}</p>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={accessibleName}
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full font-semibold sm:w-auto')}
        >
          {label}
        </a>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled
          aria-label={accessibleName}
          className="w-full font-semibold sm:w-auto"
        >
          {label}
        </Button>
      )}
    </Card>
  );
}
