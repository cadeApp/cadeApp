import { describe, expect, it } from 'vitest';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { requiredDocumentsVerified } from './required-documents';
import type { ApplicantDocumentDetail } from './types';

const doc = (documentType: ApplicantDocumentDetail['documentType'], patch: Partial<ApplicantDocumentDetail> = {}) =>
  ({
    id: `${documentType}-${Math.random()}`,
    documentType,
    storagePath: `courier/x/${documentType}_1.png`,
    status: 'verified',
    uploadedAt: '2026-11-13T10:00:00.000Z',
    isCurrent: true,
    purgedAt: null,
    ...patch,
  }) satisfies ApplicantDocumentDetail;

const four = () => [doc('dni_front'), doc('dni_back'), doc('selfie'), doc('avatar')];

describe('CC-052 · requiredDocumentsVerified (misma regla que el helper SQL)', () => {
  it('true con los cuatro vigentes, verificados y sin purgar, aunque falten licencia y seguro', () => {
    expect(requiredDocumentsVerified(four())).toBe(true);
  });

  it.each(['dni_front', 'dni_back', 'selfie', 'avatar'] as const)('false si falta %s', (kind) => {
    expect(requiredDocumentsVerified(four().filter((d) => d.documentType !== kind))).toBe(false);
  });

  it.each(['submitted', 'rejected', 'none'] as const)('false si un obligatorio está %s', (status) => {
    expect(requiredDocumentsVerified([...four().slice(0, 3), doc('avatar', { status })])).toBe(false);
  });

  it('false si un obligatorio vigente fue purgado', () => {
    expect(requiredDocumentsVerified([...four().slice(0, 3), doc('avatar', { purgedAt: '2026-10-01T00:00:00.000Z' })])).toBe(false);
  });

  it('un histórico verificado no reemplaza al vigente sin verificar', () => {
    const docs = [...four().slice(0, 3), doc('avatar', { status: 'submitted' }), doc('avatar', { isCurrent: false })];
    expect(requiredDocumentsVerified(docs)).toBe(false);
  });

  it('false con dos vigentes del mismo tipo', () => {
    expect(requiredDocumentsVerified([...four(), doc('selfie')])).toBe(false);
  });

  it('los opcionales no cambian el resultado', () => {
    expect(requiredDocumentsVerified([...four(), doc('license', { status: 'rejected' })])).toBe(true);
  });
});

describe('CC-052 · mensaje de DOCUMENTS_NOT_VERIFIED', () => {
  it('sale de error-messages.ts y dice aprobar o rehabilitar', () => {
    expect(getDomainErrorMessage('DOCUMENTS_NOT_VERIFIED')).toBe(
      'Verificá DNI (frente y dorso), selfie y foto de perfil antes de aprobar o rehabilitar.'
    );
  });
});
