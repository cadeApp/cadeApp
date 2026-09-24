import { describe, expect, it, vi } from 'vitest';
import {
  createDocumentUploadManager,
  uploadCourierDocument,
  buildCourierStoragePath,
  getDocumentExtension,
  COURIER_DOCS_BUCKET,
  REQUIRED_COURIER_DOCUMENT_KINDS,
  type CourierDocumentKind,
  type StorageClientLike,
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

describe('T-121 · Máquina de estados independiente por documento', () => {
  it('inicializa todos los documentos en idle con progreso 0', () => {
    const manager = createDocumentUploadManager({ courierId: 'courier-001' });

    expect(manager.getStatus('dni_front')).toBe('idle');
    expect(manager.isIdle('dni_front')).toBe(true);
    expect(manager.getProgress('dni_front')).toBe(0);
    expect(manager.getStoragePath('dni_front')).toBeNull();
    expect(manager.getError('dni_front')).toBeNull();
    expect(manager.isAllUploaded()).toBe(false);
  });

  it('transita por idle -> uploading -> success con reporte de progreso', async () => {
    const progressUpdates: number[] = [];

    const mockUploader = vi.fn(
      async (
        _kind: CourierDocumentKind,
        _file: File,
        options?: { onProgress?: (p: number) => void }
      ) => {
        options?.onProgress?.(30);
        options?.onProgress?.(70);
        return { storagePath: 'courier/c-1/selfie_123.jpg' };
      }
    );

    const manager = createDocumentUploadManager({ uploader: mockUploader });
    const file = new File(['data'], 'selfie.jpg', { type: 'image/jpeg' });

    manager.subscribe((state) => {
      progressUpdates.push(state.selfie.progress);
    });

    const result = await manager.uploadDocument('selfie', file);

    expect(result.storagePath).toBe('courier/c-1/selfie_123.jpg');
    expect(manager.getStatus('selfie')).toBe('success');
    expect(manager.isSuccess('selfie')).toBe(true);
    expect(manager.getProgress('selfie')).toBe(100);
    expect(manager.getStoragePath('selfie')).toBe('courier/c-1/selfie_123.jpg');
    expect(progressUpdates).toContain(30);
    expect(progressUpdates).toContain(70);
    expect(progressUpdates).toContain(100);
  });

  it('permite reintento aislado sin volver a pasar el File si ya fue almacenado', async () => {
    let fail = true;
    const mockUploader = vi.fn(async () => {
      if (fail) throw new Error('Network timeout');
      return { storagePath: 'courier/c-1/avatar_123.jpg' };
    });

    const manager = createDocumentUploadManager({ uploader: mockUploader });
    const file = new File(['avatar-bytes'], 'avatar.png', { type: 'image/png' });

    await expect(manager.uploadDocument('avatar', file)).rejects.toThrow('Network timeout');
    expect(manager.getStatus('avatar')).toBe('error');
    expect(manager.getError('avatar')).toBe('Network timeout');

    fail = false;
    // Reintento sin reenviar el archivo explícitamente
    await manager.retryDocument('avatar');

    expect(manager.getStatus('avatar')).toBe('success');
    expect(manager.getStoragePath('avatar')).toBe('courier/c-1/avatar_123.jpg');
    expect(manager.getError('avatar')).toBeNull();
  });

  it('soporta resetDocument para reiniciar un documento individual', async () => {
    const manager = createDocumentUploadManager({
      uploader: async () => ({ storagePath: 'courier/c-1/license_1.jpg' }),
    });

    await manager.uploadDocument('license', new File(['lic'], 'license.jpg'));
    expect(manager.getStatus('license')).toBe('success');

    manager.resetDocument('license');
    expect(manager.getStatus('license')).toBe('idle');
    expect(manager.getStoragePath('license')).toBeNull();
  });

  it('calcula correctamente isAllUploaded y getUploadedPaths', async () => {
    const manager = createDocumentUploadManager({
      uploader: async (kind) => ({ storagePath: `courier/c-1/${kind}.jpg` }),
    });

    for (const kind of REQUIRED_COURIER_DOCUMENT_KINDS) {
      expect(manager.isAllUploaded()).toBe(false);
      await manager.uploadDocument(kind, new File(['test'], `${kind}.jpg`));
    }

    expect(manager.isAllUploaded()).toBe(true);

    const paths = manager.getUploadedPaths();
    expect(paths.dni_front).toBe('courier/c-1/dni_front.jpg');
    expect(paths.dni_back).toBe('courier/c-1/dni_back.jpg');
    expect(paths.selfie).toBe('courier/c-1/selfie.jpg');
    expect(paths.avatar).toBe('courier/c-1/avatar.jpg');
    expect(paths.license).toBeUndefined();
  });
});

describe('PR77-H07: Integración con Supabase Storage (bucket courier-docs y RLS courier_docs_insert_own_folder)', () => {
  it('genera el path canónico con prefijo courier/${courierId}/ respetando RLS', () => {
    const courierId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
    const timestamp = 1727157600000;
    const file = new File(['content'], 'documento_dni.JPG', { type: 'image/jpeg' });

    const path = buildCourierStoragePath(courierId, 'dni_front', file, timestamp);

    expect(path).toBe(
      `courier/${courierId}/dni_front_${timestamp}.jpg`
    );
    expect(path.startsWith(`courier/${courierId}/`)).toBe(true);
  });

  it('determina extensiones correctamente para PNG, WEBP y PDF', () => {
    expect(getDocumentExtension(new File([], 'foto.PNG', { type: 'image/png' }))).toBe('png');
    expect(getDocumentExtension(new File([], 'doc.webp', { type: 'image/webp' }))).toBe('webp');
    expect(getDocumentExtension(new File([], 'seguro.pdf', { type: 'application/pdf' }))).toBe('pdf');
    expect(getDocumentExtension(new File([], 'sin-extension', { type: 'image/png' }))).toBe('png');
  });

  it('sube al bucket "courier-docs" mediante el cliente de Supabase Storage', async () => {
    const courierId = '8a2bf684-18ef-4c8d-8fd6-2c9939a3f2b4';
    const file = new File(['dni-front-content'], 'front.jpg', { type: 'image/jpeg' });

    const mockUpload = vi.fn().mockResolvedValue({
      data: { path: `courier/${courierId}/dni_front_1727157600000.jpg` },
      error: null,
    });

    const mockStorageFrom = vi.fn().mockReturnValue({
      upload: mockUpload,
    });

    const mockClient: StorageClientLike = {
      storage: {
        from: mockStorageFrom,
      },
    };

    const result = await uploadCourierDocument({
      courierId,
      kind: 'dni_front',
      file,
      supabase: mockClient,
      timestamp: 1727157600000,
    });

    // 1. Verifica que acceda exactamente al bucket 'courier-docs'
    expect(mockStorageFrom).toHaveBeenCalledWith(COURIER_DOCS_BUCKET);
    expect(mockStorageFrom).toHaveBeenCalledWith('courier-docs');

    // 2. Verifica que el path empiece con 'courier/${courierId}/' (requisito RLS courier_docs_insert_own_folder)
    const firstCall = mockUpload.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error('mockUpload no fue llamado');
    }
    const [calledPath, calledFile, calledOptions] = firstCall;
    expect(calledPath).toBe(`courier/${courierId}/dni_front_1727157600000.jpg`);
    expect(calledPath.startsWith(`courier/${courierId}/`)).toBe(true);
    expect(calledFile).toBe(file);
    expect(calledOptions).toEqual({
      contentType: 'image/jpeg',
      upsert: false,
    });

    expect(result.storagePath).toBe(`courier/${courierId}/dni_front_1727157600000.jpg`);
  });

  it('propaga errores de Supabase Storage y actualiza la máquina de estados en error', async () => {
    const courierId = '8a2bf684-18ef-4c8d-8fd6-2c9939a3f2b4';
    const file = new File(['dni-back-content'], 'back.jpg', { type: 'image/jpeg' });

    const mockUpload = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'Storage: Row-level security policy violated' },
    });

    const mockClient: StorageClientLike = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: mockUpload }),
      },
    };

    const manager = createDocumentUploadManager({
      courierId,
      supabase: mockClient,
    });

    await expect(manager.uploadDocument('dni_back', file)).rejects.toThrow(
      'Storage: Row-level security policy violated'
    );

    expect(manager.getStatus('dni_back')).toBe('error');
    expect(manager.getError('dni_back')).toBe('Storage: Row-level security policy violated');
    expect(manager.getStoragePath('dni_back')).toBeNull();
  });

  it('gestiona subidas completas con createDocumentUploadManager y cliente Storage mockeado', async () => {
    const courierId = 'courier-uuid-777';
    const mockUpload = vi.fn().mockImplementation((path: string) => {
      return Promise.resolve({
        data: { path },
        error: null,
      });
    });

    const mockClient: StorageClientLike = {
      storage: {
        from: vi.fn().mockReturnValue({ upload: mockUpload }),
      },
    };

    const manager = createDocumentUploadManager({
      courierId,
      supabase: mockClient,
    });

    const selfieFile = new File(['selfie-data'], 'selfie.png', { type: 'image/png' });
    await manager.uploadDocument('selfie', selfieFile);

    expect(manager.getStatus('selfie')).toBe('success');
    const storagePath = manager.getStoragePath('selfie');
    expect(storagePath).not.toBeNull();
    expect(storagePath).toMatch(new RegExp(`^courier/${courierId}/selfie_\\d+\\.png$`));
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });
});
