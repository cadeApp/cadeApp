import * as React from 'react';
import Link from 'next/link';
import type { ActionResult, RpcErrorCode, RpcOutput } from '@/domain';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Input } from '@/ui/input';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { ADMIN_COPY } from '../copy';

export interface DisputeCandidatesProps {
  /** Búsqueda que llegó por la URL (`?q=`); `null` si todavía no se buscó. */
  readonly lookup: string | null;
  readonly result: ActionResult<
    RpcOutput<'admin_find_courier_dispute_candidates'>,
    RpcErrorCode<'admin_find_courier_dispute_candidates'> | 'INTERNAL_ERROR'
  > | null;
}

/**
 * CC-050 (D4-B): búsqueda de reclamantes de un DNI reservado. Formulario GET (la búsqueda vive en la URL) y lista con
 * enlace al detalle protegido; el teléfono llega enmascarado y nunca hay hash ni paths.
 */
export function DisputeCandidates({ lookup, result }: DisputeCandidatesProps): React.ReactElement {
  const copy = ADMIN_COPY.disputes;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="dispute-lookup" className="text-sm font-medium text-foreground">
                {copy.lookupLabel}
              </label>
              <Input id="dispute-lookup" name="q" defaultValue={lookup ?? ''} autoComplete="off" />
            </div>
            <Button type="submit">{copy.submit}</Button>
          </form>
          <Link href="/admin/applicants" className="mt-4 inline-block text-sm text-muted-foreground underline">
            {copy.backToQueue}
          </Link>
        </CardContent>
      </Card>

      {result && !result.ok ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {result.code === 'VALIDATION_ERROR' ? copy.invalidLookup : getDomainErrorMessage(result.code)}
        </p>
      ) : null}

      {result && result.ok && result.data.candidates.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.empty} />
      ) : null}

      {result && result.ok && result.data.candidates.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {result.data.candidates.map((candidate) => (
            <li key={candidate.courierId}>
              <Card>
                <CardContent className="flex flex-col gap-1 pt-6">
                  <Link href={`/admin/applicants/${candidate.courierId}`} className="font-medium underline">
                    {candidate.displayName || 'Repartidor'}
                  </Link>
                  <span className="text-sm text-muted-foreground">{candidate.phoneMasked}</span>
                  <span className="text-sm text-muted-foreground">{copy.documents(candidate.documentsCount)}</span>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
