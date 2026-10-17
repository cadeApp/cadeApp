'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { formatArs } from '@/lib/format';
import { Badge } from '@/ui/badge';
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
import { EmptyState } from '@/ui/empty-state';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { upsertPublicationPlanAction } from '../actions';
import { ADMIN_COPY } from '../copy';
import { publicationPlanFormSchema, type PublicationPlanFormInput } from '../schemas';
import type { PublicationPlanItem } from '../types';

const COPY = ADMIN_COPY.plans;

export interface PublicationPlansManagerProps {
  readonly plans: readonly PublicationPlanItem[];
}

/** CC-029 (D2): catálogo editable por el admin vía `admin_upsert_publication_plan`. */
export function PublicationPlansManager({ plans }: PublicationPlansManagerProps) {
  const [editing, setEditing] = React.useState<PublicationPlanItem | 'new' | null>(null);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/admin/merchants"
          className="inline-flex min-h-12 items-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          {COPY.back}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
            <p className="text-sm text-muted-foreground">{COPY.description}</p>
          </div>
          <Button type="button" onClick={() => setEditing('new')}>
            {COPY.newPlan}
          </Button>
        </div>
      </div>

      {plans.length === 0 ? (
        <EmptyState title={COPY.title} description={COPY.empty} />
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table aria-label={COPY.tableLabel}>
            <TableHeader className="bg-muted/70">
              <TableRow>
                <TableHead>{COPY.columns.name}</TableHead>
                <TableHead>{COPY.columns.code}</TableHead>
                <TableHead>{COPY.columns.kind}</TableHead>
                <TableHead className="text-right">{COPY.columns.credits}</TableHead>
                <TableHead className="text-right">{COPY.columns.price}</TableHead>
                <TableHead>{COPY.columns.active}</TableHead>
                <TableHead className="text-right">{COPY.columns.sort}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{COPY.columns.actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell className="text-sm font-medium">{plan.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{plan.code}</TableCell>
                  <TableCell className="text-sm">{COPY.kind[plan.kind]}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{plan.monthlyCredits ?? '—'}</TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {plan.referencePriceArs === null ? '—' : formatArs(plan.referencePriceArs)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.active ? 'verified' : 'outline'}>
                      {plan.active ? COPY.activeLabel.true : COPY.activeLabel.false}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{plan.sort}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(plan)}>
                      {COPY.edit}
                      <span className="sr-only"> {COPY.editFor(plan.name)}</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => (open ? undefined : setEditing(null))}>
        {editing !== null ? (
          <DialogContent>
            <PlanForm plan={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  );
}

function PlanForm({ plan, onDone }: { readonly plan: PublicationPlanItem | null; readonly onDone: () => void }) {
  const router = useRouter();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<PublicationPlanFormInput>({
    resolver: zodResolver(publicationPlanFormSchema),
    defaultValues: {
      code: plan?.code ?? '',
      name: plan?.name ?? '',
      kind: plan?.kind ?? 'quota',
      monthlyCredits: plan?.monthlyCredits === null || plan === null ? '' : String(plan.monthlyCredits),
      referencePriceArs: plan?.referencePriceArs === null || plan === null ? '' : String(plan.referencePriceArs),
      active: plan?.active ?? true,
      sort: String(plan?.sort ?? 0),
    },
  });
  const kind = form.watch('kind');
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (data) => {
    setServerError(null);
    try {
      const res = await upsertPublicationPlanAction({
        planId: plan?.id ?? null,
        code: data.code,
        name: data.name,
        kind: data.kind,
        monthlyCredits: data.kind === 'quota' ? Number(data.monthlyCredits) : null,
        referencePriceArs: data.referencePriceArs === '' ? null : Number(data.referencePriceArs),
        active: data.active,
        sort: Number(data.sort),
      });
      if (!res.ok) {
        const message = getDomainErrorMessage(res.code);
        setServerError(message);
        notify.error(message);
        return;
      }
      notify.success(COPY.success);
      onDone();
      router.refresh();
    } catch {
      setServerError(COPY.connectionError);
      notify.error(COPY.connectionError);
    }
  });

  const idPrefix = `plan-${plan?.id ?? 'new'}`;
  const field = (name: keyof PublicationPlanFormInput, label: string, extra?: React.ReactNode) => (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-${name}`} className="block text-sm font-semibold text-foreground">
        {label}
      </label>
      {extra}
      {errors[name]?.message ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errors[name]?.message}
        </p>
      ) : null}
    </div>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{plan ? COPY.dialog.editTitle(plan.name) : COPY.dialog.createTitle}</DialogTitle>
        <DialogDescription>{COPY.dialog.description}</DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
        {field('name', COPY.dialog.name, <Input id={`${idPrefix}-name`} {...form.register('name')} />)}
        {field('code', COPY.dialog.code, <Input id={`${idPrefix}-code`} autoComplete="off" {...form.register('code')} />)}
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-foreground">{COPY.dialog.kind}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(['quota', 'unlimited'] as const).map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3">
                <input type="radio" value={option} className="h-4 w-4" {...form.register('kind')} />
                <span className="text-sm font-medium text-foreground">{COPY.kind[option]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {kind === 'quota'
          ? field(
              'monthlyCredits',
              COPY.dialog.monthlyCredits,
              <Input id={`${idPrefix}-monthlyCredits`} inputMode="numeric" {...form.register('monthlyCredits')} />
            )
          : null}
        {field(
          'referencePriceArs',
          COPY.dialog.referencePrice,
          <Input id={`${idPrefix}-referencePriceArs`} inputMode="numeric" {...form.register('referencePriceArs')} />
        )}
        {field('sort', COPY.dialog.sort, <Input id={`${idPrefix}-sort`} inputMode="numeric" {...form.register('sort')} />)}
        <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-foreground">
          <input type="checkbox" className="h-4 w-4" {...form.register('active')} />
          {COPY.dialog.active}
        </label>
        {serverError ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {serverError}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onDone} disabled={isSubmitting}>
            {COPY.dialog.cancel}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? COPY.dialog.saving : COPY.dialog.save}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
