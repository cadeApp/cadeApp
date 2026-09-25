import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

type LegalDocumentName = 'tos' | 'privacy' | 'courier_contract' | 'pilot_terms';

interface LegalDocumentDescriptor {
  readonly document: LegalDocumentName;
  readonly version: string;
  readonly href: string;
}

interface DocumentsModule {
  readonly getLegalDocument: (document: LegalDocumentName) => LegalDocumentDescriptor;
}

interface ConsentModule {
  readonly isCurrentLegalVersion: (document: LegalDocumentName, version: string) => boolean;
}

async function loadRuntimeModule<T extends object>(modulePath: string): Promise<T | null> {
  try {
    return await vi.importActual<T>(modulePath);
  } catch {
    return null;
  }
}

describe('T-311 · DoD rojo antes de implementar', () => {
  it.each([
    ['Términos y Condiciones', 'src/app/(public)/legal/terms/page.tsx'],
    ['Política de Privacidad', 'src/app/(public)/legal/privacy/page.tsx'],
    ['Condiciones de repartidores', 'src/app/(public)/legal/courier/page.tsx'],
    ['Términos del piloto', 'src/app/(public)/legal/pilot/page.tsx'],
  ])('la ruta pública de %s existe', (_label, filePath) => {
    expect(existsSync(resolve(process.cwd(), filePath))).toBe(true);
  });

  it('registra una versión vigente y una ruta para cada documento legal persistible', async () => {
    const legalDocuments = await loadRuntimeModule<DocumentsModule>('./documents');

    expect(legalDocuments).not.toBeNull();

    for (const document of [
      'tos',
      'privacy',
      'courier_contract',
      'pilot_terms',
    ] as const satisfies readonly LegalDocumentName[]) {
      const descriptor = legalDocuments?.getLegalDocument(document);
      expect(descriptor).toBeDefined();
      expect(descriptor?.document).toBe(document);
      expect(descriptor?.version).toMatch(/^\d+\.\d+$/);
      expect(descriptor?.href).toMatch(/^\/legal\//);
    }
  });

  it('rechaza como no vigente una aceptación cuya versión no coincide con el documento publicado', async () => {
    const consent = await loadRuntimeModule<ConsentModule>('./consent');

    expect(consent).not.toBeNull();
    expect(consent?.isCurrentLegalVersion('tos', '0.9')).toBe(false);
    expect(consent?.isCurrentLegalVersion('tos', '1.0')).toBe(true);
  });

  it('la Política de Privacidad distingue obligatoriedad según los schemas actuales (H11)', async () => {
    const legalDocuments = await loadRuntimeModule<DocumentsModule>('./documents');
    const privacy = legalDocuments?.getLegalDocument('privacy');
    expect(privacy).toBeDefined();
    const section = (privacy as any)?.sections?.find((s: any) => s.id === 'obligatoriedad-consecuencias');
    expect(section).toBeDefined();
    const text = section?.paragraphs?.join(' ') ?? '';
    expect(text).toMatch(/displayName.*facultativo/i);
    expect(text).toMatch(/businessName/);
    expect(text).toMatch(/defaultPickupAddress/);
    expect(text).toMatch(/defaultPickupZoneId.*facultativ/i);
    expect(text).toMatch(/vehicleType/);
    expect(text).toMatch(/patente.*moto o auto.*condicional/i);
    expect(text).toMatch(/licencia.*seguro.*facultativ/i);
    expect(text).toMatch(/pickupZoneId.*pickupAddress/);
    expect(text).toMatch(/recipientConsentDeclared/);
    expect(text).toMatch(/needsChange/);
  });
});
