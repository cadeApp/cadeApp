import { getLegalDocument, LegalDocumentView } from '@/features/legal';

export default function Page() {
  return <LegalDocumentView document={getLegalDocument('tos')} />;
}
