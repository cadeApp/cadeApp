import type { CourierDocumentKind } from '@/domain/schemas';

export const COURIER_DOCUMENT_KINDS = [
  'dni_front',
  'dni_back',
  'selfie',
  'avatar',
  'license',
  'insurance',
] as const satisfies readonly CourierDocumentKind[];

export { type CourierDocumentKind };

export const COURIER_DOCS_BUCKET = 'courier-docs' as const;

export const REQUIRED_COURIER_DOCUMENT_KINDS = [
  'dni_front',
  'dni_back',
  'selfie',
  'avatar',
] as const;

export const OPTIONAL_COURIER_DOCUMENT_KINDS = ['license', 'insurance'] as const;

export type DocumentUploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export interface DocumentUploadItem {
  readonly kind: CourierDocumentKind;
  readonly status: DocumentUploadStatus;
  readonly progress: number;
  readonly storagePath: string | null;
  readonly error: string | null;
  readonly file?: File | null;
}

export type DocumentUploadState = Record<CourierDocumentKind, DocumentUploadItem>;

export interface StorageUploadError {
  readonly message: string;
}

export interface StorageBucketRef {
  upload: (
    path: string,
    file: File,
    options?: {
      contentType?: string;
      upsert?: boolean;
    }
  ) => Promise<{
    data: { path: string } | null;
    error: StorageUploadError | null;
  }>;
}

export interface StorageClientLike {
  storage: {
    from: (bucket: string) => StorageBucketRef;
  };
}

export type DocumentUploader = (
  kind: CourierDocumentKind,
  file: File,
  options?: { onProgress?: (progress: number) => void }
) => Promise<{ storagePath: string }>;

/**
 * Extrae la extensión canónica del archivo según su nombre o tipo MIME.
 */
export function getDocumentExtension(file: File): string {
  const parts = file.name.split('.');
  if (parts.length > 1) {
    const ext = parts.pop()?.trim().toLowerCase();
    if (ext) return ext;
  }

  switch (file.type) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
    default:
      return 'jpg';
  }
}

/**
 * Genera el path canónico para un documento en Supabase Storage respetando RLS courier_docs_insert_own_folder:
 * courier/${courierId}/${kind}_${timestamp}.${ext}
 */
export function buildCourierStoragePath(
  courierId: string,
  kind: CourierDocumentKind,
  file: File,
  timestamp: number = Date.now()
): string {
  const ext = getDocumentExtension(file);
  return `courier/${courierId}/${kind}_${timestamp}.${ext}`;
}

export interface UploadCourierDocumentOptions {
  courierId: string;
  kind: CourierDocumentKind;
  file: File;
  supabase?: StorageClientLike;
  timestamp?: number;
  onProgress?: (progress: number) => void;
}

/**
 * Sube un documento al bucket 'courier-docs' en Supabase Storage respetando la regla RLS:
 * - bucket: 'courier-docs'
 * - prefijo: 'courier/${courierId}/...'
 */
