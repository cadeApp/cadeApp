'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  isAnnouncementCtaAllowed,
  type AnnouncementAudience,
  type AnnouncementCta,
} from '@/domain';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Textarea } from '@/ui/textarea';
import { countAnnouncementAudienceAction, createAnnouncementAction } from '../actions';
import { ANNOUNCEMENTS_COPY } from '../copy';
import { announcementFormSchema, type AnnouncementFormInput } from '../schemas';
import { AnnouncementBannerView } from './announcement-banner';

const COPY = ANNOUNCEMENTS_COPY.admin;
const AUDIENCES = ['merchants', 'couriers', 'all'] as const satisfies readonly AnnouncementAudience[];
const CTAS = ['none', 'merchant_plan', 'merchant_new_request', 'courier_feed'] as const satisfies readonly AnnouncementCta[];

const DEFAULT_VALUES: AnnouncementFormInput = {
  audience: 'merchants',
  title: '',
  body: '',
  cta: 'none',
  visibleDays: '7',
};

type AudienceCount = { readonly status: 'loading' } | { readonly status: 'ready'; readonly recipients: number; readonly push: number } | { readonly status: 'error' };

function errorMessage(code: string): string {
  if (code === 'RATE_LIMITED') return COPY.errors.rateLimited;
  if (code === 'VALIDATION_ERROR') return COPY.errors.validation;
  return COPY.errors.generic;
}

/**
 * CC-040 (T-414): alta de novedades. Formulario con vista previa del banner, confirmación en dos pasos con los
 * destinatarios estimados y envío (push en el servidor + banner). El tope diario y la autorización los aplica la RPC.
 */
export function AnnouncementsAdmin() {
  const router = useRouter();
  const [pending, setPending] = React.useState<AnnouncementFormInput | null>(null);
  const [audienceCount, setAudienceCount] = React.useState<AudienceCount>({ status: 'loading' });
  const [sendError, setSendError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const form = useForm<AnnouncementFormInput>({
    resolver: zodResolver(announcementFormSchema),
    defaultValues: DEFAULT_VALUES,
  });
  const { errors } = form.formState;
  const audience = form.watch('audience');
  const cta = form.watch('cta');
  const title = form.watch('title');
  const body = form.watch('body');

  // Un público nuevo puede no admitir el botón elegido: vuelve a «Sin botón».
  React.useEffect(() => {
    if (!isAnnouncementCtaAllowed(audience, cta)) form.setValue('cta', 'none');
  }, [audience, cta, form]);

  const onReview = form.handleSubmit(async (data) => {
    setSendError(null);
    setAudienceCount({ status: 'loading' });
    setPending(data);
    const result = await countAnnouncementAudienceAction(data.audience);
    setAudienceCount(
      result.ok
        ? { status: 'ready', recipients: result.data.recipients, push: result.data.pushRecipients }
        : { status: 'error' }
    );
  });

  async function onConfirm() {
    if (!pending) return;
    setSending(true);
    setSendError(null);
    const result = await createAnnouncementAction({
      audience: pending.audience,
      title: pending.title,
      body: pending.body,
      cta: pending.cta,
      visibleDays: Number(pending.visibleDays),
    });
    setSending(false);
    if (!result.ok) {
      const message = errorMessage(result.code);
      setSendError(message);
      notify.error(message);
      return;
    }
    notify.success(result.data.push ? COPY.sent(result.data.push.sent, result.data.push.failed) : COPY.sentWithoutPush);
    setPending(null);
    form.reset(DEFAULT_VALUES);
    router.refresh();
  }

  const fieldError = (name: keyof AnnouncementFormInput) =>
    errors[name]?.message ? (
      <p role="alert" className="text-sm font-medium text-destructive">
        {errors[name]?.message}
      </p>
    ) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="space-y-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-bold text-foreground">{COPY.formTitle}</h2>
        <form onSubmit={onReview} noValidate className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{COPY.audienceLegend}</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {AUDIENCES.map((option) => (
                <label
                  key={option}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
                >
                  <input type="radio" value={option} className="h-4 w-4" {...form.register('audience')} />
                  <span className="text-sm font-medium text-foreground">{COPY.audience[option]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="announcement-title" className="text-sm font-semibold text-foreground">
                {COPY.titleLabel}
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">{COPY.counter(title.length, 60)}</span>
            </div>
            <Input id="announcement-title" maxLength={60} autoComplete="off" {...form.register('title')} />
            {fieldError('title')}
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="announcement-body" className="text-sm font-semibold text-foreground">
                {COPY.bodyLabel}
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">{COPY.counter(body.length, 140)}</span>
            </div>
            <Textarea id="announcement-body" maxLength={140} rows={3} {...form.register('body')} />
            {fieldError('body')}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">{COPY.ctaLabel}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CTAS.filter((option) => isAnnouncementCtaAllowed(audience, option)).map((option) => (
                <label
                  key={option}
                  className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-border p-3"
                >
                  <input type="radio" value={option} className="h-4 w-4" {...form.register('cta')} />
                  <span className="text-sm font-medium text-foreground">
                    {option === 'none' ? COPY.ctaNone : ANNOUNCEMENTS_COPY.cta[option]}
                  </span>
                </label>
              ))}
            </div>
            {audience === 'all' ? <p className="text-sm text-muted-foreground">{COPY.ctaAllHelp}</p> : null}
            {fieldError('cta')}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor="announcement-days" className="block text-sm font-semibold text-foreground">
              {COPY.daysLabel}
            </label>
            <Input id="announcement-days" inputMode="numeric" className="max-w-32" {...form.register('visibleDays')} />
            <p className="text-sm text-muted-foreground">{COPY.daysHelp}</p>
            {fieldError('visibleDays')}
          </div>

          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{COPY.note}</p>

          <Button type="submit" className="w-full sm:w-auto">
            {COPY.review}
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">{COPY.preview}</h2>
        <AnnouncementBannerView
          title={title.trim() || COPY.previewTitlePlaceholder}
          body={body.trim() || COPY.previewBodyPlaceholder}
          cta={cta}
        />
      </div>

      <Dialog open={pending !== null} onOpenChange={(open) => (open ? undefined : setPending(null))}>
        {pending ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{COPY.confirmTitle}</DialogTitle>
              <DialogDescription>
                {audienceCount.status === 'loading'
                  ? COPY.confirmCounting
                  : audienceCount.status === 'ready'
                    ? COPY.confirmSummary(audienceCount.recipients, audienceCount.push)
                    : COPY.confirmCountError}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <AnnouncementBannerView title={pending.title.trim()} body={pending.body.trim()} cta={pending.cta} />
            </div>
            {sendError ? (
              <p role="alert" className="mt-3 text-sm font-medium text-destructive">
                {sendError}
              </p>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPending(null)} disabled={sending}>
                {COPY.back}
              </Button>
              <Button type="button" onClick={() => void onConfirm()} disabled={sending || audienceCount.status === 'loading'}>
                {sending ? COPY.sending : COPY.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}
