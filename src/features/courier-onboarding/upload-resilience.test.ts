import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentUploadManager,
  type DocumentUploadItem,
  type CourierDocumentKind,
} from './upload-manager';

describe('T-121 · DoD 2: Resiliencia ante cortes de red en la subida de documentos', () => {
  it('registra el fallo de red individualmente sin descartar documentos ya subidos', async () => {
    let shouldFailDniBack = true;

    const mockUploader = vi.fn(
      async (kind: CourierDocumentKind, _file: File): Promise<{ storagePath: string }> => {
        if (kind === 'dni_back' && shouldFailDniBack) {
          throw new Error('Failed to fetch: Connection reset by peer');
        }
        return { storagePath: `courier/user-123/${kind}_test.jpg` };
      }
    );

    const manager = createDocumentUploadManager({ uploader: mockUploader });

    const files: Record<CourierDocumentKind, File> = {
      dni_front: new File(['front'], 'front.jpg', { type: 'image/jpeg' }),
      dni_back: new File(['back'], 'back.jpg', { type: 'image/jpeg' }),
      selfie: new File(['selfie'], 'selfie.jpg', { type: 'image/jpeg' }),
      avatar: new File(['avatar'], 'avatar.jpg', { type: 'image/jpeg' }),
      license: new File(['license'], 'license.jpg', { type: 'image/jpeg' }),
      insurance: new File(['insurance'], 'insurance.jpg', { type: 'image/jpeg' }),
    };

    // 1. Subir dni_front con éxito
    await manager.uploadDocument('dni_front', files.dni_front);
    expect(manager.getStatus('dni_front')).toBe('success');
    expect(manager.getStoragePath('dni_front')).toBe('courier/user-123/dni_front_test.jpg');

    // 2. Subir dni_back con corte de red simulado
    await expect(manager.uploadDocument('dni_back', files.dni_back)).rejects.toThrow(
      'Failed to fetch'
    );
    expect(manager.getStatus('dni_back')).toBe('error');

    // Invariante DoD: dni_front sigue en estado de éxito y no se perdió
    expect(manager.getStatus('dni_front')).toBe('success');
    expect(manager.getStoragePath('dni_front')).toBe('courier/user-123/dni_front_test.jpg');

    // 3. Reintento de la subida tras restablecer la red
    shouldFailDniBack = false;
    await manager.retryDocument('dni_back', files.dni_back);

    expect(manager.getStatus('dni_back')).toBe('success');
    expect(manager.getStoragePath('dni_back')).toBe('courier/user-123/dni_back_test.jpg');

    // El uploader sólo fue llamado dos veces para dni_back y una para dni_front (no se re-subió dni_front)
    const calls = mockUploader.mock.calls.map((c) => c[0]);
    expect(calls.filter((k) => k === 'dni_front')).toHaveLength(1);
    expect(calls.filter((k) => k === 'dni_back')).toHaveLength(2);
  });
});
