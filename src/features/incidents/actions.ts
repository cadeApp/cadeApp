'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/server/supabase/server';
import { callRequestRpc } from '@/server/rpc/requests';
import { adminResolveIncidentRpc } from '@/server/rpc/admin';
import { getServerSession } from '@/features/auth/server';
import { err, ok, type ActionResult, type DomainErrorCode, type RpcOutput } from '@/domain';
import {
  reportIncidentFormSchema,
  resolveIncidentSchema,
  type ReportIncidentFormInput,
  type ResolveIncidentInput,
} from './schemas';

/**
 * C06/R07: el comercio o el repartidor del viaje reporta un incidente vía `report_incident`.
 * La matriz D05-A, la ventana de 24 h, el consentimiento y el tope por minuto los decide Postgres; la action solo
 * descarta temprano lo que la RPC igual rechazaría (sin sesión, admin, datos inválidos).
 */
export async function reportIncidentAction(
  input: ReportIncidentFormInput
): Promise<ActionResult<RpcOutput<'report_incident'>, DomainErrorCode>> {
  const session = await getServerSession();
  if (!session) {
    return err('UNAUTHENTICATED');
  }
  if (session.role !== 'merchant' && session.role !== 'courier') {
    return err('UNAUTHORIZED_ACTOR');
  }

  const parsed = reportIncidentFormSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const client = await createClient();
  const result = await callRequestRpc(client, 'report_incident', parsed.data);
  if (!result.ok) {
    return err(result.code);
  }

  revalidatePath('/admin/incidents');
  return ok(result.data);
}

/**
 * A05 (D06-A): resolución auditada vía `admin_resolve_incident`. `preventive_suspension` suspende en Postgres al
 * repartidor de la oferta aceptada; la action nunca recibe ni envía el id del repartidor.
 */
export async function resolveIncidentAction(
  input: ResolveIncidentInput
): Promise<ActionResult<RpcOutput<'admin_resolve_incident'>, DomainErrorCode>> {
  const session = await getServerSession();
  if (!session) {
    return err('UNAUTHENTICATED');
  }
  if (session.role !== 'admin') {
    return err('UNAUTHORIZED_ACTOR');
  }
  if (session.aal !== 'aal2') {
    return err('AAL2_REQUIRED');
  }

  const parsed = resolveIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return err('VALIDATION_ERROR');
  }

  const client = await createClient();
  const result = await adminResolveIncidentRpc(client, parsed.data);
  if (!result.ok) {
    return err(result.code);
  }

  revalidatePath('/admin/incidents');
  revalidatePath(`/admin/incidents/${parsed.data.incidentId}`);
  revalidatePath('/admin/audit');
  return ok(result.data);
}
