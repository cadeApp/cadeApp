'use client';

import * as React from 'react';
import Link from 'next/link';
import type { DomainErrorCode, RpcOutput } from '@/domain';
import { Button } from '@/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import { Input } from '@/ui/input';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { findDisputeCandidatesAction, findDniReservationAction } from '../actions';
import { ADMIN_COPY } from '../copy';

type CandidatesState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'ok'; readonly data: RpcOutput<'admin_find_courier_dispute_candidates'> }
  | { readonly kind: 'error'; readonly code: DomainErrorCode };

type ReservationState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'ok'; readonly data: RpcOutput<'admin_find_courier_dni_reservation'> }
  | { readonly kind: 'error'; readonly code: DomainErrorCode };

function errorMessage(code: DomainErrorCode, invalidMessage: string): string {
  return code === 'VALIDATION_ERROR' ? invalidMessage : getDomainErrorMessage(code);
}

/**
 * CC-050 (D4-B, PR711-H02/H03): búsquedas de una disputa de DNI. Las dos van por POST (server actions) y con estado
 * local: el teléfono, el UUID y el DNI nunca viajan en la URL ni se repiten en la pantalla.
 */
export function DisputeCandidates(): React.ReactElement {
  const copy = ADMIN_COPY.disputes;
  const [lookup, setLookup] = React.useState('');
  const [dni, setDni] = React.useState('');
  const [candidates, setCandidates] = React.useState<CandidatesState>({ kind: 'idle' });
  const [reservation, setReservation] = React.useState<ReservationState>({ kind: 'idle' });
  const [searchingCandidates, startCandidates] = React.useTransition();
  const [searchingReservation, startReservation] = React.useTransition();
  // PR711-H06: versión vigente de cada búsqueda. Editar cualquier campo invalida las dos (y las respuestas en vuelo),
  // así nunca queda a la vista la cuenta de otro caso.
  const candidatesRequest = React.useRef(0);
  const reservationRequest = React.useRef(0);

  const invalidateResults = () => {
    candidatesRequest.current += 1;
    reservationRequest.current += 1;
    setCandidates({ kind: 'idle' });
    setReservation({ kind: 'idle' });
  };

  const onSearchCandidates = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = ++candidatesRequest.current;
    const submittedLookup = lookup;
    startCandidates(async () => {
      const result = await findDisputeCandidatesAction({ lookup: submittedLookup });
      if (requestId !== candidatesRequest.current) return;
      setCandidates(result.ok ? { kind: 'ok', data: result.data } : { kind: 'error', code: result.code });
    });
  };

  const onSearchReservation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const requestId = ++reservationRequest.current;
    const submittedDni = dni;
    startReservation(async () => {
      const result = await findDniReservationAction({ dni: submittedDni });
      if (requestId !== reservationRequest.current) return;
      setReservation(result.ok ? { kind: 'ok', data: result.data } : { kind: 'error', code: result.code });
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <form
            method="post"
            aria-label={copy.claimantFormLabel}
            onSubmit={onSearchCandidates}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="dispute-lookup" className="text-sm font-medium text-foreground">
                {copy.lookupLabel}
              </label>
              <Input
                id="dispute-lookup"
                value={lookup}
                onChange={(event) => {
                  invalidateResults();
                  setLookup(event.target.value);
                }}
                autoComplete="off"
              />
            </div>
            <Button type="submit" disabled={searchingCandidates}>
              {searchingCandidates ? copy.searching : copy.submit}
            </Button>
          </form>

          <form
            method="post"
            aria-label={copy.reservationFormLabel}
            onSubmit={onSearchReservation}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-2">
              <label htmlFor="dispute-dni" className="text-sm font-medium text-foreground">
                {copy.dniLabel}
              </label>
              <Input
                id="dispute-dni"
                value={dni}
                onChange={(event) => {
                  invalidateResults();
                  setDni(event.target.value);
                }}
                inputMode="numeric"
                autoComplete="off"
              />
              <p className="text-sm text-muted-foreground">{copy.dniNote}</p>
            </div>
            <Button type="submit" variant="outline" disabled={searchingReservation}>
              {searchingReservation ? copy.searching : copy.reservationSubmit}
            </Button>
          </form>

          <Link href="/admin/applicants" className="text-sm text-muted-foreground underline">
            {copy.backToQueue}
          </Link>
        </CardContent>
      </Card>

      <section aria-label={copy.reservationResultLabel} className="flex flex-col gap-3">
        {reservation.kind === 'error' ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorMessage(reservation.code, copy.invalidDni)}
          </p>
        ) : null}
        {reservation.kind === 'ok' && reservation.data.reservation === null ? (
          <EmptyState title={copy.emptyTitle} description={copy.reservationEmpty} />
        ) : null}
        {reservation.kind === 'ok' && reservation.data.reservation !== null ? (
          <Card>
            <CardContent className="flex flex-col gap-1 pt-6">
              <span className="text-sm text-muted-foreground">{copy.reservationFound}</span>
              <Link
                href={`/admin/applicants/${reservation.data.reservation.courierId}`}
                className="font-medium underline"
              >
                {copy.reservationLink(ADMIN_COPY.audit.values[reservation.data.reservation.status])}
              </Link>
              <span className="text-sm text-muted-foreground">{copy.reservationNote}</span>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <section aria-label={copy.candidatesResultLabel} className="flex flex-col gap-3">
        {candidates.kind === 'error' ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {errorMessage(candidates.code, copy.invalidLookup)}
          </p>
        ) : null}
        {candidates.kind === 'ok' && candidates.data.candidates.length === 0 ? (
          <EmptyState title={copy.emptyTitle} description={copy.empty} />
        ) : null}
        {candidates.kind === 'ok' && candidates.data.candidates.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {candidates.data.candidates.map((candidate) => (
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
      </section>
    </div>
  );
}
