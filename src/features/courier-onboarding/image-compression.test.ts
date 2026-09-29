// @vitest-environment jsdom
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateTargetDimensions,
  compressImage,
  DEFAULT_MAX_DIMENSION,
  isSupportedImageType,
  MAX_FILE_SIZE_BYTES,
  TARGET_COMPRESSION_MAX_BYTES,
} from '@/lib/image-compression';

class MockImage {
  width = 2400;
  height = 1800;
  naturalWidth = 2400;
  naturalHeight = 1800;
  onload: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private _src = '';

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
    setTimeout(() => {
      if (value.includes('error-decode')) {
        this.onerror?.(new Event('error'));
      } else {
        this.onload?.();
      }
    }, 0);
  }
}

describe('T-121 · DoD 1: Compresión de imágenes de documentos del repartidor (PR77-H04)', () => {
  const originalImage = globalThis.Image;
  const originalCreateObjectURL = window.URL.createObjectURL;
  const originalRevokeObjectURL = window.URL.revokeObjectURL;

  beforeAll(() => {
    // Mock global Image constructor with MockImage
    globalThis.Image = MockImage as unknown as typeof Image;

    // Mock window.URL object URL handlers
    window.URL.createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:mock-image-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  afterAll(() => {
    globalThis.Image = originalImage;
    window.URL.createObjectURL = originalCreateObjectURL;
    window.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    // Re-apply URL mocks
    window.URL.createObjectURL = vi.fn((_blob: Blob | MediaSource) => 'blob:mock-image-url');
    window.URL.revokeObjectURL = vi.fn();

    // Mock HTMLCanvasElement 2D context
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
      this: HTMLCanvasElement,
      contextId: string
    ) {
      if (contextId === '2d') {
        return {
          fillRect: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          fillStyle: '',
        } as unknown as CanvasRenderingContext2D;
      }
      return null;
    });

    // Mock HTMLCanvasElement.toBlob simulating compressed size <= 500 KB by default
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type = 'image/jpeg',
      quality = 0.85
    ) {
      const q = typeof quality === 'number' ? quality : 0.85;
      // Default mock produces ~380 KB at 0.85 quality, well below 500 KB
      const simulatedSize = Math.floor(400 * 1024 * (q / 0.85) * 0.95);
      const blob = new Blob([new Uint8Array(simulatedSize)], { type });
      setTimeout(() => callback(blob), 0);
    });
  });

  it('identifica tipos MIME soportados para documentos (JPEG, PNG, WebP)', () => {
    expect(isSupportedImageType('image/jpeg')).toBe(true);
    expect(isSupportedImageType('image/png')).toBe(true);
    expect(isSupportedImageType('image/webp')).toBe(true);
    expect(isSupportedImageType('application/pdf')).toBe(false);
    expect(isSupportedImageType('text/plain')).toBe(false);
  });

  it('el objetivo de compresión es inferior a 500 KB', () => {
    expect(TARGET_COMPRESSION_MAX_BYTES).toBeLessThanOrEqual(500 * 1024);
    expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024); // 10 MB límite de storage
    expect(DEFAULT_MAX_DIMENSION).toBe(1600);
  });

  it('falla si el archivo tiene un tipo no soportado', async () => {
    const invalidFile = new File(['dummy content'], 'document.pdf', {
      type: 'application/pdf',
    });

    await expect(compressImage(invalidFile)).rejects.toThrow(/tipo de archivo no soportado/i);
  });

  it('rechaza archivos que superan el límite de 10 MB', async () => {
    const tooLargeFile = new File(['dummy'], 'huge-photo.jpg', {
      type: 'image/jpeg',
    });
    Object.defineProperty(tooLargeFile, 'size', {
      value: 10 * 1024 * 1024 + 1,
      configurable: true,
    });

    await expect(compressImage(tooLargeFile)).rejects.toThrow(/máximo permitido de 10 mb/i);
  });

  it('devuelve un archivo con peso menor o igual al objetivo de 500 KB', async () => {
    // Simulamos un archivo JPEG de 2 MB
    const largeBuffer = new Uint8Array(2 * 1024 * 1024);
    const largeFile = new File([largeBuffer], 'dni_frente.jpg', {
      type: 'image/jpeg',
    });

    const compressed = await compressImage(largeFile, {
      maxSizeBytes: TARGET_COMPRESSION_MAX_BYTES,
      maxWidthOrHeight: 1600,
    });

    expect(compressed).toBeInstanceOf(File);
    expect(compressed.name).toBe('dni_frente.jpg');
    expect(compressed.size).toBeLessThanOrEqual(TARGET_COMPRESSION_MAX_BYTES);
    expect(isSupportedImageType(compressed.type)).toBe(true);
  });

  it('calcula dimensiones proporcionales correctamente con calculateTargetDimensions', () => {
    // Imagen horizontal de 3200x1600 reducida a max 1600 -> 1600x800
    expect(calculateTargetDimensions(3200, 1600, 1600)).toEqual({
      width: 1600,
      height: 800,
    });

    // Imagen vertical de 1600x3200 reducida a max 1600 -> 800x1600
    expect(calculateTargetDimensions(1600, 3200, 1600)).toEqual({
      width: 800,
      height: 1600,
    });

    // Imagen menor a 1600 no se agranda
    expect(calculateTargetDimensions(1200, 800, 1600)).toEqual({
      width: 1200,
      height: 800,
    });

    // Imagen cuadrada mayor a 1600
    expect(calculateTargetDimensions(2400, 2400, 1600)).toEqual({
      width: 1600,
      height: 1600,
    });
  });

  it('normaliza imágenes PNG a JPEG preservando el nombre original del archivo', async () => {
    const pngBuffer = new Uint8Array(1.5 * 1024 * 1024);
    const pngFile = new File([pngBuffer], 'selfie.png', {
      type: 'image/png',
    });

    const compressed = await compressImage(pngFile);

    expect(compressed).toBeInstanceOf(File);
    expect(compressed.name).toBe('selfie.png');
    expect(compressed.type).toBe('image/jpeg');
    expect(compressed.size).toBeLessThanOrEqual(TARGET_COMPRESSION_MAX_BYTES);
  });

  it('preserva el formato WebP si el archivo de entrada es image/webp', async () => {
    const webpBuffer = new Uint8Array(1024 * 1024);
    const webpFile = new File([webpBuffer], 'documento.webp', {
      type: 'image/webp',
    });

    const compressed = await compressImage(webpFile);

    expect(compressed).toBeInstanceOf(File);
    expect(compressed.name).toBe('documento.webp');
    expect(compressed.type).toBe('image/webp');
    expect(compressed.size).toBeLessThanOrEqual(TARGET_COMPRESSION_MAX_BYTES);
  });

  it('reduce la calidad progresivamente si el tamaño inicial supera el umbral objetivo', async () => {
    let callCount = 0;
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type = 'image/jpeg',
      quality = 0.85
    ) {
      callCount += 1;
      const q = typeof quality === 'number' ? quality : 0.85;
      // En la primera llamada (calidad 0.85) supera 500 KB (650 KB)
      // En la segunda llamada (calidad 0.7) baja a 420 KB
      const simulatedSize = q > 0.8 ? 650 * 1024 : 420 * 1024;
      const blob = new Blob([new Uint8Array(simulatedSize)], { type });
      setTimeout(() => callback(blob), 0);
    });

    const largeFile = new File([new Uint8Array(2 * 1024 * 1024)], 'dni_dorso.jpg', {
      type: 'image/jpeg',
    });

    const compressed = await compressImage(largeFile, {
      maxSizeBytes: TARGET_COMPRESSION_MAX_BYTES,
    });

    expect(callCount).toBeGreaterThan(1);
    expect(compressed.size).toBeLessThanOrEqual(TARGET_COMPRESSION_MAX_BYTES);
  });

  it('arroja error si la imagen no puede decodificarse', async () => {
    const corruptFile = new File(['not an image'], 'corrupted.jpg', {
      type: 'image/jpeg',
    });

    // Simulamos fallo en carga mediante URL que activa onerror en MockImage
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValueOnce('blob:error-decode');

    await expect(compressImage(corruptFile)).rejects.toThrow(/no se pudo decodificar/i);
  });
});
