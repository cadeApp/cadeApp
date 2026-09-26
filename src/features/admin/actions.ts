'use server';

import { err, type ActionResult, type DomainErrorCode } from '@/domain/errors';
import type { ViewDocumentResult } from './types';

export async function viewCourierDocumentAction(
  _input: { documentId: string; courierId: string }
): Promise<ActionResult<ViewDocumentResult, DomainErrorCode>> {
  // Stub inicial para fase roja
  return err('INTERNAL_ERROR');
}

export async function decideCourierAction(
  _input: { courierId: string; decision: 'approved' | 'rejected'; reason: string }
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  // Stub inicial para fase roja
  return err('INTERNAL_ERROR');
}

export async function suspendCourierAction(
  _input: { courierId: string; reason: string }
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  // Stub inicial para fase roja
  return err('INTERNAL_ERROR');
}

export async function verifyCourierDocumentAction(
  _input: { documentId: string; verified: boolean; rejectionReason?: string | null }
): Promise<ActionResult<{ success: true }, DomainErrorCode>> {
  // Stub inicial para fase roja
  return err('INTERNAL_ERROR');
}
