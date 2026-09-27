import * as React from 'react';
import Link from 'next/link';
import { Card } from '@/ui/card';
import { formatDate } from '@/lib/format';
import { formatAuditValue, settingLabel } from '../audit-format';
import { ADMIN_COPY } from '../copy';
import type { AuditLogItem } from '../types';

const COPY = ADMIN_COPY.recentChanges;

export interface RecentSettingChangesProps {
  readonly items: readonly AuditLogItem[];
}

/**
 * A04: panel «Últimos cambios» de parámetros, leído server-side desde `audit_log` (D04).
 * Solo muestra el parámetro, el cambio de valor, la fecha y el operador; nada de `before`/`after` crudo.
 */
export function RecentSettingChanges({ items }: RecentSettingChangesProps) {
  const headingId = 'recent-setting-changes-title';

  return (
    <Card className="space-y-4 border border-border p-4 shadow-sm">
      <h2 id={headingId} className="text-base font-bold text-foreground">
        {COPY.title}
      </h2>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{COPY.empty}</p>
      ) : (
        <ul aria-labelledby={headingId} className="divide-y divide-border">
          {items.map((item) => {
            const change = item.changes.find((candidate) => candidate.field === 'value');
            return (
              <li key={item.id} className="space-y-1 py-3 first:pt-0 last:pb-0">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {settingLabel(item.targetRef)}
                  </p>
                  <time
                    dateTime={item.createdAt}
                    className="whitespace-nowrap text-sm text-muted-foreground"
                  >
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                {change ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground line-through">
                      {formatAuditValue(item, change.field, change.before)}
                    </span>
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> a </span>
                    <span className="font-semibold">
                      {formatAuditValue(item, change.field, change.after)}
                    </span>
                  </p>
                ) : null}
                <p className="text-sm text-muted-foreground">
                  {item.actorName ?? ADMIN_COPY.audit.system}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/admin/audit?entity=platform_setting"
        className="inline-flex min-h-12 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {COPY.viewAll}
      </Link>
    </Card>
  );
}
