'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Input } from '@/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import { formatDate, formatRelativeTime } from '@/lib/format';
import { ADMIN_COPY } from '../copy';
import type { AdminApplicantTab, ApplicantQueueItem } from '../types';

export interface ApplicantsQueueProps {
  readonly initialTab: AdminApplicantTab;
  readonly applicants: readonly ApplicantQueueItem[];
  /** Cantidad exacta de la pestaña con la búsqueda aplicada (CC-044); sin dato no se muestra el contador. */
  readonly total?: number;
  /** Término «Buscar por nombre» vigente (`?q=`). */
  readonly query?: string;
  readonly pageSize?: number;
  readonly nextCursor?: string | null;
  readonly prevCursor?: string | null;
  /**
   * Reloj del servidor para «Enviado»: el servidor y el cliente muestran el mismo texto. Sin reloj se muestra la fecha
   * completa en lugar del tiempo relativo.
   */
  readonly now?: string;
}

const TAB_IDS: readonly AdminApplicantTab[] = ['pending', 'approved', 'rejected', 'suspended'];

const HEAD_CLASS = 'px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground';

/** Licencia y seguro verificados sobre 2; los enviados sin verificar van aparte. */
function optionalSummary(applicant: ApplicantQueueItem): string {
  const statuses = [applicant.licenseStatus, applicant.insuranceStatus];
  const verified = statuses.filter((status) => status === 'verified').length;
  const inReview = statuses.filter((status) => status === 'submitted').length;
  return ADMIN_COPY.queue.optional(verified, inReview);
}

