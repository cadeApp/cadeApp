import * as React from 'react';
import Link from 'next/link';
import { Phone } from 'lucide-react';
import { INCIDENT_DECISIONS, type IncidentDecision } from '@/domain';
import { formatDate, formatPhone } from '@/lib/format';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { INCIDENTS_COPY } from '../copy';
import type { IncidentDetail, IncidentParty, IncidentTimeline } from '../types';
import { IncidentResolutionActions } from './incident-resolution-actions';
import { IncidentStatusBadge } from './incident-status-badge';

const COPY = INCIDENTS_COPY.detail;

const LINK_FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const TIMELINE_ORDER = ['publishedAt', 'matchedAt', 'pickedUpAt', 'deliveredAt', 'cancelledAt'] as const satisfies readonly (keyof IncidentTimeline)[];

function displayPhone(phone: string): string {
  try {
    return formatPhone(phone);
  } catch {
    return phone;
  }
}

/** `admin_resolve_incident` guarda `<decisión>: <motivo>`; se muestra la decisión con su etiqueta humana. */
function splitResolution(resolution: string): { decision: IncidentDecision | null; reason: string } {
  for (const decision of INCIDENT_DECISIONS) {
    const prefix = `${decision}: `;
    if (resolution.startsWith(prefix)) {
      return { decision, reason: resolution.slice(prefix.length) };
    }
  }
  return { decision: null, reason: resolution };
}

function PartyCard({
  label,
  party,
  suspended = false,
}: {
  readonly label: string;
  readonly party: IncidentParty;
  readonly suspended?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="break-words text-base font-semibold text-foreground">{party.name}</p>
        {suspended ? <Badge variant="destructive">{COPY.courierSuspended}</Badge> : null}
      </div>
      {party.phone ? (
        <a
          href={`tel:${party.phone.replace(/[^\d+]/g, '')}`}
          aria-label={COPY.call(party.name)}
          className={cn(
            'inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-semibold text-foreground hover:bg-muted',
            LINK_FOCUS
          )}
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          {displayPhone(party.phone)}
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">{COPY.noPhone}</p>
      )}
    </div>
  );
}

export interface IncidentDetailPanelProps {
  readonly incident: IncidentDetail;
}

/**
 * A05: detalle del incidente para mediar (relato, cronología y partes con teléfono) y resolverlo. Sin datos del
 * destinatario. Las acciones solo aparecen mientras el incidente está abierto o en revisión.
 */
export function IncidentDetailPanel({ incident }: IncidentDetailPanelProps) {
  const kind = INCIDENTS_COPY.kinds[incident.kind];
  const isOpen = incident.status === 'open' || incident.status === 'reviewing';
  const timeline = TIMELINE_ORDER.flatMap((key) => {
    const at = incident.timeline[key];
    return at ? [{ key, at }] : [];
  });
  const resolution = incident.resolution ? splitResolution(incident.resolution) : null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/incidents"
        className={cn(
          'inline-flex min-h-12 items-center text-sm font-medium text-muted-foreground hover:text-foreground',
          LINK_FOCUS
        )}
      >
        {COPY.back}
      </Link>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{COPY.title(kind)}</h1>
          <IncidentStatusBadge status={incident.status} />
        </div>
        <time dateTime={incident.createdAt} className="block text-sm text-muted-foreground">
          {formatDate(incident.createdAt)}
        </time>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.storyTitle}</h2>
            <p className="whitespace-pre-line break-words text-base text-foreground">{incident.description}</p>
            <p className="text-sm text-muted-foreground">
              {COPY.reportedBy(INCIDENTS_COPY.roles[incident.reporterRole], incident.reporterName)}
            </p>
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.timelineTitle}</h2>
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {timeline.map(({ key, at }) => (
                <li key={key} className="space-y-0.5">
                  <p className="text-sm font-semibold text-foreground">{COPY.timeline[key]}</p>
                  <time dateTime={at} className="block text-sm text-muted-foreground">
                    {formatDate(at)}
                  </time>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="text-lg font-bold text-foreground">{COPY.partiesTitle}</h2>
            <PartyCard label={COPY.merchantLabel} party={incident.merchant} />
            {incident.courier ? (
              <PartyCard
                label={COPY.courierLabel}
                party={incident.courier}
                suspended={incident.courierSuspended}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{COPY.noCourier}</p>
            )}
          </Card>
        </div>

        <Card className="h-fit space-y-4 p-4 sm:p-6">
          {isOpen ? (
            <>
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-foreground">{COPY.resolutionTitle}</h2>
                <p className="text-sm text-muted-foreground">{COPY.resolutionHelp}</p>
              </div>
              <IncidentResolutionActions
                incidentId={incident.id}
                canSuspend={incident.courier !== null && !incident.courierSuspended}
              />
            </>
          ) : (
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-foreground">{COPY.closedTitle}</h2>
              {resolution?.decision ? (
                <p className="text-sm font-semibold text-foreground">
                  {COPY.decisionLabels[resolution.decision]}
                </p>
              ) : null}
              <p className="whitespace-pre-line break-words text-sm text-foreground">
                {resolution ? resolution.reason : COPY.noResolution}
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
