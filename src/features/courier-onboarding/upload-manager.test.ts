import { describe, expect, it } from 'vitest';
import {
  acceptedDocumentMimeTypes,
  validateDocumentFile,
  DOCUMENT_PDF_MAX_BYTES,
  type CourierDocumentKind,
} from './upload-manager';

function pdf(content = '%PDF-1.7\n%seguro', name = 'seguro.pdf'): File {
  return new File([content], name, { type: 'application/pdf' });
}

function withSize(file: File, size: number): File {
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('T-387: tipos de archivo admitidos por documento', () => {
  it.each(['license', 'insurance'] as const)('%s admite fotos y PDF', (kind) => {
    expect(acceptedDocumentMimeTypes(kind)).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]);
  });

  it.each(['dni_front', 'dni_back', 'selfie', 'avatar'] as const)(
    '%s admite solo fotos',
    (kind) => {
      expect(acceptedDocumentMimeTypes(kind)).toEqual(['image/jpeg', 'image/png', 'image/webp']);
    }
  );
});

describe('T-387: validación del archivo antes de subirlo', () => {
  it('un PDF válido de licencia o seguro pasa y se marca como PDF', async () => {
    await expect(validateDocumentFile('insurance', pdf())).resolves.toEqual({
      ok: true,
      isPdf: true,
    });
    await expect(validateDocumentFile('license', pdf())).resolves.toEqual({
      ok: true,
      isPdf: true,
    });
  });

  it('una foto pasa y no se marca como PDF', async () => {
    const photo = new File(['jpeg'], 'seguro.jpg', { type: 'image/jpeg' });
    await expect(validateDocumentFile('insurance', photo)).resolves.toEqual({
      ok: true,
      isPdf: false,
    });
    await expect(validateDocumentFile('dni_front', photo)).resolves.toEqual({
      ok: true,
      isPdf: false,
    });
  });

  it('un PDF de exactamente 10 MiB pasa y uno de 10 MiB + 1 byte se rechaza por tamaño', async () => {
    await expect(
      validateDocumentFile('insurance', withSize(pdf(), DOCUMENT_PDF_MAX_BYTES))
    ).resolves.toEqual({
      ok: true,
      isPdf: true,
    });
    await expect(
      validateDocumentFile('insurance', withSize(pdf(), DOCUMENT_PDF_MAX_BYTES + 1))
    ).resolves.toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(DOCUMENT_PDF_MAX_BYTES).toBe(10 * 1024 * 1024);
  });

  it('un archivo con MIME de PDF que no empieza con %PDF- se rechaza', async () => {
    await expect(
      validateDocumentFile('insurance', pdf('<html>no soy un pdf</html>'))
    ).resolves.toEqual({
      ok: false,
      reason: 'invalid_pdf',
    });
    await expect(validateDocumentFile('insurance', pdf('%PDF'))).resolves.toEqual({
      ok: false,
      reason: 'invalid_pdf',
    });
  });

  it.each([
    ['dni_front', 'un PDF', () => pdf()],
    ['selfie', 'un PDF', () => pdf()],
    ['avatar', 'un PDF', () => pdf()],
    ['insurance', 'un texto', () => new File(['texto'], 'seguro.txt', { type: 'text/plain' })],
    ['license', 'un GIF', () => new File(['gif'], 'licencia.gif', { type: 'image/gif' })],
  ] as [CourierDocumentKind, string, () => File][])(
    '%s con %s se rechaza por tipo no admitido',
    async (kind, _label, makeFile) => {
      const file = makeFile();
      await expect(validateDocumentFile(kind, file)).resolves.toEqual({
        ok: false,
        reason: 'unsupported_type',
      });
    }
  );
});