export function ApplicantsQueue({
  initialTab,
  applicants,
  total,
  query,
  nextCursor = null,
  prevCursor = null,
  now,
}: ApplicantsQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = initialTab;
  const [searchTerm, setSearchTerm] = React.useState(query ?? '');

  function navigate(update: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams);
    update(params);
    router.push(`/admin/applicants?${params.toString()}`);
  }

  function resetPage(params: URLSearchParams) {
    params.delete('cursor');
    params.delete('dir');
    params.delete('page');
  }

  function handleTabChange(tab: AdminApplicantTab) {
    navigate((params) => {
      params.set('tab', tab);
      resetPage(params);
    });
  }

  function handleSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim();
    navigate((params) => {
      if (term) params.set('q', term);
      else params.delete('q');
      resetPage(params);
    });
  }

  function handleClearSearch() {
    setSearchTerm('');
    navigate((params) => {
      params.delete('q');
      resetPage(params);
    });
  }

  function handlePage(cursor: string, direction: 'next' | 'prev') {
    navigate((params) => {
      params.set('cursor', cursor);
      if (direction === 'prev') params.set('dir', 'prev');
      else params.delete('dir');
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{ADMIN_COPY.queue.title}</h1>
            {total !== undefined ? (
              <Badge variant="secondary" data-testid="applicants-count">
                {ADMIN_COPY.queue.count(total, currentTab)}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{ADMIN_COPY.queue.description}</p>
        </div>
        {/* CC-050 (D4-B): la búsqueda de disputas va aparte; la cola no lista cuentas sin enviar. */}
        <Link href="/admin/applicants/disputes" className="text-sm font-medium text-primary underline">
          {ADMIN_COPY.disputes.queueLink}
        </Link>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(val) => handleTabChange(val as AdminApplicantTab)}
        className="w-full space-y-4"
      >
        <div className="flex flex-col gap-3 border-b border-border lg:flex-row lg:items-end lg:justify-between">
          <TabsList className="h-auto gap-2 bg-transparent p-0">
            {TAB_IDS.map((tabId) => (
              <TabsTrigger
                key={tabId}
                value={tabId}
                className="relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                {ADMIN_COPY.queue.tabs[tabId]}
              </TabsTrigger>
            ))}
          </TabsList>

          <form role="search" onSubmit={handleSearch} className="flex w-full gap-2 pb-3 lg:w-auto">
            <label htmlFor="applicants-search" className="sr-only">
              {ADMIN_COPY.queue.searchLabel}
            </label>
            <Input
              id="applicants-search"
              type="search"
              name="q"
              maxLength={80}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={ADMIN_COPY.queue.searchPlaceholder}
              className="lg:w-72"
            />
            <Button type="submit" variant="outline" className="h-12">
              {ADMIN_COPY.queue.searchButton}
            </Button>
          </form>
        </div>

        <TabsContent value={currentTab} className="mt-0 space-y-4">
          {applicants.length === 0 ? (
            query ? (
              <EmptyState
                title={ADMIN_COPY.queue.emptySearchTitle(query)}
                description={ADMIN_COPY.queue.emptySearchDescription}
                actionLabel={ADMIN_COPY.queue.clearSearch}
                onAction={handleClearSearch}
              />
            ) : (
              <EmptyState
                title={ADMIN_COPY.queue.emptyTitle(ADMIN_COPY.queue.tabs[currentTab])}
                description={ADMIN_COPY.queue.emptyDescription}
              />
            )
          ) : (
            <Card className="overflow-hidden border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/70">
                  <TableRow>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.columns.applicant}</TableHead>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.columns.vehicle}</TableHead>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.columns.documents}</TableHead>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.optionalColumn}</TableHead>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.submittedColumn}</TableHead>
                    <TableHead className={HEAD_CLASS}>{ADMIN_COPY.queue.columns.date}</TableHead>
                    <TableHead className={`${HEAD_CLASS} text-right`}>{ADMIN_COPY.queue.columns.action}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card">
                  {applicants.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/50">
                      <TableCell className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">{a.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          {a.hasDni ? ADMIN_COPY.queue.dniLoaded : ADMIN_COPY.queue.dniPending}
                        </div>
                        {a.phone ? <div className="text-sm text-muted-foreground">{a.phone}</div> : null}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="text-sm font-medium">
                          {a.vehicleType ? ADMIN_COPY.vehicleType[a.vehicleType] : ADMIN_COPY.queue.vehicleUnknown}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack ? 'secondary' : 'outline'
                            }
                          >
                            {ADMIN_COPY.queue.dniBadge}{' '}
                            {a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack ? '✓' : '—'}
                          </Badge>
                          <Badge variant={a.documentsSummary.hasSelfie ? 'secondary' : 'outline'}>
                            {ADMIN_COPY.queue.selfieBadge} {a.documentsSummary.hasSelfie ? '✓' : '—'}
                          </Badge>
                          {a.documentsSummary.hasLicense ? (
                            <Badge variant={a.licenseStatus === 'verified' ? 'default' : 'secondary'}>
                              {ADMIN_COPY.queue.licenseBadge}{' '}
                              {a.licenseStatus === 'verified' ? '✓' : ADMIN_COPY.queue.uploadedFeminine}
                            </Badge>
                          ) : null}
                          {a.status === 'approved' &&
                          (a.licenseStatus === 'submitted' || a.insuranceStatus === 'submitted') ? (
                            <Badge variant="declared">{ADMIN_COPY.queue.optionalDocumentInReview}</Badge>
                          ) : null}
                          {a.documentsSummary.hasInsurance ? (
                            <Badge variant={a.insuranceStatus === 'verified' ? 'default' : 'secondary'}>
                              {ADMIN_COPY.queue.insuranceBadge}{' '}
                              {a.insuranceStatus === 'verified' ? '✓' : ADMIN_COPY.queue.uploadedMasculine}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-sm font-semibold text-foreground">
                          {optionalSummary(a)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {a.submittedAt ? (
                          <time dateTime={a.submittedAt} title={formatDate(a.submittedAt)}>
                            {now ? formatRelativeTime(a.submittedAt, now) : formatDate(a.submittedAt)}
                          </time>
                        ) : (
                          ADMIN_COPY.queue.submittedUnknown
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(a.createdAt)}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <Link href={`/admin/applicants/${a.id}`}>
                          <Button size="sm" variant="default" className="text-sm font-semibold">
                            {ADMIN_COPY.queue.reviewButton}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {prevCursor || nextCursor ? (
            <nav aria-label={ADMIN_COPY.queue.paginationLabel} className="flex items-center justify-end gap-2 px-2 pt-2">
              {prevCursor ? (
                <Button variant="outline" size="sm" onClick={() => handlePage(prevCursor, 'prev')}>
                  {ADMIN_COPY.queue.prevButton}
                </Button>
              ) : null}
              {nextCursor ? (
                <Button variant="outline" size="sm" onClick={() => handlePage(nextCursor, 'next')}>
                  {ADMIN_COPY.queue.nextButton}
                </Button>
              ) : null}
            </nav>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
