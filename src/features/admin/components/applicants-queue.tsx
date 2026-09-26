'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
import { formatDate } from '@/lib/format';
import { ADMIN_COPY } from '../copy';
import type { AdminApplicantTab, ApplicantListItem } from '../types';

export interface ApplicantsQueueProps {
  readonly initialTab: AdminApplicantTab;
  readonly applicants: readonly ApplicantListItem[];
  readonly pageSize?: number;
  readonly nextCursor?: string | null;
  readonly hasNextPage?: boolean;
}

const TAB_IDS: readonly AdminApplicantTab[] = ['pending', 'approved', 'rejected', 'suspended'];

export function ApplicantsQueue({
  initialTab,
  applicants,
  nextCursor = null,
  hasNextPage = false,
}: ApplicantsQueueProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = initialTab;

  function handleTabChange(tab: AdminApplicantTab) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', tab);
    params.delete('cursor');
    params.delete('page');
    router.push(`/admin/applicants?${params.toString()}`);
  }

  function handleNextPage() {
    if (!nextCursor) return;
    const params = new URLSearchParams(searchParams);
    params.set('cursor', nextCursor);
    router.push(`/admin/applicants?${params.toString()}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {ADMIN_COPY.queue.title}
          </h1>
          <p className="text-sm text-muted-foreground">{ADMIN_COPY.queue.description}</p>
        </div>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(val) => handleTabChange(val as AdminApplicantTab)}
        className="w-full space-y-4"
      >
        <div className="border-b border-border">
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
        </div>

        <TabsContent value={currentTab} className="mt-0 space-y-4">
          {applicants.length === 0 ? (
            <EmptyState
              title={ADMIN_COPY.queue.emptyTitle(ADMIN_COPY.queue.tabs[currentTab])}
              description={ADMIN_COPY.queue.emptyDescription}
            />
          ) : (
            <Card className="overflow-hidden border border-border shadow-sm">
              <Table>
                <TableHeader className="bg-muted/70">
                  <TableRow>
                    <TableHead className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.applicant}
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.vehicle}
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.documents}
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.level}
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.date}
                    </TableHead>
                    <TableHead className="px-6 py-4 text-right text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      {ADMIN_COPY.queue.columns.action}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-card">
                  {applicants.map((a) => (
                    <TableRow key={a.id} className="hover:bg-muted/50">
                      <TableCell className="px-6 py-4">
                        <div className="text-sm font-medium text-foreground">{a.fullName}</div>
                        <div className="text-sm text-muted-foreground">
                          {ADMIN_COPY.queue.dniHashLabel}:{' '}
                          <span className="font-mono">{a.dniHash}</span>
                        </div>
                        {a.phone ? (
                          <div className="text-sm text-muted-foreground">{a.phone}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="text-sm font-medium">
                          {ADMIN_COPY.vehicleType[a.vehicleType]}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack
                                ? 'secondary'
                                : 'outline'
                            }
                          >
                            {ADMIN_COPY.queue.dniBadge}{' '}
                            {a.documentsSummary.hasDniFront && a.documentsSummary.hasDniBack
                              ? '✓'
                              : '—'}
                          </Badge>
                          <Badge
                            variant={a.documentsSummary.hasSelfie ? 'secondary' : 'outline'}
                          >
                            {ADMIN_COPY.queue.selfieBadge}{' '}
                            {a.documentsSummary.hasSelfie ? '✓' : '—'}
                          </Badge>
                          {a.documentsSummary.hasLicense ? (
                            <Badge
                              variant={
                                a.licenseStatus === 'verified' ? 'default' : 'secondary'
                              }
                            >
                              {ADMIN_COPY.queue.licenseBadge}{' '}
                              {a.licenseStatus === 'verified'
                                ? '✓'
                                : ADMIN_COPY.queue.uploadedFeminine}
                            </Badge>
                          ) : null}
                          {a.documentsSummary.hasInsurance ? (
                            <Badge
                              variant={
                                a.insuranceStatus === 'verified' ? 'default' : 'secondary'
                              }
                            >
                              {ADMIN_COPY.queue.insuranceBadge}{' '}
                              {a.insuranceStatus === 'verified'
                                ? '✓'
                                : ADMIN_COPY.queue.uploadedMasculine}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-sm font-semibold text-foreground">
                          {ADMIN_COPY.queue.level(a.docLevel)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                        {formatDate(a.createdAt, 'date')}
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

          {hasNextPage && nextCursor ? (
            <div className="flex items-center justify-end px-2 pt-2">
              <Button variant="outline" size="sm" onClick={handleNextPage}>
                {ADMIN_COPY.queue.nextButton}
              </Button>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
