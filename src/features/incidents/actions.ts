'use server';

import type { ActionResult, DomainErrorCode, RpcOutput } from '@/domain';
import type {
  ReportIncidentInput,
  ResolveIncidentInput,
  SuspendCourierForIncidentInput,
} from './schemas';

/**
 * C06/R07: el comercio o el repartidor del viaje reporta un incidente vía `report_incident`.
 */
export async function reportIncidentAction(
  _input: ReportIncidentInput
): Promise<ActionResult<RpcOutput<'report_incident'>, DomainErrorCode>> {
  throw new Error('T-124: sin implementar');
}

/**
 * A05: suspensión cautelar inmediata del repartidor involucrado, vía `admin_suspend_courier` (aal2).
 */
export async function suspendCourierForIncidentAction(
  _input: SuspendCourierForIncidentInput
): Promise<ActionResult<RpcOutput<'admin_suspend_courier'>, DomainErrorCode>> {
  throw new Error('T-124: sin implementar');
}

/**
 * A05: resolución auditada del incidente vía `admin_resolve_incident` (contract-change pendiente, D03).
 */
export async function resolveIncidentAction(
  _input: ResolveIncidentInput
): Promise<ActionResult<{ readonly incidentId: string }, DomainErrorCode>> {
  throw new Error('T-124: sin implementar');
}
