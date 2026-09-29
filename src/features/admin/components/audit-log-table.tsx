import * as React from 'react';
import Link from 'next/link';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/table';
import { formatDate } from '@/lib/format';
import {
  auditActionLabel,
  auditEntityLabel,
  auditFieldLabel,
  auditTargetLabel,
  formatAuditValue,
} from '../audit-format';
import { ADMIN_COPY } from '../copy';
import { AUDIT_TARGET_TYPES, type AdminAuditFilters } from '../schemas';
import type { AuditActorOption, AuditLogResult } from '../types';

const COPY = ADMIN_COPY.audit;
const AUDIT_PATH = '/admin/audit';

const HEADER_CLASS =
  'px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground';

// Mismo aspecto que Input de src/ui: los filtros usan <select> nativo para funcionar por GET sin JS.
const SELECT_CLASS =
  'flex h-12 w-full rounded-lg border border-input bg-card px-3.5 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1';

/**
 * Construye la URL de A06 conservando todos los filtros activos (operador, evento y entidad).
 */
export function buildAuditHref(filters: AdminAuditFilters, cursor?: number): string {
  const params = new URLSearchParams();
  if (cursor !== undefined) params.set('cursor', String(cursor));
  if (filters.actorId) params.set('actor', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.targetType) params.set('entity', filters.targetType);
  const query = params.toString();
  return query ? `${AUDIT_PATH}?${query}` : AUDIT_PATH;
}

export interface AuditLogTableProps {
  readonly result: AuditLogResult;
  readonly filters: AdminAuditFilters;
  readonly actors: readonly AuditActorOption[];
}

/**
 * A06: registro de auditoría de solo lectura, con filtros y paginación resueltos en el servidor.
 */
export function AuditLogTable({ result, filters, actors }: AuditLogTableProps) {
  const actionOptions = Object.keys(COPY.actions);
  const hasFilters = Boolean(filters.actorId || filters.action || filters.targetType);
  const actorKnown = !filters.actorId || actors.some((actor) => actor.id === filters.actorId);
  const actionKnown = !filters.action || actionOptions.includes(filters.action);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title}</h1>
        <Badge variant="secondary">{COPY.readOnlyBadge}</Badge>
        <p className="w-full text-sm text-muted-foreground">{COPY.description}</p>
      </div>

      <Card className="border border-border p-4 shadow-sm">
        <form
          role="search"
          method="get"
          action={AUDIT_PATH}
          aria-label={COPY.filters.label}
          className="grid gap-4 md:grid-cols-4 md:items-end"
        >
          <div className="space-y-1.5">
            <label htmlFor="audit-filter-actor" className="block text-sm font-semibold text-foreground">
              {COPY.filters.actor}
            </label>
            <select
              id="audit-filter-actor"
              name="actor"
              defaultValue={filters.actorId ?? ''}
              className={SELECT_CLASS}
            >
              <option value="">{COPY.filters.allActors}</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
              {actorKnown ? null : (
                <option value={filters.actorId}>{COPY.unnamedOperator}</option>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="audit-filter-action" className="block text-sm font-semibold text-foreground">
              {COPY.filters.action}
            </label>
            <select
              id="audit-filter-action"
              name="action"
              defaultValue={filters.action ?? ''}
              className={SELECT_CLASS}
            >
              <option value="">{COPY.filters.allActions}</option>
              {actionOptions.map((action) => (
                <option key={action} value={action}>
                  {auditActionLabel(action)}
                </option>
              ))}
              {actionKnown ? null : (
                <option value={filters.action}>{COPY.unknownAction}</option>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="audit-filter-entity" className="block text-sm font-semibold text-foreground">
              {COPY.filters.entity}
            </label>
            <select
              id="audit-filter-entity"
              name="entity"
              defaultValue={filters.targetType ?? ''}
              className={SELECT_CLASS}
            >
              <option value="">{COPY.filters.allEntities}</option>
              {AUDIT_TARGET_TYPES.map((targetType) => (
                <option key={targetType} value={targetType}>
                  {auditEntityLabel(targetType)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" size="sm">
              {COPY.filters.apply}
            </Button>
            {hasFilters ? (
              <Link
                href={AUDIT_PATH}
                className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {COPY.filters.clear}
              </Link>
            ) : null}
          </div>
        </form>
      </Card>

      {result.items.length === 0 ? (
        <EmptyState title={COPY.emptyTitle} description={COPY.emptyDescription} />
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <Table aria-label={COPY.tableLabel}>
            <TableHeader className="bg-muted/70">
              <TableRow>
                <TableHead className={HEADER_CLASS}>{COPY.columns.date}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.operator}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.action}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.entity}</TableHead>
                <TableHead className={HEADER_CLASS}>{COPY.columns.detail}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card">
              {result.items.map((item) => (
                <TableRow key={item.id} className="align-top">
                  <TableCell className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                    <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm font-medium text-foreground">
                    {item.actorName ?? COPY.system}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {auditActionLabel(item.action)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    <span className="block">{auditEntityLabel(item.targetType)}</span>
                    <span className="block font-mono text-sm text-muted-foreground">
                      {auditTargetLabel(item)}
                    </span>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {item.changes.length === 0 ? (
                      <span className="text-muted-foreground">{COPY.noChanges}</span>
                    ) : (
                      <ul className="space-y-1">
                        {item.changes.map((change) => (
                          <li key={change.field}>
                            <span className="text-muted-foreground">
                              {auditFieldLabel(change.field)}:
                            </span>{' '}
                            {formatAuditValue(item, change.field, change.before)}
                            <span aria-hidden="true"> → </span>
                            <span className="sr-only"> a </span>
                            <span className="font-semibold">
                              {formatAuditValue(item, change.field, change.after)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {item.hasReason ? (
                      <Badge variant="outline" className="mt-2">
                        {COPY.withReason}
                      </Badge>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {filters.cursor !== undefined || (result.hasNextPage && result.nextCursor !== null) ? (
        <nav className="flex items-center justify-end gap-3" aria-label={COPY.paginationLabel}>
          {filters.cursor !== undefined ? (
            <Link
              href={buildAuditHref(filters)}
              className="inline-flex min-h-12 items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.firstPage}
            </Link>
          ) : null}
          {result.hasNextPage && result.nextCursor !== null ? (
            <Link
              href={buildAuditHref(filters, result.nextCursor)}
              className="inline-flex min-h-12 items-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {COPY.nextButton}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
