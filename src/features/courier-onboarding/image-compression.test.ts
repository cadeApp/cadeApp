import { describe, expect, it, vi } from 'vitest';
import {
  compressImage,
  isSupportedImageType,
  MAX_FILE_SIZE_BYTES,
  TARGET_COMPRESSION_MAX_BYTES,
} from '@/lib/image-compression';

describe('T-121 · DoD 1: Compresión de imágenes de documentos del repartidor', () => {
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
  });

  it('falla si el archivo tiene un tipo no soportado', async () => {
    const invalidFile = new File(['dummy content'], 'document.pdf', {
      type: 'application/pdf',
    });

    await expect(compressImage(invalidFile)).rejects.toThrow(/tipo de archivo no soportado/i);
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
    expect(compressed.size).toBeLessThanOrEqual(TARGET_COMPRESSION_MAX_BYTES);
    expect(isSupportedImageType(compressed.type)).toBe(true);
  });
});
