import { LegalDocumentView } from '@/features/legal/components/legal-document-view';
import { getLegalDocument } from '@/features/legal';

export default function Page() {
  return <LegalDocumentView document={getLegalDocument('privacy')} />;
}