export async function uploadCourierDocument(
  options: UploadCourierDocumentOptions
): Promise<{ storagePath: string }>;
export async function uploadCourierDocument(
  courierId: string,
  kind: CourierDocumentKind,
  file: File,
  supabase?: StorageClientLike,
  timestamp?: number
): Promise<{ storagePath: string }>;
export async function uploadCourierDocument(
  arg1: UploadCourierDocumentOptions | string,
  arg2?: CourierDocumentKind,
  arg3?: File,
  arg4?: StorageClientLike,
  arg5?: number
): Promise<{ storagePath: string }> {
  let courierId: string;
  let kind: CourierDocumentKind;
  let file: File;
  let supabase: StorageClientLike | undefined;
  let timestamp: number | undefined;
  let onProgress: ((progress: number) => void) | undefined;

  if (typeof arg1 === 'object') {
    courierId = arg1.courierId;
    kind = arg1.kind;
    file = arg1.file;
    supabase = arg1.supabase;
    timestamp = arg1.timestamp;
    onProgress = arg1.onProgress;
  } else {
    courierId = arg1;
    kind = arg2!;
    file = arg3!;
    supabase = arg4;
    timestamp = arg5;
  }

  if (!courierId) {
    throw new Error('courierId es requerido para subir documentos del repartidor');
  }
  if (!kind) {
    throw new Error('kind es requerido para subir documentos del repartidor');
  }
  if (!file) {
    throw new Error('file es requerido para subir documentos del repartidor');
  }

  const client =
    supabase ??
    ((await import('@/lib/supabase/browser')).createClient() as unknown as StorageClientLike);
  const path = buildCourierStoragePath(courierId, kind, file, timestamp);

  onProgress?.(10);

  const { data, error } = await client.storage.from(COURIER_DOCS_BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  onProgress?.(100);

  return { storagePath: data?.path ?? path };
}

export interface DocumentUploadManagerOptions {
  uploader?: DocumentUploader;
  courierId?: string;
  supabase?: StorageClientLike;
  initialState?: Partial<Record<CourierDocumentKind, Partial<DocumentUploadItem>>>;
  onStateChange?: (state: DocumentUploadState) => void;
}

export interface DocumentUploadManager {
  readonly getState: () => DocumentUploadState;
  readonly getItem: (kind: CourierDocumentKind) => DocumentUploadItem;
  readonly getStatus: (kind: CourierDocumentKind) => DocumentUploadStatus;
  readonly getProgress: (kind: CourierDocumentKind) => number;
  readonly getStoragePath: (kind: CourierDocumentKind) => string | null;
  readonly getError: (kind: CourierDocumentKind) => string | null;

  readonly uploadDocument: (
    kind: CourierDocumentKind,
    file: File,
    options?: { onProgress?: (progress: number) => void }
  ) => Promise<{ storagePath: string }>;

  readonly retryDocument: (
    kind: CourierDocumentKind,
    file?: File,
    options?: { onProgress?: (progress: number) => void }
  ) => Promise<{ storagePath: string }>;

  readonly resetDocument: (kind: CourierDocumentKind) => void;
  readonly resetAll: () => void;

  readonly isIdle: (kind: CourierDocumentKind) => boolean;
  readonly isUploading: (kind: CourierDocumentKind) => boolean;
  readonly isSuccess: (kind: CourierDocumentKind) => boolean;
  readonly isError: (kind: CourierDocumentKind) => boolean;

  readonly isAllUploaded: (kinds?: readonly CourierDocumentKind[]) => boolean;
  readonly getUploadedPaths: () => Partial<Record<CourierDocumentKind, string>>;
  readonly subscribe: (listener: (state: DocumentUploadState) => void) => () => void;
}

function createInitialItem(kind: CourierDocumentKind): DocumentUploadItem {
  return {
    kind,
    status: 'idle',
    progress: 0,
    storagePath: null,
    error: null,
    file: null,
  };
}

function createInitialState(): DocumentUploadState {
  const state: Partial<DocumentUploadState> = {};
  for (const kind of COURIER_DOCUMENT_KINDS) {
    state[kind] = createInitialItem(kind);
  }
  return state as DocumentUploadState;
}

/**
 * Gestor resiliente de subida de documentos con estado y reintento aislado por documento.
 */
export function createDocumentUploadManager(
  options: DocumentUploadManagerOptions = {}
): DocumentUploadManager {
  const state: DocumentUploadState = createInitialState();

  if (options.initialState) {
    for (const kind of COURIER_DOCUMENT_KINDS) {
      if (options.initialState[kind]) {
        state[kind] = {
          ...state[kind],
          ...options.initialState[kind],
        };
      }
    }
  }

  const listeners = new Set<(s: DocumentUploadState) => void>();
  if (options.onStateChange) {
    listeners.add(options.onStateChange);
  }

  function notify(): void {
    const snapshot = { ...state };
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function resolveUploader(): DocumentUploader {
    if (options.uploader) {
      return options.uploader;
    }
    if (options.courierId) {
      const courierId = options.courierId;
      const supabase = options.supabase;
      return async (kind, file, uploaderOpts) =>
        uploadCourierDocument({
          courierId,
          kind,
          file,
          supabase,
          onProgress: uploaderOpts?.onProgress,
        });
    }
    throw new Error('createDocumentUploadManager requiere una función uploader o un courierId');
  }

  async function performUpload(
    kind: CourierDocumentKind,
    file: File,
    uploadOptions?: { onProgress?: (progress: number) => void }
  ): Promise<{ storagePath: string }> {
    state[kind] = {
      kind,
      status: 'uploading',
      progress: 0,
      storagePath: null,
      error: null,
      file,
    };
    notify();

    try {
      const uploader = resolveUploader();
      const result = await uploader(kind, file, {
        onProgress: (p) => {
          if (state[kind].status === 'uploading') {
            const safeProgress = Math.max(0, Math.min(100, Math.round(p)));
            state[kind] = {
              ...state[kind],
              progress: safeProgress,
            };
            uploadOptions?.onProgress?.(safeProgress);
            notify();
          }
        },
      });

      state[kind] = {
        kind,
        status: 'success',
        progress: 100,
        storagePath: result.storagePath,
        error: null,
        file,
      };
      uploadOptions?.onProgress?.(100);
      notify();
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      state[kind] = {
        kind,
        status: 'error',
        progress: 0,
        storagePath: null,
        error: message,
        file,
      };
      notify();
      throw err;
    }
  }

  const manager: DocumentUploadManager = {
    getState: () => ({ ...state }),
    getItem: (kind) => state[kind],
    getStatus: (kind) => state[kind].status,
    getProgress: (kind) => state[kind].progress,
    getStoragePath: (kind) => state[kind].storagePath,
    getError: (kind) => state[kind].error,

    uploadDocument: async (kind, file, opts) => {
      return performUpload(kind, file, opts);
    },

    retryDocument: async (kind, file, opts) => {
      const targetFile = file ?? state[kind].file;
      if (!targetFile) {
        throw new Error(`No hay archivo previo guardado para reintentar la subida de ${kind}`);
      }
      return performUpload(kind, targetFile, opts);
    },

    resetDocument: (kind) => {
      state[kind] = createInitialItem(kind);
      notify();
    },

    resetAll: () => {
      for (const kind of COURIER_DOCUMENT_KINDS) {
        state[kind] = createInitialItem(kind);
      }
      notify();
    },

    isIdle: (kind) => state[kind].status === 'idle',
    isUploading: (kind) => state[kind].status === 'uploading',
    isSuccess: (kind) => state[kind].status === 'success',
    isError: (kind) => state[kind].status === 'error',

    isAllUploaded: (kinds = REQUIRED_COURIER_DOCUMENT_KINDS) => {
      return kinds.every(
        (kind) => state[kind].status === 'success' && Boolean(state[kind].storagePath)
      );
    },

    getUploadedPaths: () => {
      const result: Partial<Record<CourierDocumentKind, string>> = {};
      for (const kind of COURIER_DOCUMENT_KINDS) {
        const item = state[kind];
        if (item.status === 'success' && item.storagePath) {
          result[kind] = item.storagePath;
        }
      }
      return result;
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };

  return manager;
}
