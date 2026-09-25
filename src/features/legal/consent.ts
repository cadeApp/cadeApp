import { getLegalDocument, type LegalDocumentName } from './documents';

export interface LegalAcceptance {
  readonly document: LegalDocumentName;
  readonly version: string;
}

export function isCurrentLegalVersion(document: LegalDocumentName, version: string): boolean {
  return version === getLegalDocument(document).version;
}

export function areCurrentLegalVersions(acceptances: readonly LegalAcceptance[]): boolean {
  return acceptances.every(({ document, version }) => isCurrentLegalVersion(document, version));
}
