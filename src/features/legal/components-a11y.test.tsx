// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { RegisterForm } from '@/features/auth';
import { MerchantOnboardingForm } from '@/features/merchants';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

describe('H07: Checkboxes de consentimiento con nombre accesible', () => {
  afterEach(cleanup);

  it('RegisterForm expone checkbox con nombre accesible que referencia términos y privacidad', () => {
    render(<RegisterForm />);
    const checkbox = screen.getByRole('checkbox', { name: /términos.*privacidad/i });
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toBeNull();
  });

  it('MerchantOnboardingForm expone checkbox con nombre accesible que referencia términos del piloto', () => {
    render(<MerchantOnboardingForm zones={[]} />);
    const checkbox = screen.getByRole('checkbox', { name: /términos del piloto/i });
    expect(checkbox).toBeDefined();
    expect(checkbox).not.toBeNull();
  });
});

describe('H08: Accesibilidad y estructura DOM de documentos legales', () => {
  afterEach(cleanup);

  it('LegalDocumentView expone jerarquía de encabezados, navegación accesible y sin violaciones estructurales', async () => {
    const { getLegalDocument } = await import('./documents');
    const { LegalDocumentView } = await import('./components/legal-document-view');
    const { auditDomAccessibilityStructure } = await import('@/ui/design-system-showcase');

    const tosDoc = getLegalDocument('tos');
    const { container } = render(<LegalDocumentView document={tosDoc} />);

    // H1 presente y único
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toBeDefined();
    expect(h1.textContent).toBe(tosDoc.title);

    // Navegación con nombre accesible
    const nav = screen.getByRole('navigation', { name: /índice del documento/i });
    expect(nav).toBeDefined();

    // Enlace de retroceso con nombre accesible
    const backLink = screen.getByRole('link', { name: /volver a documentos legales/i });
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute('href')).toBe('/legal');

    // Auditoría estructural del DOM
    const violations = auditDomAccessibilityStructure(container);
    expect(violations).toEqual([]);
  });

  it('LegalDocumentView para Política de Privacidad cumple accesibilidad estructural sin violaciones', async () => {
    const { getLegalDocument } = await import('./documents');
    const { LegalDocumentView } = await import('./components/legal-document-view');
    const { auditDomAccessibilityStructure } = await import('@/ui/design-system-showcase');

    const privacyDoc = getLegalDocument('privacy');
    const { container } = render(<LegalDocumentView document={privacyDoc} />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toBe(privacyDoc.title);

    const violations = auditDomAccessibilityStructure(container);
    expect(violations).toEqual([]);
  });
});
