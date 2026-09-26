import type { AdminApplicantTab, ApplicantDetail, ApplicantListItem } from './types';

export async function getApplicantsQueue(
  _tab: AdminApplicantTab = 'pending'
): Promise<ApplicantListItem[]> {
  // Stub inicial para fase roja
  return [];
}

export async function getApplicantDetail(
  _courierId: string
): Promise<ApplicantDetail | null> {
  // Stub inicial para fase roja
  return null;
}
