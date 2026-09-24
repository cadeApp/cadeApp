/**
 * Utilidades de compresión y normalización de imágenes en el cliente (PWA).
 * Utiliza Canvas API nativa (Regla 25: cero dependencias externas añadidas).
 *
 * Diseñado para optimizar documentos del repartidor (DNI, selfie, licencias)
 * previo a la subida al bucket privado courier-docs.
 */

/** Tamaño máximo objetivo de archivo comprimido: 500 KB */
export const TARGET_COMPRESSION_MAX_BYTES = 500 * 1024;

/** Tamaño máximo permitido de archivo de entrada: 10 MB */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Dimensión máxima por defecto (ancho o alto) para redimensionado proporcional */
export const DEFAULT_MAX_DIMENSION = 1600;

/** Tipos MIME de imagen admitidos */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

export interface CompressImageOptions {
  /** Límite de peso en bytes. Por defecto: TARGET_COMPRESSION_MAX_BYTES (500 KB) */
  maxSizeBytes?: number;
  /** Límite de dimensión mayor (ancho o alto). Por defecto: 1600 */
  maxWidthOrHeight?: number;
  /** Calidad inicial de compresión (0 a 1). Por defecto: 0.85 */
  initialQuality?: number;
  /** Calidad mínima antes de reducir dimensiones adicionales. Por defecto: 0.4 */
  minQuality?: number;
  /** Tipo MIME de salida deseado. Por defecto se preserva webp si la fuente es webp; si no, jpeg */
  mimeType?: 'image/jpeg' | 'image/webp';
}

/**
 * Verifica si un tipo MIME es soportado para compresión y carga de documentos.
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageMimeType {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Calcula las dimensiones proporcionales limitadas por maxDimension.
 */
export function calculateTargetDimensions(
  width: number,
  height: number,
  maxDimension: number = DEFAULT_MAX_DIMENSION
): { width: number; height: number } {
  if (width <= 0 || height <= 0) {
    throw new Error('Dimensiones de imagen inválidas.');
  }

  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width >= height) {
    const scale = maxDimension / width;
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  const scale = maxDimension / height;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: maxDimension,
  };
}

/**
 * Carga un archivo en un elemento HTMLImageElement.
 */
function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' && typeof document === 'undefined') {
      reject(new Error('La compresión de imágenes solo está disponible en entorno de navegador.'));
      return;
    }

    const img = new Image();
    let objectUrl: string | null = null;

    const cleanup = () => {
      if (objectUrl) {
        const revoke =
          typeof window !== 'undefined' && window.URL && typeof window.URL.revokeObjectURL === 'function'
            ? window.URL.revokeObjectURL
            : typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'
            ? URL.revokeObjectURL
            : null;
        revoke?.(objectUrl);
      }
    };

    img.onload = () => {
      cleanup();
      resolve(img);
    };

    img.onerror = () => {
      cleanup();
      reject(new Error('No se pudo decodificar la imagen seleccionada.'));
    };

    const createUrl =
      typeof window !== 'undefined' && window.URL && typeof window.URL.createObjectURL === 'function'
        ? window.URL.createObjectURL
        : typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL
        : null;

    if (createUrl) {
      try {
        objectUrl = createUrl(file);
        img.src = objectUrl;
        return;
      } catch {
        // Fallback a FileReader si createObjectURL falla
      }
    }

    if (typeof FileReader !== 'undefined') {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          img.src = reader.result;
        } else {
          reject(new Error('Formato de lectura de imagen no válido.'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo de imagen.'));
      };
      reader.readAsDataURL(file);
    } else {
      reject(new Error('Entorno sin soporte para lectura de imágenes (URL / FileReader no disponible).'));
    }
  });
}

/**
 * Renderiza la imagen o canvas fuente en un nuevo canvas con dimensiones específicas.
 */
function renderToCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  width: number,
  height: number,
  targetMime: 'image/jpeg' | 'image/webp'
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('No se pudo inicializar el contexto 2D del canvas para la compresión.');
  }

  // Si el destino es JPEG, rellenar fondo blanco para evitar que fondos transparentes queden negros
  if (targetMime === 'image/jpeg') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
}

/**
 * Convierte un elemento canvas a Blob de forma asíncrona.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new Error('La API canvas.toBlob no está disponible en este entorno.'));
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('No se pudo generar el Blob comprimido de la imagen.'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * Comprime y normaliza un archivo de imagen en el navegador.
 *
 * - Valida tipo MIME admitido y tamaño máximo (10 MB).
 * - Redimensiona proporcionalmente respetando maxWidthOrHeight (por defecto 1600 px).
 * - Reduce calidad progresivamente hasta cumplir maxSizeBytes (por defecto <= 500 KB).
 * - Normaliza a 'image/jpeg' o 'image/webp', preservando el nombre de archivo original.
 *
 * @param file Archivo File seleccionado por el usuario.
 * @param options Configuración opcional de límites y calidad.
 * @returns Promesa que resuelve en un File optimizado.
 */
export async function compressImage(
  file: File,
  options?: CompressImageOptions
): Promise<File> {
  if (!file) {
    throw new Error('No se proporcionó ningún archivo para comprimir.');
  }

  if (!isSupportedImageType(file.type)) {
    throw new Error(
      `Tipo de archivo no soportado (${file.type || 'desconocido'}). Se admiten imágenes JPEG, PNG o WebP.`
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `El archivo supera el tamaño máximo permitido de 10 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`
    );
  }

  const targetMimeType: 'image/jpeg' | 'image/webp' =
    options?.mimeType ?? (file.type === 'image/webp' ? 'image/webp' : 'image/jpeg');

  const maxSizeBytes = options?.maxSizeBytes ?? TARGET_COMPRESSION_MAX_BYTES;
  const maxDimension = options?.maxWidthOrHeight ?? DEFAULT_MAX_DIMENSION;
  let quality = options?.initialQuality ?? 0.85;
  const minQuality = options?.minQuality ?? 0.4;

  const img = await loadImageFromFile(file);

  const originalWidth = img.naturalWidth || img.width;
  const originalHeight = img.naturalHeight || img.height;

  const initialDimensions = calculateTargetDimensions(
    originalWidth,
    originalHeight,
    maxDimension
  );

  let currentCanvas = renderToCanvas(
    img,
    initialDimensions.width,
    initialDimensions.height,
    targetMimeType
  );

  let blob = await canvasToBlob(currentCanvas, targetMimeType, quality);

  // Fase 1: Reducción iterativa de calidad mientras supere maxSizeBytes
  while (blob.size > maxSizeBytes && quality > minQuality) {
    quality = Math.max(minQuality, Math.round((quality - 0.15) * 100) / 100);
    blob = await canvasToBlob(currentCanvas, targetMimeType, quality);
  }

  // Fase 2: Reducción de dimensiones si al límite de calidad aún supera maxSizeBytes
  let currentWidth = initialDimensions.width;
  let currentHeight = initialDimensions.height;

  while (blob.size > maxSizeBytes && currentWidth > 320 && currentHeight > 320) {
    currentWidth = Math.round(currentWidth * 0.75);
    currentHeight = Math.round(currentHeight * 0.75);
    currentCanvas = renderToCanvas(img, currentWidth, currentHeight, targetMimeType);
    blob = await canvasToBlob(currentCanvas, targetMimeType, minQuality);
  }

  return new File([blob], file.name, {
    type: targetMimeType,
    lastModified: Date.now(),
  });
}
