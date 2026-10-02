import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as serverSupabase from '@/server/supabase/server';
import { getCourierDocumentsStatus, type CourierDocumentMetadata } from './queries';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('T-324: getCourierDocumentsStatus query', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('devuelve array vacío si no hay usuario autenticado', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: null,
        }),
      },
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await getCourierDocumentsStatus();
    expect(result).toEqual([]);
  });

  it('consulta courier_documents para el usuario autenticado y retorna únicamente metadatos mínimos (kind y status)', async () => {
    const mockRows = [
      { kind: 'dni_front', status: 'submitted', storage_path: 'courier-docs/user-1/dni_front.jpg' },
      { kind: 'dni_back', status: 'submitted', storage_path: 'courier-docs/user-1/dni_back.jpg' },
      { kind: 'selfie', status: 'verified', storage_path: 'courier-docs/user-1/selfie.jpg' },
      { kind: 'avatar', status: 'submitted', storage_path: 'courier-docs/user-1/avatar.jpg' },
      { kind: 'license', status: 'submitted', storage_path: 'courier-docs/user-1/license.jpg' },
    ];

    const selectMock = vi.fn().mockReturnThis();
    const eqMock = vi.fn().mockResolvedValue({ data: mockRows, error: null });

    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: selectMock,
        eq: eqMock,
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    const result = await getCourierDocumentsStatus();

    // Verifica que se consultó solo kind y status (sin storage_path)
    expect(selectMock).toHaveBeenCalledWith('kind, status');
    expect(eqMock).toHaveBeenCalledWith('courier_id', 'user-1');

    // Verifica que el resultado no contiene storage_path ni paths privados
    expect(result).toEqual([
      { kind: 'dni_front', status: 'submitted' },
      { kind: 'dni_back', status: 'submitted' },
      { kind: 'selfie', status: 'verified' },
      { kind: 'avatar', status: 'submitted' },
      { kind: 'license', status: 'submitted' },
    ]);

    for (const doc of result) {
      expect((doc as Record<string, unknown>).storage_path).toBeUndefined();
    }
  });

  it('propaga error descriptivo cuando la consulta a Supabase falla', async () => {
    vi.mocked(serverSupabase.createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      }),
    } as unknown as Awaited<ReturnType<typeof serverSupabase.createClient>>);

    await expect(getCourierDocumentsStatus()).rejects.toThrow(
      /Error al consultar documentos del repartidor/
    );
  });
});
