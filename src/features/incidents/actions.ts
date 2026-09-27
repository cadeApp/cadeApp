'use server';

import type { ActionResult, DomainErrorCode, RpcOutput } from '@/domain';
import type { ReportIncidentFormInput, ResolveIncidentInput } from './schemas';

/**
 * C06/R07: el comercio o el repartidor del viaje reporta un incidente vía `report_incident`.
 */
export async function reportIncidentAction(
  _input: ReportIncidentFormInput
): Promise<ActionResult<RpcOutput<'report_incident'>, DomainErrorCode>> {
  throw new Error('T-124: sin implementar');
}

/**
 * A05 (D06-A): resolución auditada vía `admin_resolve_incident`. `preventive_suspension` suspende en Postgres al
 * repartidor de la oferta aceptada; la action nunca recibe ni envía `courierId`.
 */
export async function resolveIncidentAction(
  _input: ResolveIncidentInput
): Promise<ActionResult<RpcOutput<'admin_resolve_incident'>, DomainErrorCode>> {
  throw new Error('T-124: sin implementar');
}
